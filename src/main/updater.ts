import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getAppInfo } from '../shared/app-meta';
import { getLogger } from '../shared/logging-config';
import { MSG } from '../shared/messages';

const logger = getLogger('updater');

export interface UpdateStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'disabled';
  currentVersion: string;
  latestVersion?: string;
  message?: string;
  progress?: number;
}

let status: UpdateStatus = {
  state: 'idle',
  currentVersion: getAppInfo().version,
};

type UpdateListener = (next: UpdateStatus) => void;
const listeners = new Set<UpdateListener>();

function setStatus(partial: Partial<UpdateStatus>): void {
  status = { ...status, ...partial };
  for (const listener of listeners) {
    listener(status);
  }
}

export function getUpdateStatus(): UpdateStatus {
  return { ...status };
}

export function onUpdateStatus(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function setupAutoUpdater(): void {
  const info = getAppInfo();

  if (!info.updatesEnabled) {
    setStatus({
      state: 'disabled',
      currentVersion: info.version,
      message: MSG.update.disabled,
    });
    return;
  }

  const feedUrl = process.env.UPDATE_FEED_URL?.trim();
  const githubOwner = process.env.GITHUB_OWNER?.trim();
  const githubRepo = process.env.GITHUB_REPO?.trim();

  if (feedUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
    });
  } else if (githubOwner && githubRepo) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: githubOwner,
      repo: githubRepo,
    });
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking', message: MSG.update.checking });
  });

  autoUpdater.on('update-available', (payload) => {
    logger.info(`アップデートあり: ${payload.version}`);
    setStatus({
      state: 'available',
      latestVersion: payload.version,
      message: MSG.update.available(payload.version),
    });
  });

  autoUpdater.on('update-not-available', () => {
    setStatus({
      state: 'not-available',
      message: MSG.update.notAvailable,
    });
  });

  autoUpdater.on('error', (error) => {
    logger.warning(`アップデート確認失敗: ${error.message}`);
    setStatus({
      state: 'error',
      message: MSG.update.error,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setStatus({
      state: 'downloading',
      progress: progress.percent,
      message: MSG.update.downloading(Math.round(progress.percent)),
    });
  });

  autoUpdater.on('update-downloaded', (payload) => {
    setStatus({
      state: 'downloaded',
      latestVersion: payload.version,
      message: MSG.update.downloaded(payload.version),
    });
  });

  setTimeout(() => {
    void checkForUpdates();
  }, 4_000);
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const info = getAppInfo();
  if (!info.updatesEnabled) {
    setStatus({
      state: 'disabled',
      currentVersion: info.version,
      message: MSG.update.disabled,
    });
    return getUpdateStatus();
  }

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const message = error instanceof Error ? error.message : MSG.update.error;
    logger.warning(`アップデート確認失敗: ${message}`);
    setStatus({ state: 'error', message: MSG.update.error });
  }

  return getUpdateStatus();
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (!getAppInfo().updatesEnabled) {
    return getUpdateStatus();
  }

  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    const message = error instanceof Error ? error.message : MSG.update.error;
    logger.warning(`アップデート取得失敗: ${message}`);
    setStatus({ state: 'error', message: MSG.update.error });
  }

  return getUpdateStatus();
}

export function installUpdate(): void {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.quitAndInstall();
}
