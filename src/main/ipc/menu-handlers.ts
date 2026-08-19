import fs from 'fs';
import { app, clipboard, ipcMain, shell } from 'electron';
import {
  buildContactBody,
  ContactInput,
  isSafeEmail,
  isSafeHttpUrl,
  sanitizeContactInput,
  validateContactInput,
} from '../../shared/contact-validation';
import { getAppInfo, getHelpDocumentPath } from '../../shared/app-meta';
import { getErrorMessage } from '../../shared/error-utils';
import { IpcChannels } from '../../shared/ipc-channels';
import { MSG } from '../../shared/messages';
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  installUpdate,
} from '../updater';
import { WindowManager } from '../windows/window-manager';

let lastContactSubmitAt = 0;
const CONTACT_COOLDOWN_MS = 5_000;

export function registerMenuHandlers(windowManager: WindowManager): void {
  ipcMain.handle(IpcChannels.GET_APP_INFO, () => getAppInfo());

  ipcMain.handle(IpcChannels.GET_HELP_CONTENT, () => {
    try {
      const filePath = getHelpDocumentPath();
      return {
        content: fs.readFileSync(filePath, 'utf8'),
      };
    } catch (error) {
      return {
        content: '',
        error: getErrorMessage(error) || MSG.errors.helpNotFound,
      };
    }
  });

  ipcMain.handle(IpcChannels.SUBMIT_CONTACT, async (_event, input: unknown) => {
    const now = Date.now();
    if (now - lastContactSubmitAt < CONTACT_COOLDOWN_MS) {
      return { success: false, message: MSG.contact.tooFast };
    }

    if (!input || typeof input !== 'object') {
      return { success: false, message: MSG.contact.invalidInput };
    }

    const info = getAppInfo();
    const sanitized = sanitizeContactInput(input as ContactInput);
    const validationError = validateContactInput(sanitized);
    if (validationError) {
      return { success: false, message: validationError };
    }

    const body = buildContactBody(sanitized, info.name, info.version);

    if (info.supportEmail) {
      if (!isSafeEmail(info.supportEmail)) {
        return { success: false, message: MSG.contact.invalidDestination };
      }

      const params = new URLSearchParams({
        subject: `[${info.name}] ${sanitized.subject}`,
        body,
      });
      await shell.openExternal(`mailto:${info.supportEmail}?${params.toString()}`);
      lastContactSubmitAt = now;
      return { success: true, message: MSG.contact.mailOpened };
    }

    if (info.issuesUrl) {
      if (!isSafeHttpUrl(info.issuesUrl)) {
        return { success: false, message: MSG.contact.invalidDestination };
      }

      clipboard.writeText(body);
      await shell.openExternal(info.issuesUrl);
      lastContactSubmitAt = now;
      return { success: true, message: MSG.contact.issuesOpened };
    }

    clipboard.writeText(body);
    lastContactSubmitAt = now;
    return { success: true, message: MSG.contact.copied };
  });

  ipcMain.handle(IpcChannels.GET_UPDATE_STATUS, () => getUpdateStatus());

  ipcMain.handle(IpcChannels.CHECK_FOR_UPDATES, () => checkForUpdates());

  ipcMain.handle(IpcChannels.DOWNLOAD_UPDATE, () => downloadUpdate());

  ipcMain.handle(IpcChannels.INSTALL_UPDATE, () => {
    if (!app.isPackaged) {
      return { success: false, message: MSG.update.disabled };
    }

    installUpdate();
    return { success: true };
  });

  ipcMain.handle(IpcChannels.OPEN_HELP, () => {
    windowManager.openHelpWindow();
  });

  ipcMain.handle(IpcChannels.OPEN_CONTACT, () => {
    windowManager.openContactWindow();
  });

  ipcMain.handle(IpcChannels.OPEN_EXTERNAL, async (_event, url: string) => {
    const target = url?.trim();
    if (!target || !/^https?:\/\//i.test(target)) {
      return { success: false };
    }

    await shell.openExternal(target);
    return { success: true };
  });
}
