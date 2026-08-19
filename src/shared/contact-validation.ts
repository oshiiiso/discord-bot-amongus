export const CONTACT_LIMITS = {
  subject: 120,
  contact: 120,
  message: 4000,
  mailtoBody: 1800,
} as const;

export interface ContactInput {
  subject: string;
  message: string;
  contact: string;
}

export interface SanitizedContactInput {
  subject: string;
  message: string;
  contact: string;
}

function normalizeField(value: string, maxLength: number): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeContactInput(
  input: ContactInput | null | undefined,
): SanitizedContactInput {
  const safe: Partial<ContactInput> =
    input && typeof input === 'object' ? input : {};
  return {
    subject: normalizeField(
      typeof safe.subject === 'string' ? safe.subject : '問い合わせ',
      CONTACT_LIMITS.subject,
    ),
    contact: normalizeField(
      typeof safe.contact === 'string' ? safe.contact : '未入力',
      CONTACT_LIMITS.contact,
    ),
    message: normalizeField(
      typeof safe.message === 'string' ? safe.message : '',
      CONTACT_LIMITS.message,
    ),
  };
}

export function validateContactInput(input: SanitizedContactInput): string | null {
  if (!input.message) {
    return '内容を入力してください';
  }

  return null;
}

export function buildContactBody(
  input: SanitizedContactInput,
  appName: string,
  version: string,
): string {
  const body = [
    `連絡先: ${input.contact}`,
    '',
    input.message,
    '',
    '---',
    `アプリ: ${appName}`,
    `バージョン: ${version}`,
  ].join('\n');

  if (body.length <= CONTACT_LIMITS.mailtoBody) {
    return body;
  }

  const suffix = '\n\n（本文が長いため一部を省略しました）';
  const maxMessageLength =
    CONTACT_LIMITS.mailtoBody -
    (body.length - input.message.length) -
    suffix.length;

  return [
    `連絡先: ${input.contact}`,
    '',
    input.message.slice(0, Math.max(0, maxMessageLength)),
    suffix,
    '',
    '---',
    `アプリ: ${appName}`,
    `バージョン: ${version}`,
  ].join('\n');
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
