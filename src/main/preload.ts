import { contextBridge, ipcRenderer } from 'electron';

// preloadでは外部モジュールをrequireできないため、チャンネル名はここで定義する
const CH = {
  BOT_STATUS: 'bot:status',
  BOT_STATUS_CHANGED: 'bot:status-changed',
  MUTE_ALL: 'bot:mute-all',
  UNMUTE_ALL: 'bot:unmute-all',
  GET_CONFIG: 'config:get',
  GET_RUNTIME_CONFIG: 'runtime:get',
  SAVE_CONFIG: 'config:save',
  GET_TARGET_INFO: 'target:info',
  GET_PRESETS_INFO: 'presets:info',
  SET_ACTIVE_PRESET: 'config:set-active-preset',
  CONFIG_CHANGED: 'config:changed',
  WINDOW_FIT_CONTENT: 'window:fit-content',
  WINDOW_CLOSE: 'window:close',
  OPEN_SETTINGS: 'window:open-settings',
  GET_OPERATION_HISTORY: 'history:get',
  GET_APP_INFO: 'app:info',
  GET_HELP_CONTENT: 'help:content',
  OPEN_HELP: 'help:open',
  OPEN_CONTACT: 'contact:open',
  OPEN_EXTERNAL: 'app:open-external',
  SUBMIT_CONTACT: 'contact:submit',
  GET_UPDATE_STATUS: 'update:status',
  CHECK_FOR_UPDATES: 'update:check',
  DOWNLOAD_UPDATE: 'update:download',
  INSTALL_UPDATE: 'update:install',
  UPDATE_STATUS_CHANGED: 'update:status-changed',
} as const;

function onChannel(
  channel: string,
  callback: (payload: unknown) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: unknown) =>
    callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  getConfig: () => ipcRenderer.invoke(CH.GET_CONFIG),
  getRuntimeConfig: () => ipcRenderer.invoke(CH.GET_RUNTIME_CONFIG),
  saveConfig: (partial: Record<string, unknown>) =>
    ipcRenderer.invoke(CH.SAVE_CONFIG, partial),
  getTargetInfo: () => ipcRenderer.invoke(CH.GET_TARGET_INFO),
  getPresetsInfo: () => ipcRenderer.invoke(CH.GET_PRESETS_INFO),
  setActivePreset: (presetId: string) =>
    ipcRenderer.invoke(CH.SET_ACTIVE_PRESET, presetId),
  getBotStatus: () => ipcRenderer.invoke(CH.BOT_STATUS),
  getOperationHistory: () => ipcRenderer.invoke(CH.GET_OPERATION_HISTORY),
  getAppInfo: () => ipcRenderer.invoke(CH.GET_APP_INFO),
  getHelpContent: () => ipcRenderer.invoke(CH.GET_HELP_CONTENT),
  openHelp: () => ipcRenderer.invoke(CH.OPEN_HELP),
  openContact: () => ipcRenderer.invoke(CH.OPEN_CONTACT),
  openExternal: (url: string) => ipcRenderer.invoke(CH.OPEN_EXTERNAL, url),
  submitContact: (input: {
    subject: string;
    message: string;
    contact: string;
  }) => ipcRenderer.invoke(CH.SUBMIT_CONTACT, input),
  getUpdateStatus: () => ipcRenderer.invoke(CH.GET_UPDATE_STATUS),
  checkForUpdates: () => ipcRenderer.invoke(CH.CHECK_FOR_UPDATES),
  downloadUpdate: () => ipcRenderer.invoke(CH.DOWNLOAD_UPDATE),
  installUpdate: () => ipcRenderer.invoke(CH.INSTALL_UPDATE),
  muteAll: () => ipcRenderer.invoke(CH.MUTE_ALL),
  unmuteAll: () => ipcRenderer.invoke(CH.UNMUTE_ALL),
  openSettings: () => ipcRenderer.invoke(CH.OPEN_SETTINGS),
  closeWindow: () => ipcRenderer.invoke(CH.WINDOW_CLOSE),
  fitWindow: (width: number, height: number, kind: 'main' | 'settings') =>
    ipcRenderer.invoke(CH.WINDOW_FIT_CONTENT, width, height, kind),
  onBotStatusChanged: (callback: (payload: unknown) => void) =>
    onChannel(CH.BOT_STATUS_CHANGED, callback),
  onConfigChanged: (callback: (payload: unknown) => void) =>
    onChannel(CH.CONFIG_CHANGED, callback),
  onUpdateStatusChanged: (callback: (payload: unknown) => void) =>
    onChannel(CH.UPDATE_STATUS_CHANGED, callback),
};

contextBridge.exposeInMainWorld('amongUsBot', api);

export type AmongUsBotApi = typeof api;
