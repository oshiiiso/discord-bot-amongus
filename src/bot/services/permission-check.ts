import { PermissionFlagsBits, VoiceBasedChannel } from 'discord.js';
import { MSG } from '../../shared/messages';

export interface PermissionCheckResult {
  canMute: boolean;
  warning: string | null;
}

export function checkVoiceChannelPermissions(
  channel: VoiceBasedChannel,
): PermissionCheckResult {
  const botMember = channel.guild.members.me;
  if (!botMember) {
    return { canMute: false, warning: MSG.permission.botNotInGuild };
  }

  if (!botMember.permissions.has(PermissionFlagsBits.MuteMembers)) {
    return { canMute: false, warning: MSG.permission.missingMuteMembers };
  }

  return { canMute: true, warning: null };
}
