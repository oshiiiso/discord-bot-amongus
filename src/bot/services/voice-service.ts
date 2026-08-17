import {
  ChannelType,
  Client,
  GuildMember,
  VoiceBasedChannel,
  VoiceState,
} from 'discord.js';
import { APP_CONFIG } from '../../shared/app-config';
import { getErrorMessage } from '../../shared/error-utils';
import { MSG } from '../../shared/messages';
import { getLogger } from '../../shared/logging-config';
import { MuteOperationResult, TargetInfo } from '../../shared/types';
import { MuteSessionTracker } from './mute-session';
import { checkVoiceChannelPermissions } from './permission-check';

const logger = getLogger('voice-service');

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class VoiceService {
  private muteSession = new MuteSessionTracker();

  constructor(private client: Client) {
    client.on('voiceStateUpdate', (oldState, newState) => {
      void this.handleVoiceStateUpdate(oldState, newState);
    });
  }

  isMuteSessionActive(guildId: string, voiceChannelId: string): boolean {
    return this.muteSession.isActive(guildId, voiceChannelId);
  }

  private isMutableMember(member: GuildMember | null): member is GuildMember {
    if (!member || member.user.bot) {
      return false;
    }

    return member.id !== this.client.user?.id;
  }

  private async getVoiceChannel(
    guildId: string,
    voiceChannelId: string,
  ): Promise<VoiceBasedChannel> {
    const guild = await this.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(voiceChannelId);

    if (!channel || channel.type !== ChannelType.GuildVoice) {
      throw new Error(MSG.errors.vcNotFound);
    }

    return channel;
  }

  private getMutableMembers(channel: VoiceBasedChannel): GuildMember[] {
    return [...channel.members.values()].filter((member) =>
      this.isMutableMember(member),
    );
  }

  private async applyServerMute(
    members: GuildMember[],
    mute: boolean,
    withDelay: boolean,
  ): Promise<number> {
    let affected = 0;

    for (const member of members) {
      if (member.voice.serverMute === mute) {
        continue;
      }

      try {
        await member.voice.setMute(mute, APP_CONFIG.name);
        affected += 1;
      } catch (error) {
        logger.warning(
          `ミュート失敗: user=${member.user.tag}, ${getErrorMessage(error)}`,
        );
      }

      if (withDelay) {
        await delay(APP_CONFIG.muteDelayMs);
      }
    }

    return affected;
  }

  private async setServerMute(
    member: GuildMember,
    mute: boolean,
  ): Promise<void> {
    if (member.voice.serverMute === mute) {
      return;
    }

    await member.voice.setMute(mute, APP_CONFIG.name);
  }

  private async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
  ): Promise<void> {
    const member = newState.member ?? oldState.member;
    if (!this.isMutableMember(member)) {
      return;
    }

    const guildId = newState.guild.id;
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    try {
      if (
        oldChannelId &&
        oldChannelId !== newChannelId &&
        this.muteSession.isActive(guildId, oldChannelId)
      ) {
        await this.setServerMute(member, false);
        logger.info(
          `対象VC退出でミュート解除: user=${member.user.tag}, channel=${oldChannelId}`,
        );
      }

      if (
        newChannelId &&
        newChannelId !== oldChannelId &&
        this.muteSession.isActive(guildId, newChannelId)
      ) {
        await this.setServerMute(member, true);
        logger.info(
          `対象VC参加でミュート: user=${member.user.tag}, channel=${newChannelId}`,
        );
      }
    } catch (error) {
      logger.warning(
        `VC出入り時のミュート処理に失敗: user=${member.user.tag}, ${getErrorMessage(error)}`,
      );
    }
  }

  async getTargetInfo(
    guildId: string,
    voiceChannelId: string,
    presetId: string,
    presetName: string,
  ): Promise<TargetInfo> {
    const guild = await this.client.guilds.fetch(guildId);
    const channel = await this.getVoiceChannel(guildId, voiceChannelId);
    const permission = checkVoiceChannelPermissions(channel);

    return {
      presetId,
      presetName,
      guildId,
      guildName: guild.name,
      voiceChannelId,
      voiceChannelName: channel.name,
      memberCount: channel.members.size,
      muteSessionActive: this.muteSession.isActive(guildId, voiceChannelId),
      permissionWarning: permission.warning,
    };
  }

  async checkPermissions(
    guildId: string,
    voiceChannelId: string,
  ): Promise<string | null> {
    const channel = await this.getVoiceChannel(guildId, voiceChannelId);
    return checkVoiceChannelPermissions(channel).warning;
  }

  private async runBulkMute(
    guildId: string,
    voiceChannelId: string,
    mute: boolean,
  ): Promise<MuteOperationResult> {
    const channel = await this.getVoiceChannel(guildId, voiceChannelId);

    if (mute) {
      const permission = checkVoiceChannelPermissions(channel);
      if (!permission.canMute) {
        return {
          success: false,
          affectedCount: 0,
          message: permission.warning ?? MSG.permission.blocked,
          muteSessionActive: this.muteSession.isActive(guildId, voiceChannelId),
        };
      }
    }

    if (mute) {
      this.muteSession.activate(guildId, voiceChannelId);
    } else {
      this.muteSession.deactivate(guildId, voiceChannelId);
    }

    const members = this.getMutableMembers(channel);

    if (members.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        message: mute ? MSG.mute.sessionOnEmpty : MSG.mute.sessionOffEmpty,
        muteSessionActive: mute,
      };
    }

    const affectedCount = await this.applyServerMute(members, mute, true);
    const message = mute
      ? MSG.mute.muted(affectedCount)
      : MSG.mute.unmuted(affectedCount);

    logger.info(
      `${mute ? '全員ミュート' : 'ミュート解除'}完了: guild=${guildId}, channel=${voiceChannelId}, count=${affectedCount}`,
    );

    return {
      success: true,
      affectedCount,
      message,
      muteSessionActive: mute,
    };
  }

  async muteAll(
    guildId: string,
    voiceChannelId: string,
  ): Promise<MuteOperationResult> {
    return this.runBulkMute(guildId, voiceChannelId, true);
  }

  async unmuteAll(
    guildId: string,
    voiceChannelId: string,
  ): Promise<MuteOperationResult> {
    return this.runBulkMute(guildId, voiceChannelId, false);
  }
}
