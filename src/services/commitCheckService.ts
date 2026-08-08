import * as path from "node:path";
import * as vscode from "vscode";
import type {
  CommitCheckIssue,
  CommitCheckKind,
  CommitCheckResult,
} from "../shared/types/commitCheck";

export type CommitCheckSettings = {
  todo: boolean;
  analyze: boolean;
  reformat: boolean;
  optimizeImports: boolean;
};

export interface CommitCheckService {
  runChecks(
    repoRoot: string,
    paths: string[],
    opts?: { kinds?: CommitCheckKind[]; applyFixes?: boolean },
  ): Promise<CommitCheckResult>;
  enabledKinds(kinds?: CommitCheckKind[]): CommitCheckKind[];
  getSettings(): CommitCheckSettings;
}

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/i;

export function readCommitCheckSettings(): CommitCheckSettings {
  const config = vscode.workspace.getConfiguration("gitView");
  return {
    todo: config.get<boolean>("commitCheckTodo", false),
    analyze: config.get<boolean>("commitCheckAnalyze", false),
    reformat: config.get<boolean>("commitCheckReformat", false),
    optimizeImports: config.get<boolean>("commitCheckOptimizeImports", false),
  };
}

export function createCommitCheckService(deps?: {
  getSettings?: () => CommitCheckSettings;
}): CommitCheckService {
  const getSettings = deps?.getSettings ?? readCommitCheckSettings;

  function enabledKinds(kinds?: CommitCheckKind[]): CommitCheckKind[] {
    const settings = getSettings();
    const all: CommitCheckKind[] = [];
    if (settings.todo) {
      all.push("todo");
    }
    if (settings.analyze) {
      all.push("analyze");
    }
    if (settings.reformat) {
      all.push("reformat");
    }
    if (settings.optimizeImports) {
      all.push("optimizeImports");
    }
    if (kinds && kinds.length > 0) {
      return all.filter((kind) => kinds.includes(kind));
    }
    return all;
  }

  function toUri(repoRoot: string, filePath: string): vscode.Uri {
    return vscode.Uri.file(path.join(repoRoot, filePath));
  }

  async function checkTodo(
    repoRoot: string,
    paths: string[],
  ): Promise<CommitCheckIssue[]> {
    const issues: CommitCheckIssue[] = [];
    for (const filePath of paths) {
      const uri = toUri(repoRoot, filePath);
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(bytes).toString("utf8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (TODO_PATTERN.test(line)) {
            issues.push({
              kind: "todo",
              severity: "warning",
              message: `${filePath}:${i + 1} contains ${line.match(TODO_PATTERN)?.[1] ?? "TODO"}`,
              paths: [filePath],
            });
          }
        }
      } catch {
        // unreadable paths are skipped
      }
    }
    return issues;
  }

  async function checkAnalyze(paths: string[]): Promise<CommitCheckIssue[]> {
    const issues: CommitCheckIssue[] = [];
    const allDiagnostics = vscode.languages.getDiagnostics();
    const pathSet = new Set(paths);
    for (const [uri, diagnostics] of allDiagnostics) {
      const relative = vscode.workspace.asRelativePath(uri, false);
      if (!pathSet.has(relative)) {
        continue;
      }
      for (const diagnostic of diagnostics) {
        if (diagnostic.severity !== vscode.DiagnosticSeverity.Error) {
          continue;
        }
        issues.push({
          kind: "analyze",
          severity: "error",
          message: `${relative}:${diagnostic.range.start.line + 1} ${diagnostic.message}`,
          paths: [relative],
        });
      }
    }
    return issues;
  }

  async function applyReformat(
    repoRoot: string,
    paths: string[],
  ): Promise<CommitCheckIssue[]> {
    const issues: CommitCheckIssue[] = [];
    for (const filePath of paths) {
      const uri = toUri(repoRoot, filePath);
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
          "vscode.executeFormatDocumentProvider",
          uri,
          {},
        );
        if (Array.isArray(edits) && edits.length > 0) {
          const edit = new vscode.WorkspaceEdit();
          edit.set(uri, edits);
          await vscode.workspace.applyEdit(edit);
          await doc.save();
        }
      } catch (err) {
        issues.push({
          kind: "reformat",
          severity: "warning",
          message: `Could not reformat ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
          paths: [filePath],
        });
      }
    }
    return issues;
  }

  async function applyOptimizeImports(
    repoRoot: string,
    paths: string[],
  ): Promise<CommitCheckIssue[]> {
    const issues: CommitCheckIssue[] = [];
    for (const filePath of paths) {
      const uri = toUri(repoRoot, filePath);
      try {
        await vscode.window.showTextDocument(uri, { preview: false, preserveFocus: true });
        const applied = await vscode.commands.executeCommand<boolean>(
          "editor.action.organizeImports",
        );
        if (applied === false) {
          issues.push({
            kind: "optimizeImports",
            severity: "warning",
            message: `Optimize imports not supported for ${filePath}`,
            paths: [filePath],
          });
        } else {
          const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
          if (doc?.isDirty) {
            await doc.save();
          }
        }
      } catch (err) {
        issues.push({
          kind: "optimizeImports",
          severity: "warning",
          message: `Could not optimize imports for ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
          paths: [filePath],
        });
      }
    }
    return issues;
  }

  async function runChecks(
    repoRoot: string,
    paths: string[],
    opts?: { kinds?: CommitCheckKind[]; applyFixes?: boolean },
  ): Promise<CommitCheckResult> {
    const kinds = enabledKinds(opts?.kinds);
    const issues: CommitCheckIssue[] = [];

    if (kinds.includes("reformat") && opts?.applyFixes) {
      issues.push(...(await applyReformat(repoRoot, paths)));
    }
    if (kinds.includes("optimizeImports") && opts?.applyFixes) {
      issues.push(...(await applyOptimizeImports(repoRoot, paths)));
    }
    if (kinds.includes("todo")) {
      issues.push(...(await checkTodo(repoRoot, paths)));
    }
    if (kinds.includes("analyze")) {
      issues.push(...(await checkAnalyze(paths)));
    }

    const hasError = issues.some((issue) => issue.severity === "error");
    return { ok: !hasError, issues };
  }

  return { runChecks, enabledKinds, getSettings };
}
