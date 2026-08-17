import { PresetSummary, TargetInfo, VcPreset } from './types';

export function formatPresetLabel(presetName: string): string {
  return presetName.trim() || '名称未設定';
}

export function createPresetSummary(preset: VcPreset): PresetSummary {
  return {
    presetId: preset.id,
    presetName: preset.name,
    guildId: preset.guildId,
    voiceChannelId: preset.voiceChannelId,
    guildName: null,
    voiceChannelName: null,
  };
}

export function createTargetInfoFallback(preset: VcPreset): TargetInfo {
  return {
    presetId: preset.id,
    presetName: preset.name,
    guildId: preset.guildId,
    guildName: null,
    voiceChannelId: preset.voiceChannelId,
    voiceChannelName: null,
    memberCount: 0,
    muteSessionActive: false,
    permissionWarning: null,
  };
}
