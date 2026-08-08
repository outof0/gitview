export function redactSecrets(text: string, secrets: string[] = []): string {
  let result = text;
  for (const secret of secrets) {
    if (!secret?.trim()) {
      continue;
    }
    result = result.split(secret).join("[REDACTED]");
  }
  return result;
}

export function formatProviderApiError(
  provider: string,
  status: number,
  body: string,
  token?: string,
): string {
  const trimmed = body.trim();
  let message = trimmed;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        message?: string;
        error?: string;
        error_description?: string;
      };
      message =
        parsed.message ??
        parsed.error_description ??
        parsed.error ??
        trimmed;
    } catch {
      message = trimmed;
    }
  }
  const sanitized = redactSecrets(message.slice(0, 240), token ? [token] : []);
  return `${provider} API ${status}: ${sanitized || "Request failed"}`;
}