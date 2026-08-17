import fs from 'fs';
import { clipboard, ipcMain, shell } from 'electron';
import { getAppInfo, getHelpDocumentPath } from '../../shared/app-meta';
import { IpcChannels } from '../../shared/ipc-channels';
import { MSG } from '../../shared/messages';
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  installUpdate,
} from '../updater';
import { WindowManager } from '../windows/window-manager';

export interface ContactInput {
  subject: string;
  message: string;
  contact: string;
}

export function registerMenuHandlers(windowManager: WindowManager): void {
  ipcMain.handle(IpcChannels.GET_APP_INFO, () => getAppInfo());

  ipcMain.handle(IpcChannels.GET_HELP_CONTENT, () => {
    const filePath = getHelpDocumentPath();
    return {
      content: fs.readFileSync(filePath, 'utf8'),
      path: filePath,
    };
  });

  ipcMain.handle(IpcChannels.SUBMIT_CONTACT, async (_event, input: ContactInput) => {
    const info = getAppInfo();
    const subject = input.subject?.trim() || '問い合わせ';
    const message = input.message?.trim();
    const contact = input.contact?.trim() || '未入力';

    if (!message) {
      return { success: false, message: MSG.contact.messageRequired };
    }

    const body = [
      `連絡先: ${contact}`,
      '',
      message,
      '',
      '---',
      `アプリ: ${info.name}`,
      `バージョン: ${info.version}`,
    ].join('\n');

    if (info.supportEmail) {
      const params = new URLSearchParams({
        subject: `[${info.name}] ${subject}`,
        body,
      });
      await shell.openExternal(`mailto:${info.supportEmail}?${params.toString()}`);
      return { success: true, message: MSG.contact.mailOpened };
    }

    if (info.issuesUrl) {
      clipboard.writeText(body);
      await shell.openExternal(info.issuesUrl);
      return { success: true, message: MSG.contact.issuesOpened };
    }

    clipboard.writeText(body);
    return { success: true, message: MSG.contact.copied };
  });

  ipcMain.handle(IpcChannels.GET_UPDATE_STATUS, () => getUpdateStatus());

  ipcMain.handle(IpcChannels.CHECK_FOR_UPDATES, () => checkForUpdates());

  ipcMain.handle(IpcChannels.DOWNLOAD_UPDATE, () => downloadUpdate());

  ipcMain.handle(IpcChannels.INSTALL_UPDATE, () => {
    installUpdate();
    return { success: true };
  });

  ipcMain.handle(IpcChannels.OPEN_HELP, () => {
    windowManager.openHelpWindow();
  });

  ipcMain.handle(IpcChannels.OPEN_CONTACT, () => {
    windowManager.openContactWindow();
  });
}
