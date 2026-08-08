import * as vscode from "vscode";

type UriLike = {
  scheme?: string;
  path?: string;
  fsPath?: string;
  authority?: string;
  query?: string;
  fragment?: string;
  external?: string;
  $mid?: number;
};

function reviveSerializedUri(arg: unknown): vscode.Uri | undefined {
  if (typeof arg !== "object" || arg === null) {
    return undefined;
  }
  const UriCtor = vscode.Uri as typeof vscode.Uri & {
    revive?: (data: unknown) => vscode.Uri;
  };
  if (typeof UriCtor.revive === "function") {
    try {
      const revived = UriCtor.revive(arg);
      if (revived.scheme === "file") {
        return revived;
      }
    } catch {
      // Fall through to duck-typed parsing below.
    }
  }
  return undefined;
}

function isUriLike(value: unknown): value is UriLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as UriLike).scheme === "string" &&
    (typeof (value as UriLike).path === "string" ||
      typeof (value as UriLike).fsPath === "string")
  );
}

function uriFromLike(value: UriLike): vscode.Uri | undefined {
  const scheme = value.scheme ?? "file";
  if (scheme !== "file") {
    return undefined;
  }
  if (value.external?.startsWith("file://")) {
    return vscode.Uri.parse(value.external);
  }
  const fsPath = value.fsPath ?? value.path;
  if (!fsPath) {
    return undefined;
  }
  return vscode.Uri.file(fsPath);
}

function uriFromString(value: string): vscode.Uri | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^\$\{[^}]+\}$/.test(trimmed)) {
    return undefined;
  }
  if (trimmed.startsWith("file://")) {
    return vscode.Uri.parse(trimmed);
  }
  return vscode.Uri.file(trimmed);
}

/**
 * Normalizes VS Code / Cursor context-menu command arguments into a file URI.
 * Submenu invocations may pass a serialized URI object, a string, or nothing.
 */
export function coerceContextMenuResourceUri(
  ...args: unknown[]
): vscode.Uri | undefined {
  for (const arg of args) {
    if (!arg) {
      continue;
    }
    if (Array.isArray(arg)) {
      const nested = coerceContextMenuResourceUri(...arg);
      if (nested) {
        return nested;
      }
      continue;
    }
    if (typeof arg === "string") {
      const uri = uriFromString(arg);
      if (uri) {
        return uri;
      }
      continue;
    }
    if (typeof arg === "object") {
      const record = arg as Record<string, unknown>;
      if (record.resourceUri !== undefined) {
        const nested = coerceContextMenuResourceUri(record.resourceUri);
        if (nested) {
          return nested;
        }
      }
      if (record.uri !== undefined) {
        const nested = coerceContextMenuResourceUri(record.uri);
        if (nested) {
          return nested;
        }
      }
      const revived = reviveSerializedUri(arg);
      if (revived) {
        return revived;
      }
      if (isUriLike(arg)) {
        const uri = uriFromLike(arg);
        if (uri) {
          return uri;
        }
      }
    }
  }

  return undefined;
}
