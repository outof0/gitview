import type { GitChangedFileStatus } from "@gitview/types";
import type { GitFileStatusKind } from "@gitview/shared/types/status";

export type FileStatusVisual =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked"
  | "ignored"
  | "conflicted";

export function visualStatusFromFileKind(kind: GitFileStatusKind): FileStatusVisual {
  switch (kind) {
    case "added":
    case "copied":
      return "added";
    case "deleted":
      return "deleted";
    case "renamed":
      return "renamed";
    case "unversioned":
      return "untracked";
    case "ignored":
      return "ignored";
    case "conflicted":
      return "conflicted";
    default:
      return "modified";
  }
}

export function visualStatusFromChangedLetter(
  status: GitChangedFileStatus,
): FileStatusVisual {
  switch (status) {
    case "A":
    case "C":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    default:
      return "modified";
  }
}

export function fileStatusPrefix(visual: FileStatusVisual): string {
  switch (visual) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "untracked":
      return "?";
    case "ignored":
      return "I";
    case "conflicted":
      return "!";
  }
}

export function fileStatusTokenClass(visual: FileStatusVisual): string {
  switch (visual) {
    case "added":
      return "nx-file-status-added";
    case "modified":
      return "nx-file-status-modified";
    case "deleted":
      return "nx-file-status-deleted";
    case "renamed":
      return "nx-file-status-renamed";
    case "untracked":
      return "nx-file-status-untracked";
    case "ignored":
      return "nx-file-status-ignored";
    case "conflicted":
      return "nx-file-status-conflict";
  }
}

export function splitWorkspacePath(path: string): { name: string; dir: string } {
  const slash = path.lastIndexOf("/");
  if (slash < 0) {
    return { name: path, dir: "" };
  }
  return { name: path.slice(slash + 1), dir: path.slice(0, slash) };
}
