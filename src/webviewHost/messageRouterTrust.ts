export function isWorkspaceTrusted(deps: {
  trusted?: boolean;
  getTrusted?: () => boolean;
}): boolean {
  if (deps.getTrusted) {
    return deps.getTrusted();
  }
  return deps.trusted ?? false;
}

/** Live `trusted` getter so handlers re-read trust without rebuilding the router. */
export function withLiveTrustedField<T extends object>(
  obj: T,
  source?: {
    trusted?: boolean;
    getTrusted?: () => boolean;
    workspaceFolders?: Array<{ uriPath: string; name: string }>;
    getWorkspaceFolders?: () => Array<{ uriPath: string; name: string }>;
  },
): T & {
  trusted: boolean;
  getTrusted: () => boolean;
  getWorkspaceFolders: () => Array<{ uriPath: string; name: string }>;
} {
  const root =
    source ??
    (obj as {
      trusted?: boolean;
      getTrusted?: () => boolean;
      workspaceFolders?: Array<{ uriPath: string; name: string }>;
      getWorkspaceFolders?: () => Array<{ uriPath: string; name: string }>;
    });
  const getTrusted = () => isWorkspaceTrusted(root);
  const getWorkspaceFolders = () =>
    root.getWorkspaceFolders?.() ?? root.workspaceFolders ?? [];
  const out = { ...obj, getTrusted, getWorkspaceFolders } as T & {
    trusted: boolean;
    getTrusted: () => boolean;
    getWorkspaceFolders: () => Array<{ uriPath: string; name: string }>;
  };
  Object.defineProperty(out, "trusted", {
    enumerable: true,
    configurable: true,
    get: getTrusted,
  });
  Object.defineProperty(out, "workspaceFolders", {
    enumerable: true,
    configurable: true,
    get: getWorkspaceFolders,
  });
  return out;
}
