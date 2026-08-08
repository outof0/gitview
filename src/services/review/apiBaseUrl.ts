export function secureApiBaseUrl(options: {
  provider: "GitHub" | "GitLab";
  remoteHost: string;
  configured?: string;
  publicDefault: string;
  fallback: string;
  publicRemoteHost: string;
  publicApiHost: string;
}): string {
  const configured = options.configured?.trim();
  if (!configured) {
    return options.fallback;
  }

  const normalizedPublicDefault = options.publicDefault.replace(/\/$/, "");
  if (
    options.remoteHost !== options.publicRemoteHost &&
    configured.replace(/\/$/, "") === normalizedPublicDefault
  ) {
    return options.fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`${options.provider} API base URL must be a valid HTTPS URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${options.provider} API base URL must use HTTPS.`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      `${options.provider} API base URL cannot contain credentials, a query, or a fragment.`,
    );
  }

  const remoteHost = options.remoteHost.toLowerCase();
  const apiHost = parsed.host.toLowerCase();
  const matchesRemote = apiHost === remoteHost;
  const matchesPublicApi =
    remoteHost === options.publicRemoteHost && apiHost === options.publicApiHost;
  if (!matchesRemote && !matchesPublicApi) {
    throw new Error(
      `${options.provider} API host ${parsed.host} must match Git remote host ${options.remoteHost}.`,
    );
  }

  return configured.replace(/\/$/, "");
}
