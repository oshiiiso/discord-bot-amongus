import { MSG } from './messages';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : String(code);
}

export function toUserFacingBotError(error: unknown): string {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const normalized = message.toLowerCase();

  if (
    code === 'TokenInvalid' ||
    normalized.includes('invalid token') ||
    normalized.includes('incorrect login')
  ) {
    return MSG.errors.invalidToken;
  }

  if (
    code === 'DisallowedIntents' ||
    normalized.includes('disallowed intents') ||
    normalized.includes('privileged intent')
  ) {
    return MSG.errors.intents;
  }

  if (
    normalized.includes('enotfound') ||
    normalized.includes('etimedout') ||
    normalized.includes('econnrefused') ||
    normalized.includes('getaddrinfo') ||
    normalized.includes('network')
  ) {
    return MSG.errors.network;
  }

  if (code === 'RateLimited' || normalized.includes('rate limit')) {
    return MSG.errors.rateLimit;
  }

  if (normalized.includes('websocket') || normalized.includes('shard')) {
    return MSG.errors.websocket;
  }

  return MSG.errors.connectFailed;
}

export function isFatalBotAuthError(error: unknown): boolean {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const normalized = message.toLowerCase();

  return (
    code === 'TokenInvalid' ||
    normalized.includes('invalid token') ||
    normalized.includes('incorrect login') ||
    code === 'DisallowedIntents' ||
    normalized.includes('disallowed intents') ||
    normalized.includes('privileged intent')
  );
}

export function toUserFacingOperationError(error: unknown): string {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('未接続') || normalized.includes('not connected')) {
    return MSG.errors.botNotReady;
  }

  if (
    normalized.includes('missing permissions') ||
    normalized.includes('missing access')
  ) {
    return MSG.errors.permission;
  }

  if (normalized.includes('unknown guild')) {
    return MSG.errors.guildNotFound;
  }

  if (
    normalized.includes('unknown channel') ||
    normalized.includes('vcチャンネル')
  ) {
    return MSG.errors.channelNotFound;
  }

  return MSG.errors.operationFailed;
}
