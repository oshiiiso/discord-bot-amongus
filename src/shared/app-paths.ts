import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let appRoot = '';
let initialized = false;

function resolveAppRoot(): string {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'));
  }

  return process.cwd();
}

/** app.ready より前に呼ぶ */
export function initializeAppPaths(): void {
  if (initialized) {
    return;
  }

  appRoot = resolveAppRoot();

  const dataDir = path.join(appRoot, 'data');
  const logsDir = path.join(appRoot, 'logs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  app.setPath('userData', dataDir);

  initialized = true;
}

export function getAppRoot(): string {
  if (!initialized) {
    initializeAppPaths();
  }

  return appRoot;
}

export function getDataDir(): string {
  if (!initialized) {
    initializeAppPaths();
  }

  return app.getPath('userData');
}

export function getEnvPath(): string {
  if (!app.isPackaged) {
    return path.join(process.cwd(), '.env');
  }

  return path.join(getAppRoot(), '.env');
}

export function getLogDir(): string {
  if (!initialized) {
    initializeAppPaths();
  }

  return path.join(getAppRoot(), 'logs');
}
