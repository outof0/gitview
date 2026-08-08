import type { GitFileStatus } from "@gitview/shared/types/status";

export type WorkspaceFileGroups = {
  changes: GitFileStatus[];
  unversioned: GitFileStatus[];
  conflicts: GitFileStatus[];
};

export function groupWorkspaceFiles(files: GitFileStatus[]): WorkspaceFileGroups {
  const changes: GitFileStatus[] = [];
  const unversioned: GitFileStatus[] = [];
  const conflicts: GitFileStatus[] = [];

  for (const file of files) {
    if (file.conflicted || file.kind === "conflicted") {
      conflicts.push(file);
      continue;
    }
    if (file.kind === "unversioned") {
      unversioned.push(file);
      continue;
    }
    if (file.kind === "ignored") {
      continue;
    }
    changes.push(file);
  }

  return { changes, unversioned, conflicts };
}