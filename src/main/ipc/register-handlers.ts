import { BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { BotManager } from '../../bot/bot-manager';
import { ConfigStore } from '../../shared/config-store';
import { getErrorMessage, toUserFacingOperationError } from '../../shared/error-utils';
import { IpcChannels } from '../../shared/ipc-channels';
import { getLogger } from '../../shared/logging-config';
import { MSG } from '../../shared/messages';
import { operationHistory } from '../../shared/operation-history';
import { createPresetSummary, createTargetInfoFallback } from '../../shared/target-info';
import { AppConfigSaveInput, MuteOperationResult } from '../../shared/types';
import { getRuntimeConfigForRenderer } from '../../shared/window-layout';
import { confirmMuteAll } from '../mute-confirm';
import { fitWindowToContent, WindowKind } from '../windows/fit-window';
import { WindowManager } from '../windows/window-manager';

const logger = getLogger('ipc');

let muteOperationInFlight = false;

function broadcastConfigChanged(
  configStore: ConfigStore,
  windowManager: WindowManager,
): void {
  windowManager.broadcast(IpcChannels.CONFIG_CHANGED, configStore.toView());
}

function recordOperation(
  action: 'mute' | 'unmute',
  presetName: string,
  result: MuteOperationResult,
  windowManager: WindowManager,
): void {
  if (result.cancelled) {
    return;
  }

  const entry = operationHistory.add({
    timestamp: new Date().toISOString(),
    action,
    presetName,
    message: result.message,
    success: result.success,
  });

  windowManager.broadcast(IpcChannels.BOT_STATUS_CHANGED, {
    operationHistory: operationHistory.list(),
    lastOperation: entry,
  });
}

function broadcastMuteSessionState(
  botManager: BotManager,
  configStore: ConfigStore,
  windowManager: WindowManager,
): void {
  const preset = configStore.getActivePreset();
  if (!preset) {
    return;
  }

  windowManager.broadcast(IpcChannels.BOT_STATUS_CHANGED, {
    muteSessionActive: botManager.isMuteSessionActive(
      preset.guildId,
      preset.voiceChannelId,
    ),
  });
}

async function executeMuteAction(
  action: 'mute' | 'unmute',
  botManager: BotManager,
  configStore: ConfigStore,
  windowManager: WindowManager,
  getMainWindow: () => BrowserWindow | null,
): Promise<MuteOperationResult> {
  if (muteOperationInFlight) {
    return {
      success: false,
      affectedCount: 0,
      message: MSG.mute.busy,
    };
  }

  const preset = configStore.getActivePreset();
  if (!preset) {
    return {
      success: false,
      affectedCount: 0,
      message: MSG.preset.missing,
    };
  }

  if (!preset.guildId.trim() || !preset.voiceChannelId.trim()) {
    return {
      success: false,
      affectedCount: 0,
      message: MSG.preset.idsRequired,
    };
  }

  muteOperationInFlight = true;

  try {
    if (action === 'mute') {
      const targetInfo = await botManager.getTargetInfo(
        preset.guildId,
        preset.voiceChannelId,
        preset.id,
        preset.name,
      );

      const confirmed = await confirmMuteAll(
        getMainWindow(),
        preset.name,
        targetInfo.guildName,
        targetInfo.voiceChannelName,
        targetInfo.memberCount,
      );

      if (!confirmed) {
        return {
          success: false,
          affectedCount: 0,
          message: MSG.mute.cancelled,
          cancelled: true,
        };
      }
    }

    const result =
      action === 'mute'
        ? await botManager.muteAll(preset.guildId, preset.voiceChannelId)
        : await botManager.unmuteAll(preset.guildId, preset.voiceChannelId);

    recordOperation(action, preset.name, result, windowManager);
    broadcastMuteSessionState(botManager, configStore, windowManager);

    return result;
  } catch (error) {
    const result: MuteOperationResult = {
      success: false,
      affectedCount: 0,
      message: toUserFacingOperationError(error),
    };
    recordOperation(action, preset.name, result, windowManager);
    return result;
  } finally {
    muteOperationInFlight = false;
  }
}

export class ShortcutManager {
  constructor(
    private botManager: BotManager,
    private configStore: ConfigStore,
    private windowManager: WindowManager,
    private getMainWindow: () => BrowserWindow | null,
    private onAction: (result: MuteOperationResult) => void,
  ) {}

  register(): void {
    this.unregister();
    const config = this.configStore.get();
    const muteAccelerator = config.shortcuts.muteAll.trim();
    const unmuteAccelerator = config.shortcuts.unmuteAll.trim();

    if (muteAccelerator) {
      this.registerOne(muteAccelerator, async () => {
        const result = await executeMuteAction(
          'mute',
          this.botManager,
          this.configStore,
          this.windowManager,
          this.getMainWindow,
        );
        this.onAction(result);
      });
    }

    if (unmuteAccelerator && unmuteAccelerator !== muteAccelerator) {
      this.registerOne(unmuteAccelerator, async () => {
        const result = await executeMuteAction(
          'unmute',
          this.botManager,
          this.configStore,
          this.windowManager,
          this.getMainWindow,
        );
        this.onAction(result);
      });
    } else if (unmuteAccelerator && unmuteAccelerator === muteAccelerator) {
      logger.warning('ミュートと解除のショートカットが同じため、解除は登録しませんでした');
    }
  }

  unregister(): void {
    globalShortcut.unregisterAll();
  }

  private registerOne(accelerator: string, handler: () => void): void {
    if (!accelerator.trim()) {
      return;
    }

    const success = globalShortcut.register(accelerator, handler);
    if (!success) {
      logger.warning(`ショートカットの登録に失敗: ${accelerator}`);
    }
  }
}

export function registerIpcHandlers(
  botManager: BotManager,
  configStore: ConfigStore,
  windowManager: WindowManager,
  openSettings: () => void,
  restartBot: () => Promise<void>,
  getMainWindow: () => BrowserWindow | null,
): ShortcutManager {
  const shortcutManager = new ShortcutManager(
    botManager,
    configStore,
    windowManager,
    getMainWindow,
    (result) => {
      windowManager.broadcast(IpcChannels.BOT_STATUS_CHANGED, {
        lastAction: result,
        muteSessionActive: result.muteSessionActive,
      });
    },
  );

  ipcMain.handle(IpcChannels.GET_CONFIG, () => configStore.toView());

  ipcMain.handle(IpcChannels.GET_RUNTIME_CONFIG, () =>
    getRuntimeConfigForRenderer(),
  );

  ipcMain.handle(IpcChannels.GET_OPERATION_HISTORY, () =>
    operationHistory.list(),
  );

  ipcMain.handle(
    IpcChannels.SAVE_CONFIG,
    async (_event, partial: AppConfigSaveInput) => {
      const previousToken = configStore.get().discordToken;
      configStore.save(partial);
      logger.info('設定を保存しました');
      shortcutManager.register();

      const nextToken = partial.discordToken?.trim();
      if (nextToken && nextToken !== previousToken) {
        try {
          await restartBot();
        } catch (error) {
          logger.error(`Bot再起動に失敗: ${getErrorMessage(error)}`);
        }
      }

      broadcastConfigChanged(configStore, windowManager);
      return configStore.toView();
    },
  );

  ipcMain.handle(IpcChannels.SET_ACTIVE_PRESET, (_event, presetId: string) => {
    configStore.save({ activePresetId: presetId });
    broadcastConfigChanged(configStore, windowManager);
    broadcastMuteSessionState(botManager, configStore, windowManager);
    return configStore.toView();
  });

  ipcMain.handle(IpcChannels.GET_TARGET_INFO, async () => {
    const preset = configStore.getActivePreset();
    if (!preset) {
      return null;
    }

    if (botManager.getStatus().state !== 'ready') {
      return createTargetInfoFallback(preset);
    }

    try {
      return await botManager.getTargetInfo(
        preset.guildId,
        preset.voiceChannelId,
        preset.id,
        preset.name,
      );
    } catch {
      return createTargetInfoFallback(preset);
    }
  });

  ipcMain.handle(IpcChannels.GET_PRESETS_INFO, async () => {
    const config = configStore.get();
    if (!config.presets.length) {
      return [];
    }

    if (botManager.getStatus().state !== 'ready') {
      return config.presets.map(createPresetSummary);
    }

    return botManager.getPresetsSummary(config.presets);
  });

  ipcMain.handle(IpcChannels.BOT_STATUS, () => botManager.getStatus());

  ipcMain.handle(IpcChannels.MUTE_ALL, async () =>
    executeMuteAction(
      'mute',
      botManager,
      configStore,
      windowManager,
      getMainWindow,
    ),
  );

  ipcMain.handle(IpcChannels.UNMUTE_ALL, async () =>
    executeMuteAction(
      'unmute',
      botManager,
      configStore,
      windowManager,
      getMainWindow,
    ),
  );

  ipcMain.handle(IpcChannels.OPEN_SETTINGS, () => {
    openSettings();
  });

  ipcMain.handle(IpcChannels.WINDOW_CLOSE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle(
    IpcChannels.WINDOW_FIT_CONTENT,
    (event, width: number, height: number, kind: WindowKind) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return { width, height, capped: false };
      }

      return fitWindowToContent(window, width, height, kind);
    },
  );

  return shortcutManager;
}
