import fs from 'fs';
import path from 'path';
import { app } from 'electron';

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export interface AppInfo {
  name: string;
  version: string;
  supportEmail: string | null;
  issuesUrl: string | null;
  updatesEnabled: boolean;
}

export function getAppVersion(): string {
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function getAppInfo(): AppInfo {
  const supportEmail = readEnv('SUPPORT_EMAIL') || null;
  const issuesUrl = readEnv('ISSUES_URL') || null;
  const githubOwner = readEnv('GITHUB_OWNER');
  const githubRepo = readEnv('GITHUB_REPO');
  const updatesEnabled =
    app.isPackaged &&
    Boolean(readEnv('UPDATE_FEED_URL') || (githubOwner && githubRepo));

  return {
    name: readEnv('APP_NAME') || 'AmongUs-Bot',
    version: getAppVersion(),
    supportEmail,
    issuesUrl,
    updatesEnabled,
  };
}

export function getHelpDocumentPath(): string {
  const custom = readEnv('USER_GUIDE_PATH');
  if (custom && fs.existsSync(custom)) {
    return custom;
  }

  const candidates = [
    path.join(app.getAppPath(), 'docs', 'USER.md'),
    path.join(process.cwd(), 'docs', 'USER.md'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('利用ガイドが見つかりません');
}
