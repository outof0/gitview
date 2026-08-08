import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { LogSnapshot } from "@gitview/shared/types/log";
import type { FileDiffView } from "@gitview/types";

export function logSnapshotToStorePayload(snapshot: LogSnapshot): {
  path?: string;
  branch?: string;
  commits: LogSnapshot["commits"];
} {
  return {
    path: snapshot.filters?.path,
    branch: snapshot.branch ?? snapshot.filters?.branch,
    commits: snapshot.commits,
  };
}

export function workspaceDiffToFileDiffView(
  document: WorkspaceDiffDocument,
): FileDiffView {
  return {
    layout: document.layout,
    status: document.status,
    left: document.left,
    right: document.right,
    binary: document.binary,
  };
}