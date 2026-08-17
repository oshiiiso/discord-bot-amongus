import fs from 'fs';
import path from 'path';
import { app, nativeImage, NativeImage } from 'electron';
import { APP_CONFIG } from '../shared/app-config';
import { getLogger } from '../shared/logging-config';

const logger = getLogger('tray-icon');

function resolvePath(iconPath: string): string {
  if (path.isAbsolute(iconPath)) {
    return iconPath;
  }

  return path.join(app.getAppPath(), iconPath);
}

export function loadTrayIcon(): NativeImage {
  const candidates: string[] = [];

  if (APP_CONFIG.trayIconPath) {
    candidates.push(resolvePath(APP_CONFIG.trayIconPath));
  }

  candidates.push(path.join(app.getAppPath(), 'assets', 'tray-icon.png'));

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const image = nativeImage.createFromPath(candidate);
    if (image.isEmpty()) {
      logger.warning(`トレイアイコンを読み込めませんでした: ${candidate}`);
      continue;
    }

    return image.resize({ width: 16, height: 16 });
  }

  logger.warning('トレイアイコンが見つかりません。空アイコンを使います');
  return nativeImage.createEmpty();
}
