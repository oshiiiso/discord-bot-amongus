import { BrowserWindow, dialog, ipcMain, OpenDialogOptions } from 'electron';
import {
  getStorageInfo,
  relocateDataDir,
  resetDataDirToDefault,
} from '../../shared/app-paths';
import { IpcChannels } from '../../shared/ipc-channels';
import { MSG } from '../../shared/messages';

export function registerStorageHandlers(relaunch: () => void): void {
  ipcMain.handle(IpcChannels.GET_STORAGE_INFO, () => getStorageInfo());

  ipcMain.handle(IpcChannels.PICK_DATA_DIR, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const info = getStorageInfo();

    const options: OpenDialogOptions = {
      title: MSG.storage.pickTitle,
      defaultPath: info.dataDir,
      properties: ['openDirectory', 'createDirectory'],
    };

    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(
    IpcChannels.CHANGE_DATA_DIR,
    async (_event, targetDir: string | null) => {
      try {
        if (!targetDir) {
          resetDataDirToDefault();
        } else {
          relocateDataDir(targetDir);
        }

        relaunch();
        return { success: true, needsRestart: true };
      } catch (error) {
        return {
          success: false,
          message:
            error instanceof Error ? error.message : MSG.storage.changeFailed,
        };
      }
    },
  );
}
