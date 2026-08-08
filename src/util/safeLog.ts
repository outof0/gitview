import { redactSecrets } from "../services/review/apiError";

const TOKEN_PATTERNS: RegExp[] = [
  /\bghp_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9\-_]{20,}\b/g,
  /\bPRIVATE-TOKEN[=:\s]+[A-Za-z0-9\-_]+/gi,
  /\bAuthorization[=:\s]+(?:Bearer\s+)?[A-Za-z0-9._~+/=-]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /[?&](?:access_token|token|api_key)=[^&\s]+/gi,
];

/** Redact URL userinfo (https://user:token@host) from error strings. */
const URL_USERINFO_PATTERN = /:\/\/[^/\s:@]+:[^/\s@]+@/g;

export function sanitizeLogMessage(
  message: string,
  extraSecrets: string[] = [],
): string {
  let result = redactSecrets(message, extraSecrets);
  for (const pattern of TOKEN_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  result = result.replace(URL_USERINFO_PATTERN, "://[REDACTED]@");
  return result;
}

/** Strip `Command failed: git …` and redact credentials for UI/logs. */
export function toUserFacingGitError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message.replace(/.*Command failed: git[^\n]*\n?/i, "").trim() ||
        err.message
      : String(err);
  return sanitizeLogMessage(raw);
}

/** Alias used by host mutation handlers. */
export const gitCommandError = toUserFacingGitError;

export function createSafeLogger(
  logFn: (message: string) => void,
  secrets: string[] = [],
) {
  return {
    debug(message: string) {
      logFn(sanitizeLogMessage(message, secrets));
    },
  };
}
