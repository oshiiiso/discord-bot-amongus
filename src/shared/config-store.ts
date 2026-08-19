import Store from 'electron-store';
import { MSG } from './messages';
import {
  AppConfig,
  AppConfigSaveInput,
  AppConfigView,
  DEFAULT_CONFIG,
  VcPreset,
} from './types';

type StoreSchema = {
  config: AppConfig & {
    guildId?: string;
    voiceChannelId?: string;
  };
};

function stripPreset(preset: VcPreset & { kind?: string }): VcPreset {
  const { id, name, guildId, voiceChannelId } = preset;
  return { id, name, guildId, voiceChannelId };
}

/** 設定の保存・読み込み */
export class ConfigStore {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'config',
      defaults: {
        config: DEFAULT_CONFIG,
      },
    });
  }

  private normalize(raw: StoreSchema['config']): AppConfig {
    const merged = {
      ...DEFAULT_CONFIG,
      ...raw,
    };

    if (merged.presets.length > 0) {
      const activeExists = merged.presets.some(
        (preset) => preset.id === merged.activePresetId,
      );
      if (!activeExists) {
        merged.activePresetId = merged.presets[0].id;
      }
      return {
        ...merged,
        presets: merged.presets.map(stripPreset),
      };
    }

    const legacyGuildId = raw.guildId?.trim() ?? '';
    const legacyVoiceChannelId = raw.voiceChannelId?.trim() ?? '';
    if (legacyGuildId && legacyVoiceChannelId) {
      const preset: VcPreset = {
        id: 'preset-1',
        name: MSG.preset.legacyName,
        guildId: legacyGuildId,
        voiceChannelId: legacyVoiceChannelId,
      };
      return {
        ...merged,
        presets: [preset],
        activePresetId: preset.id,
      };
    }

    return merged;
  }

  get(): AppConfig {
    return this.normalize(this.store.get('config'));
  }

  getActivePreset(): VcPreset | null {
    const config = this.get();
    if (!config.presets.length) {
      return null;
    }

    return (
      config.presets.find((preset) => preset.id === config.activePresetId) ??
      config.presets[0]
    );
  }

  toView(): AppConfigView {
    const config = this.get();
    return {
      activePresetId: config.activePresetId,
      presets: config.presets.map((preset) => ({ ...preset })),
      shortcuts: { ...config.shortcuts },
      minimizeToTray: config.minimizeToTray,
      trayHintDismissed: config.trayHintDismissed,
      hasDiscordToken: Boolean(config.discordToken.trim()),
    };
  }

  save(partial: AppConfigSaveInput): AppConfig {
    const current = this.get();
    const nextToken = partial.discordToken?.trim()
      ? partial.discordToken.trim()
      : current.discordToken;

    const next: AppConfig = {
      ...current,
      ...partial,
      discordToken: nextToken,
      presets: partial.presets
        ? partial.presets.map((preset) => stripPreset(preset))
        : current.presets,
      shortcuts: {
        ...current.shortcuts,
        ...partial.shortcuts,
      },
    };

    if (
      next.activePresetId &&
      !next.presets.some((preset) => preset.id === next.activePresetId)
    ) {
      next.activePresetId = next.presets[0]?.id ?? '';
    }

    this.store.set('config', next);
    return this.get();
  }
}
