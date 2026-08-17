function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const APP_CONFIG = {
  name: process.env.APP_NAME?.trim() || 'AmongUs-Bot',
  muteDelayMs: readInt('MUTE_DELAY_MS', 150),
  targetRefreshMs: readInt('TARGET_REFRESH_MS', 10_000),
  windowBackground: process.env.WINDOW_BACKGROUND?.trim() || '#141517',
  trayIconPath: process.env.TRAY_ICON_PATH?.trim() || '',
  reconnectInitialMs: readInt('BOT_RECONNECT_INITIAL_MS', 5_000),
  reconnectMaxMs: readInt('BOT_RECONNECT_MAX_MS', 60_000),
  operationHistoryLimit: readInt('OPERATION_HISTORY_LIMIT', 5),
} as const;
