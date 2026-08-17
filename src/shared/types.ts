export type BotConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'error';

export interface BotStatus {
  state: BotConnectionState;
  username: string | null;
  message: string;
  lastUpdated: string;
}

export interface ShortcutConfig {
  muteAll: string;
  unmuteAll: string;
}

export interface VcPreset {
  id: string;
  name: string;
  guildId: string;
  voiceChannelId: string;
}

export interface AppConfig {
  discordToken: string;
  activePresetId: string;
  presets: VcPreset[];
  shortcuts: ShortcutConfig;
  minimizeToTray: boolean;
  trayHintDismissed: boolean;
}

/** 設定画面向け（トークンは含めない） */
export interface AppConfigView {
  activePresetId: string;
  presets: VcPreset[];
  shortcuts: ShortcutConfig;
  minimizeToTray: boolean;
  trayHintDismissed: boolean;
  hasDiscordToken: boolean;
}

export interface AppConfigSaveInput {
  discordToken?: string;
  activePresetId?: string;
  presets?: VcPreset[];
  shortcuts?: Partial<ShortcutConfig>;
  minimizeToTray?: boolean;
  trayHintDismissed?: boolean;
}

export interface PresetSummary {
  presetId: string;
  presetName: string;
  guildId: string;
  voiceChannelId: string;
  guildName: string | null;
  voiceChannelName: string | null;
}

export interface TargetInfo {
  presetId: string;
  presetName: string;
  guildId: string;
  guildName: string | null;
  voiceChannelId: string;
  voiceChannelName: string | null;
  memberCount: number;
  muteSessionActive: boolean;
  permissionWarning: string | null;
}

export interface OperationHistoryEntry {
  id: string;
  timestamp: string;
  action: 'mute' | 'unmute';
  presetName: string;
  message: string;
  success: boolean;
}

export interface MuteOperationResult {
  success: boolean;
  affectedCount: number;
  message: string;
  cancelled?: boolean;
  muteSessionActive?: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  discordToken: '',
  activePresetId: '',
  presets: [],
  shortcuts: {
    muteAll: 'CommandOrControl+Shift+M',
    unmuteAll: 'CommandOrControl+Shift+U',
  },
  minimizeToTray: false,
  trayHintDismissed: false,
};
