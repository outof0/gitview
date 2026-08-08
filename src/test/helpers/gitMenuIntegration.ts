import { execFile } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";

const exec = promisify(execFile);

const DISMISS_COMMANDS = [
  "workbench.action.closeQuickOpen",
  "workbench.action.closeDialog",
  "workbench.action.quickInputBack",
  "notifications.clearAll",
  "workbench.action.closeMessages",
] as const;

/** VS Code test harness blocks modal prompts; treat that as a cancelled dialog. */
export function isTestDialogRefusal(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("DialogService: refused to show dialog in tests");
}

/** Close quick picks and modal dialogs while a Git menu command runs. */
export async function dismissPendingUi(durationMs = 4_000): Promise<void> {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    await Promise.allSettled(
      DISMISS_COMMANDS.map((id) => vscode.commands.executeCommand(id)),
    );
    await new Promise((r) => setTimeout(r, 75));
  }
}

export async function hasGitRemote(repoRoot: string): Promise<boolean> {
  try {
    const { stdout } = await exec("git", ["remote"], { cwd: repoRoot });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function executeGitMenuCommand(
  commandId: string,
  resource?: vscode.Uri,
  options?: { timeoutMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  let stopped = false;

  const dismissLoop = async (): Promise<void> => {
    while (!stopped) {
      await Promise.allSettled(
        DISMISS_COMMANDS.map((id) => vscode.commands.executeCommand(id)),
      );
      await new Promise((r) => setTimeout(r, 75));
    }
  };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${commandId} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    ),
  );

  const dismiss = dismissLoop();
  try {
    await Promise.race([
      vscode.commands.executeCommand(commandId, resource),
      timeout,
    ]);
  } catch (err) {
    if (isTestDialogRefusal(err)) {
      return;
    }
    throw err;
  } finally {
    stopped = true;
    await dismiss.catch(() => undefined);
  }
}

export function tabLabels(): string[] {
  return vscode.window.tabGroups.all.flatMap((g) =>
    g.tabs.map((t) => t.label),
  );
}

export async function builtInGitAvailable(
  commandId: string,
): Promise<boolean> {
  const commands = await vscode.commands.getCommands(true);
  return commands.includes(commandId);
}
