import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const PORTABLE_MARKER = '.portable';
const DATA_ROOT_FILE = 'data-root.json';

let appRoot = '';
let bootstrapUserData = '';
let portable = false;
let initialized = false;

function resolveAppRoot(): string {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'));
  }

  return process.cwd();
}

function detectPortable(root: string): boolean {
  if (process.env.PORTABLE?.trim() === '1') {
    return true;
  }

  return fs.existsSync(path.join(root, PORTABLE_MARKER));
}

function readCustomDataDir(defaultDir: string): string | null {
  const pointerFile = path.join(defaultDir, DATA_ROOT_FILE);
  if (!fs.existsSync(pointerFile)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(pointerFile, 'utf8')) as {
      path?: string;
    };
    const customPath = parsed.path?.trim();
    return customPath || null;
  } catch {
    return null;
  }
}

function copyEntry(source: string, destination: string): void {
  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      if (entry === DATA_ROOT_FILE) {
        continue;
      }
      copyEntry(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

/** app.ready より前に呼ぶ */
export function initializeAppPaths(): void {
  if (initialized) {
    return;
  }

  appRoot = resolveAppRoot();
  portable = detectPortable(appRoot);
  bootstrapUserData = app.getPath('userData');

  if (portable) {
    const dataDir = path.join(appRoot, 'data');
    const logsDir = path.join(appRoot, 'logs');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
    app.setPath('userData', dataDir);
  } else {
    const customDir = readCustomDataDir(bootstrapUserData);
    const dataDir = customDir ?? bootstrapUserData;
    fs.mkdirSync(dataDir, { recursive: true });
    app.setPath('userData', dataDir);
  }

  initialized = true;
}

export function isPortableMode(): boolean {
  if (!initialized) {
    initializeAppPaths();
  }

  return portable;
}

export function getAppRoot(): string {
  if (!initialized) {
    initializeAppPaths();
  }

  return appRoot;
}

export function getBootstrapUserDataDir(): string {
  if (!initialized) {
    initializeAppPaths();
  }

  return bootstrapUserData;
}

export function getDataDir(): string {
  if (!initialized) {
    initializeAppPaths();
  }

  return app.getPath('userData');
}

export function getEnvPath(): string {
  if (isPortableMode()) {
    return path.join(getAppRoot(), '.env');
  }

  if (!app.isPackaged) {
    return path.join(process.cwd(), '.env');
  }

  return path.join(getDataDir(), '.env');
}

export function getLogDir(): string {
  if (isPortableMode() || !app.isPackaged) {
    return path.join(isPortableMode() ? getAppRoot() : process.cwd(), 'logs');
  }

  return path.join(getDataDir(), 'logs');
}

export function getStorageInfo() {
  return {
    portable: isPortableMode(),
    canChange: !isPortableMode(),
    dataDir: getDataDir(),
    logsDir: getLogDir(),
    defaultDataDir: getBootstrapUserDataDir(),
  };
}

export function relocateDataDir(targetDir: string): void {
  if (isPortableMode()) {
    throw new Error('ポータブル版では保存先を変更できません');
  }

  const normalizedTarget = path.resolve(targetDir.trim());
  const currentDir = path.resolve(getDataDir());
  const bootstrapDir = getBootstrapUserDataDir();

  if (!normalizedTarget) {
    throw new Error('保存先が指定されていません');
  }

  if (normalizedTarget === currentDir) {
    return;
  }

  fs.mkdirSync(normalizedTarget, { recursive: true });

  if (fs.existsSync(currentDir)) {
    for (const entry of fs.readdirSync(currentDir)) {
      if (entry === DATA_ROOT_FILE) {
        continue;
      }
      copyEntry(path.join(currentDir, entry), path.join(normalizedTarget, entry));
    }
  }

  fs.mkdirSync(bootstrapDir, { recursive: true });
  fs.writeFileSync(
    path.join(bootstrapDir, DATA_ROOT_FILE),
    JSON.stringify({ path: normalizedTarget }, null, 2),
    'utf8',
  );
}

export function resetDataDirToDefault(): void {
  if (isPortableMode()) {
    throw new Error('ポータブル版では保存先を変更できません');
  }

  const bootstrapDir = getBootstrapUserDataDir();
  const currentDir = path.resolve(getDataDir());

  if (currentDir !== path.resolve(bootstrapDir) && fs.existsSync(currentDir)) {
    for (const entry of fs.readdirSync(currentDir)) {
      if (entry === DATA_ROOT_FILE) {
        continue;
      }
      copyEntry(path.join(currentDir, entry), path.join(bootstrapDir, entry));
    }
  }

  const pointerFile = path.join(bootstrapDir, DATA_ROOT_FILE);
  if (fs.existsSync(pointerFile)) {
    fs.unlinkSync(pointerFile);
  }
}
