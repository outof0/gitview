import * as vscode from "vscode";
import { validateBranchName } from "../shared/lib/branchName";
import type { StashEntry, StashFileEntry } from "../shared/types/stash";

export type StashPushChoice = {
  message?: string;
  keepIndex?: boolean;
  includeUntracked?: boolean;
  paths?: string[];
};

export type StashActionId =
  | "apply"
  | "pop"
  | "applyReinstateIndex"
  | "popReinstateIndex"
  | "branch"
  | "view"
  | "drop";

export type StashSelection =
  | { kind: "stash"; entry: StashEntry }
  | { kind: "clear" };

const KEEP_INDEX = "Keep index";
const INCLUDE_UNTRACKED = "Include untracked files";

function branchSuffix(branch: string | null): string {
  return branch ? `on ${branch}` : "on a detached HEAD";
}

/**
 * Message first, options second. A single QuickPick cannot host both, because
 * typing the message would filter the option rows out of the list.
 */
export async function promptStashPush(options: {
  branch: string | null;
  changedCount: number;
  scopePath?: string | null;
}): Promise<StashPushChoice | undefined> {
  const suffix = branchSuffix(options.branch);
  const fileLabel = options.changedCount === 1 ? "file" : "files";
  const message = await vscode.window.showInputBox({
    title: "Stash Changes",
    prompt: `${suffix} · ${options.changedCount} changed ${fileLabel}`,
    placeHolder: `Message — leave empty for Git's default (WIP ${suffix})`,
  });
  if (message === undefined) {
    return undefined;
  }

  const onlyLabel = options.scopePath ? `Only ${options.scopePath}` : null;
  const items: vscode.QuickPickItem[] = [
    {
      label: KEEP_INDEX,
      detail:
        "Staged changes stay staged. They are still removed from the working tree.",
    },
    {
      label: INCLUDE_UNTRACKED,
      detail: "Also stash files Git is not tracking yet.",
    },
  ];
  if (onlyLabel) {
    items.push({
      label: onlyLabel,
      detail: "Stash just this file instead of the whole working tree.",
    });
  }

  const picked = await vscode.window.showQuickPick(items, {
    title: "Stash Changes",
    placeHolder: "Select options, then press Enter to create the stash",
    canPickMany: true,
  });
  if (!picked) {
    return undefined;
  }

  const chosen = new Set(picked.map((item) => item.label));
  return {
    message: message.trim() || undefined,
    keepIndex: chosen.has(KEEP_INDEX) || undefined,
    includeUntracked: chosen.has(INCLUDE_UNTRACKED) || undefined,
    paths:
      onlyLabel && chosen.has(onlyLabel) && options.scopePath
        ? [options.scopePath]
        : undefined,
  };
}

export async function promptStashSelection(
  stashes: StashEntry[],
  branch: string | null,
): Promise<StashSelection | undefined> {
  type Item = vscode.QuickPickItem & { entry?: StashEntry; clear?: boolean };

  const items: Item[] = stashes.map((entry) => ({
    label: entry.message,
    description: entry.branch ? `on ${entry.branch}` : undefined,
    detail: [entry.ref, entry.relativeDate].filter(Boolean).join(" · "),
    entry,
  }));
  items.push(
    { label: "", kind: vscode.QuickPickItemKind.Separator },
    {
      label: `Clear all stashes (${stashes.length})…`,
      detail: "Deletes every stash without restoring it.",
      clear: true,
    },
  );

  const picked = await vscode.window.showQuickPick(items, {
    title: "Unstash Changes",
    placeHolder: `Select a stash to restore ${branchSuffix(branch)}`,
    matchOnDescription: true,
    matchOnDetail: true,
  });
  if (!picked) {
    return undefined;
  }
  return picked.clear
    ? { kind: "clear" }
    : { kind: "stash", entry: picked.entry! };
}

export async function promptStashAction(
  entry: StashEntry,
  options: { canView: boolean },
): Promise<StashActionId | undefined> {
  type Item = vscode.QuickPickItem & { id: StashActionId };

  const items: Item[] = [
    { id: "apply", label: "Apply Stash", detail: "Keeps the stash in the list." },
    { id: "pop", label: "Pop Stash", detail: "Applies, then drops the stash." },
    {
      id: "applyReinstateIndex",
      label: "Apply and Reinstate Index",
      detail: "Restores the staged/unstaged split the stash was created with.",
    },
    {
      id: "popReinstateIndex",
      label: "Pop and Reinstate Index",
      detail: "Restores the staged/unstaged split, then drops the stash.",
    },
    {
      id: "branch",
      label: "Branch from Stash…",
      detail: "Creates a branch at the stash's base commit and applies it there.",
    },
  ];
  if (options.canView) {
    items.push({
      id: "view",
      label: "View Stash Contents…",
      detail: "Opens a file from the stash as a diff.",
    });
  }
  items.push({
    id: "drop",
    label: "Drop Stash",
    detail: "Deletes the stash without restoring it.",
  });

  const picked = await vscode.window.showQuickPick(items, {
    title: `Unstash Changes — ${entry.ref}`,
    placeHolder: entry.message,
  });
  return picked?.id;
}

export async function promptStashBranchName(
  entry: StashEntry,
): Promise<string | undefined> {
  const branch = await vscode.window.showInputBox({
    title: `Branch from Stash — ${entry.ref}`,
    prompt: "Enter a branch name",
    placeHolder: "feature/name",
    validateInput: validateBranchName,
  });
  return branch?.trim() || undefined;
}

export async function promptStashFile(
  files: StashFileEntry[],
  entry: StashEntry,
): Promise<StashFileEntry | undefined> {
  type Item = vscode.QuickPickItem & { file: StashFileEntry };

  const picked = await vscode.window.showQuickPick(
    files.map<Item>((file) => ({
      label: file.path,
      description: file.origin === "tracked" ? file.status : `${file.status} · ${file.origin}`,
      file,
    })),
    {
      title: `View Stash Contents — ${entry.ref}`,
      placeHolder: "Select a file to open as a diff",
      matchOnDescription: true,
    },
  );
  return picked?.file;
}
