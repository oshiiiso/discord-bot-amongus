import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
};

const LOG_FILENAME_PATTERN = /^\d{8}\.log$/;

let initialized = false;
let logDir = path.join(process.cwd(), 'logs');
let minLevel: LogLevel = 'INFO';
let retentionDays = 30;
let currentDate = '';
let fileStream: fs.WriteStream | null = null;

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = (value ?? 'INFO').toUpperCase();
  if (
    normalized === 'DEBUG' ||
    normalized === 'INFO' ||
    normalized === 'WARNING' ||
    normalized === 'ERROR'
  ) {
    return normalized;
  }
  return 'INFO';
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatRecord(
  level: LogLevel,
  name: string,
  message: string,
  date = new Date(),
): string {
  const levelLabel = level.padEnd(8, ' ');
  const nameLabel = name.padEnd(20, ' ').slice(0, 20);
  return `${formatTimestamp(date)} | ${levelLabel} | ${nameLabel} | ${message}`;
}

function cleanupOldLogs(): void {
  if (!fs.existsSync(logDir)) {
    return;
  }

  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - retentionDays);

  for (const fileName of fs.readdirSync(logDir)) {
    if (!LOG_FILENAME_PATTERN.test(fileName)) {
      continue;
    }

    const year = Number(fileName.slice(0, 4));
    const month = Number(fileName.slice(4, 6));
    const day = Number(fileName.slice(6, 8));
    const fileDate = new Date(year, month - 1, day);

    if (fileDate < threshold) {
      try {
        fs.unlinkSync(path.join(logDir, fileName));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '不明なエラー';
        write('WARNING', 'logging-config', `古いログファイルの削除に失敗しました: ${fileName} (${message})`);
      }
    }
  }
}

function rotateIfNeeded(date = new Date()): void {
  const nextDate = formatDateKey(date);
  if (nextDate === currentDate && fileStream) {
    return;
  }

  if (fileStream) {
    fileStream.end();
    fileStream = null;
  }

  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `${nextDate}.log`);
  fileStream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf-8' });
  currentDate = nextDate;
  cleanupOldLogs();
}

function write(level: LogLevel, name: string, message: string): void {
  if (!initialized) {
    return;
  }

  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) {
    return;
  }

  const line = formatRecord(level, name, message);
  process.stdout.write(`${line}\n`);

  rotateIfNeeded();
  fileStream?.write(`${line}\n`);
}

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export function getLogger(name: string): Logger {
  return {
    debug: (message) => write('DEBUG', name, message),
    info: (message) => write('INFO', name, message),
    warning: (message) => write('WARNING', name, message),
    error: (message) => write('ERROR', name, message),
  };
}

export interface SetupLoggingOptions {
  logDir?: string;
  logLevel?: string;
  retentionDays?: string | number;
}

/** ロギング初期化 */
export function setupLogging(options: SetupLoggingOptions = {}): void {
  if (initialized) {
    return;
  }

  if (options.logDir) {
    logDir = options.logDir;
  }

  minLevel = parseLogLevel(options.logLevel ?? process.env.LOG_LEVEL);
  retentionDays = Number(options.retentionDays ?? process.env.LOG_RETENTION_DAYS ?? 30);

  rotateIfNeeded();
  initialized = true;
}

export function closeLogging(): void {
  if (fileStream) {
    fileStream.end();
    fileStream = null;
  }
  initialized = false;
  currentDate = '';
}
