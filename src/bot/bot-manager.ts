import { EventEmitter } from 'events';
import { Client, GatewayIntentBits } from 'discord.js';
import { APP_CONFIG } from '../shared/app-config';
import { MSG } from '../shared/messages';
import { getErrorMessage, toUserFacingBotError } from '../shared/error-utils';
import { getLogger } from '../shared/logging-config';
import { createPresetSummary } from '../shared/target-info';
import { BotStatus, PresetSummary, TargetInfo, VcPreset } from '../shared/types';
import { VoiceService } from './services/voice-service';

const logger = getLogger('bot-manager');

type BotManagerEvents = {
  status: (status: BotStatus) => void;
};

export interface BotManager {
  on<U extends keyof BotManagerEvents>(
    event: U,
    listener: BotManagerEvents[U],
  ): this;
  emit<U extends keyof BotManagerEvents>(
    event: U,
    ...args: Parameters<BotManagerEvents[U]>
  ): boolean;
}

export class BotManager extends EventEmitter {
  private client: Client | null = null;
  private voiceService: VoiceService | null = null;
  private intentionalStop = false;
  private currentToken = '';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: BotStatus = {
    state: 'disconnected',
    username: null,
    message: MSG.bot.disconnected,
    lastUpdated: new Date().toISOString(),
  };

  getStatus(): BotStatus {
    return { ...this.status };
  }

  private setStatus(partial: Partial<BotStatus>): void {
    this.status = {
      ...this.status,
      ...partial,
      lastUpdated: new Date().toISOString(),
    };
    this.emit('status', this.getStatus());
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private getReconnectDelayMs(): number {
    const delay = APP_CONFIG.reconnectInitialMs * 2 ** this.reconnectAttempt;
    return Math.min(delay, APP_CONFIG.reconnectMaxMs);
  }

  private scheduleReconnect(): void {
    if (this.intentionalStop || !this.currentToken.trim()) {
      return;
    }

    const delayMs = this.getReconnectDelayMs();
    const seconds = Math.max(1, Math.round(delayMs / 1000));

    this.setStatus({
      state: 'connecting',
      username: null,
      message: MSG.bot.reconnecting(seconds),
    });

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt += 1;
      void this.attemptReconnect();
    }, delayMs);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.intentionalStop || !this.currentToken.trim()) {
      return;
    }

    try {
      await this.connect(this.currentToken);
      this.reconnectAttempt = 0;
    } catch (error) {
      logger.error(`Bot再接続失敗: ${getErrorMessage(error)}`);
      this.scheduleReconnect();
    }
  }

  private async handleUnexpectedDisconnect(): Promise<void> {
    if (this.intentionalStop) {
      return;
    }

    this.voiceService = null;
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        // 切断済みの場合がある
      }
      this.client = null;
    }

    this.setStatus({
      state: 'disconnected',
      username: null,
      message: MSG.bot.disconnectedFromDiscord,
    });

    this.scheduleReconnect();
  }

  private async connect(token: string): Promise<void> {
    if (this.client) {
      this.voiceService = null;
      try {
        await this.client.destroy();
      } catch {
        // 既に切断済みの場合がある
      }
      this.client = null;
    }

    this.setStatus({
      state: 'connecting',
      username: null,
      message: MSG.bot.connecting,
    });

    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });

    client.once('ready', () => {
      logger.info(`Bot 接続完了: ${client.user?.tag ?? 'unknown'}`);
      this.setStatus({
        state: 'ready',
        username: client.user?.tag ?? null,
        message: MSG.bot.ready,
      });
    });

    client.on('error', (error) => {
      logger.error(`Discord クライアントエラー: ${error.message}`);
      this.setStatus({
        state: 'error',
        message: toUserFacingBotError(error),
      });
    });

    client.on('shardDisconnect', () => {
      logger.warning('Discord 接続が切れました');
      void this.handleUnexpectedDisconnect();
    });

    try {
      await client.login(token);
      this.client = client;
      this.voiceService = new VoiceService(client);
    } catch (error) {
      logger.error(`Discord ログイン失敗: ${getErrorMessage(error)}`);
      this.setStatus({
        state: 'error',
        username: null,
        message: toUserFacingBotError(error),
      });
      await client.destroy();
      this.client = null;
      this.voiceService = null;
      throw error;
    }
  }

  async start(token: string): Promise<void> {
    if (this.client?.isReady()) {
      return;
    }

    this.intentionalStop = false;
    this.clearReconnectTimer();
    this.currentToken = token.trim();

    if (!this.currentToken) {
      this.setStatus({
        state: 'disconnected',
        username: null,
        message: MSG.bot.tokenRequired,
      });
      return;
    }

    await this.connect(this.currentToken);
    this.reconnectAttempt = 0;
  }

  async stop(): Promise<void> {
    this.intentionalStop = true;
    this.clearReconnectTimer();
    this.currentToken = '';

    if (this.client) {
      logger.info('Bot を停止します');
      this.voiceService = null;
      await this.client.destroy();
      this.client = null;
    }

    this.setStatus({
      state: 'disconnected',
      username: null,
      message: MSG.bot.stopped,
    });
  }

  private ensureReady(): VoiceService {
    if (!this.client?.isReady() || !this.voiceService) {
      throw new Error(MSG.errors.botNotReady);
    }
    return this.voiceService;
  }

  async muteAll(guildId: string, voiceChannelId: string) {
    return this.ensureReady().muteAll(guildId, voiceChannelId);
  }

  async unmuteAll(guildId: string, voiceChannelId: string) {
    return this.ensureReady().unmuteAll(guildId, voiceChannelId);
  }

  async getTargetInfo(
    guildId: string,
    voiceChannelId: string,
    presetId: string,
    presetName: string,
  ): Promise<TargetInfo> {
    return this.ensureReady().getTargetInfo(
      guildId,
      voiceChannelId,
      presetId,
      presetName,
    );
  }

  async getPresetsSummary(presets: VcPreset[]): Promise<PresetSummary[]> {
    const ready = Boolean(this.client?.isReady() && this.voiceService);

    return Promise.all(
      presets.map(async (preset) => {
        const summary = createPresetSummary(preset);

        if (
          !ready ||
          !preset.guildId.trim() ||
          !preset.voiceChannelId.trim()
        ) {
          return summary;
        }

        try {
          const info = await this.getTargetInfo(
            preset.guildId,
            preset.voiceChannelId,
            preset.id,
            preset.name,
          );
          return {
            ...summary,
            guildName: info.guildName,
            voiceChannelName: info.voiceChannelName,
          };
        } catch {
          return summary;
        }
      }),
    );
  }

  isMuteSessionActive(guildId: string, voiceChannelId: string): boolean {
    return this.voiceService?.isMuteSessionActive(guildId, voiceChannelId) ?? false;
  }
}
