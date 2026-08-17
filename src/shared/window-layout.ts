import { APP_CONFIG } from './app-config';

export type WindowKind = 'main' | 'settings';

export interface WindowSize {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export const WINDOW_LAYOUT: Record<WindowKind, WindowSize> = {
  main: {
    width: 360,
    height: 456,
    minWidth: 360,
    minHeight: 456,
    maxWidth: 520,
    maxHeight: 756,
  },
  settings: {
    width: 520,
    height: 560,
    minWidth: 520,
    minHeight: 560,
    maxWidth: 520,
    maxHeight: 560,
  },
};

export function getRuntimeConfigForRenderer() {
  const settings = WINDOW_LAYOUT.settings;
  return {
    targetRefreshMs: APP_CONFIG.targetRefreshMs,
    settingsWindow: {
      width: settings.width,
      height: settings.height,
    },
  };
}
