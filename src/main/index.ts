import path from 'path';
import { app, BrowserWindow } from 'electron';
import dotenv from 'dotenv';
import { BotManager } from '../bot/bot-manager';
import { ConfigStore } from '../shared/config-store';
import {
  getEnvPath,
  getLogDir,
  initializeAppPaths,
  isPortableMode,
} from '../shared/app-paths';
import { IpcChannels } from '../shared/ipc-channels';
import { closeLogging, getLogger, setupLogging } from '../shared/logging-config';
import { MSG } from '../shared/messages';
import { getErrorMessage } from '../shared/error-utils';
import { registerIpcHandlers } from './ipc/register-handlers';
import { registerMenuHandlers } from './ipc/menu-handlers';
import { registerStorageHandlers } from './ipc/storage-handlers';
import { setupAutoUpdater, onUpdateStatus } from './updater';
import { WindowManager } from './windows/window-manager';

initializeAppPaths();
dotenv.config({ path: getEnvPath() });
setupLogging({ logDir: getLogDir() });

const logger = getLogger('main');

const getUiPath = (...segments: string[]) =>
  path.join(app.getAppPath(), 'ui', ...segments);

const preloadPath = path.join(__dirname, 'preload.js');

let botManager: BotManager;
let configStore: ConfigStore;
let windowManager: WindowManager;
let shortcutManager: ReturnType<typeof registerIpcHandlers>;

async function startBot(): Promise<void> {
  const token = configStore.get().discordToken.trim();

  if (!token) {
    logger.warning('Botトークンが未設定です');
    botManager.emit('status', {
      state: 'disconnected',
      username: null,
      message: MSG.bot.tokenRequired,
      lastUpdated: new Date().toISOString(),
    });
    return;
  }

  try {
    logger.info('Bot起動');
    await botManager.start(token);
  } catch (error) {
    logger.error(`Bot起動失敗: ${getErrorMessage(error)}`);
  }
}

async function restartBot(): Promise<void> {
  await botManager.stop();
  await startBot();
}

async function stopBot(): Promise<void> {
  shortcutManager?.unregister();
  logger.info('Bot停止');
  await botManager.stop();
}

function setupApp(): void {
  configStore = new ConfigStore();
  botManager = new BotManager();
  logger.info(
    isPortableMode()
      ? 'アプリ起動（ポータブルモード）'
      : 'アプリ起動',
  );
  windowManager = new WindowManager(
    getUiPath,
    preloadPath,
    () => configStore.get().minimizeToTray,
    () => {
      app.isQuitting = true;
      void stopBot().finally(() => app.quit());
    },
  );

  shortcutManager = registerIpcHandlers(
    botManager,
    configStore,
    windowManager,
    () => windowManager.openSettingsWindow(),
    restartBot,
    () => windowManager.getMainWindow(),
  );

  registerStorageHandlers(() => {
    app.relaunch();
    app.exit(0);
  });

  registerMenuHandlers(windowManager);

  onUpdateStatus((status) => {
    windowManager.broadcast(IpcChannels.UPDATE_STATUS_CHANGED, status);
  });

  setupAutoUpdater();

  botManager.on('status', (status) => {
    windowManager.broadcast(IpcChannels.BOT_STATUS_CHANGED, status);
  });

  const mainWindow = windowManager.createMainWindow();
  windowManager.createTray();
  shortcutManager.register();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    windowManager.broadcast(IpcChannels.BOT_STATUS_CHANGED, botManager.getStatus());
  });

  mainWindow.webContents.on('preload-error', (_event, preloadFile, error) => {
    logger.error(`preload読み込み失敗: ${preloadFile} (${error.message})`);
  });

  void startBot();
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = windowManager?.getMainWindow();
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.show();
      window.focus();
    }
  });

  app.whenReady().then(setupApp);

  app.on('window-all-closed', () => {
    // トレイ常駐
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
  });

  app.on('will-quit', () => {
    shortcutManager?.unregister();
    logger.info('アプリ終了');
    closeLogging();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    }
  });
}

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}
