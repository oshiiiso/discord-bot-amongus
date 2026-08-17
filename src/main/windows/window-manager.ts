import { BrowserWindow, Tray, Menu, app } from 'electron';
import { loadTrayIcon } from '../tray-icon';
import { APP_CONFIG } from '../../shared/app-config';
import { MSG } from '../../shared/messages';
import { WINDOW_LAYOUT } from '../../shared/window-layout';
import { getFramelessWindowOptions } from './window-options';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private helpWindow: BrowserWindow | null = null;
  private contactWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;

  constructor(
    private getUiPath: (...segments: string[]) => string,
    private preloadPath: string,
    private getMinimizeToTray: () => boolean,
    private onQuit: () => void,
  ) {}

  private getWebPreferences() {
    return {
      preload: this.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    };
  }

  createMainWindow(): BrowserWindow {
    if (this.mainWindow) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    const layout = WINDOW_LAYOUT.main;
    this.mainWindow = new BrowserWindow(
      getFramelessWindowOptions({
        minWidth: layout.minWidth,
        minHeight: layout.minHeight,
        resizable: false,
        title: APP_CONFIG.name,
        webPreferences: this.getWebPreferences(),
      }),
    );

    this.mainWindow.loadFile(this.getUiPath('index.html'));

    this.mainWindow.on('close', (event) => {
      if (app.isQuitting) {
        return;
      }

      if (this.getMinimizeToTray()) {
        event.preventDefault();
        this.mainWindow?.hide();
        return;
      }

      app.isQuitting = true;
      this.onQuit();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  openSettingsWindow(): BrowserWindow {
    if (this.settingsWindow) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    const layout = WINDOW_LAYOUT.settings;
    this.settingsWindow = new BrowserWindow(
      getFramelessWindowOptions({
        width: layout.width,
        height: layout.height,
        minWidth: layout.minWidth,
        maxWidth: layout.maxWidth,
        minHeight: layout.minHeight,
        maxHeight: layout.maxHeight,
        resizable: false,
        title: `${APP_CONFIG.name} 設定`,
        webPreferences: this.getWebPreferences(),
      }),
    );

    this.settingsWindow.loadFile(this.getUiPath('settings.html'));

    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow?.show();
      this.settingsWindow?.focus();
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  openHelpWindow(): BrowserWindow {
    if (this.helpWindow) {
      this.helpWindow.show();
      this.helpWindow.focus();
      return this.helpWindow;
    }

    this.helpWindow = new BrowserWindow(
      getFramelessWindowOptions({
        width: 640,
        height: 720,
        minWidth: 480,
        minHeight: 400,
        resizable: true,
        title: `${APP_CONFIG.name} ヘルプ`,
        webPreferences: this.getWebPreferences(),
      }),
    );

    this.helpWindow.loadFile(this.getUiPath('help.html'));

    this.helpWindow.once('ready-to-show', () => {
      this.helpWindow?.show();
      this.helpWindow?.focus();
    });

    this.helpWindow.on('closed', () => {
      this.helpWindow = null;
    });

    return this.helpWindow;
  }

  openContactWindow(): BrowserWindow {
    if (this.contactWindow) {
      this.contactWindow.show();
      this.contactWindow.focus();
      return this.contactWindow;
    }

    this.contactWindow = new BrowserWindow(
      getFramelessWindowOptions({
        width: 480,
        height: 520,
        minWidth: 400,
        minHeight: 420,
        resizable: false,
        title: `${APP_CONFIG.name} 問い合わせ`,
        webPreferences: this.getWebPreferences(),
      }),
    );

    this.contactWindow.loadFile(this.getUiPath('contact.html'));

    this.contactWindow.once('ready-to-show', () => {
      this.contactWindow?.show();
      this.contactWindow?.focus();
    });

    this.contactWindow.on('closed', () => {
      this.contactWindow = null;
    });

    return this.contactWindow;
  }

  createTray(): Tray {
    if (this.tray) {
      return this.tray;
    }

    const icon = loadTrayIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip(APP_CONFIG.name);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: MSG.ui.trayShow,
        click: () => {
          const window = this.createMainWindow();
          window.show();
        },
      },
      {
        label: MSG.ui.traySettings,
        click: () => this.openSettingsWindow(),
      },
      {
        label: MSG.menu.help,
        click: () => this.openHelpWindow(),
      },
      {
        label: MSG.menu.contact,
        click: () => this.openContactWindow(),
      },
      { type: 'separator' },
      {
        label: MSG.ui.trayQuit,
        click: () => this.onQuit(),
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.on('double-click', () => {
      const window = this.createMainWindow();
      window.show();
    });

    return this.tray;
  }

  broadcast(channel: string, payload: unknown): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(channel, payload);
    });
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
