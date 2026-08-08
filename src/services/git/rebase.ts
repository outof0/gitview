import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { nonInteractiveContinueEnv } from "./exec";
import type { GitExecFn } from "./types";

export type RebaseTodoAction = "pick" | "drop" | "reword" | "squash" | "fixup";

export type RebaseTodoLine = {
  action: RebaseTodoAction;
  sha: string;
  subject: string;
};

async function writeExecutable(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, { mode: 0o755 });
}

async function runWithEditors(
  execGit: GitExecFn,
  repoRoot: string,
  onto: string,
  todoLines: RebaseTodoLine[],
  opts?: { messagePath?: string },
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-rebase-"));
  const todoPath = path.join(dir, "todo");
  const seqEditor = path.join(dir, "seq-editor.sh");
  const todoContent = `${todoLines
    .map((line) => `${line.action} ${line.sha} ${line.subject}`)
    .join("\n")}\n`;
  await fs.writeFile(todoPath, todoContent, "utf8");
  await writeExecutable(
    seqEditor,
    `#!/bin/sh\ncp "${todoPath}" "$1"\n`,
  );

  const env: NodeJS.ProcessEnv = {
    GIT_SEQUENCE_EDITOR: seqEditor,
  };
  if (opts?.messagePath) {
    const msgEditor = path.join(dir, "msg-editor.sh");
    await writeExecutable(
      msgEditor,
      `#!/bin/sh\ncp "${opts.messagePath}" "$1"\n`,
    );
    env.GIT_EDITOR = msgEditor;
  }

  await execGit(repoRoot, ["rebase", "-i", onto], { env });
}

export function createRebaseApi(execGit: GitExecFn) {
  async function listCommitsSince(
    repoRoot: string,
    onto: string,
  ): Promise<RebaseTodoLine[]> {
    const { stdout } = await execGit(repoRoot, [
      "log",
      "--reverse",
      `--format=%H|%s`,
      `${onto}..HEAD`,
    ]);
    const lines: RebaseTodoLine[] = [];
    for (const row of stdout.split("\n")) {
      const trimmed = row.trim();
      if (!trimmed) {
        continue;
      }
      const [sha, subject] = trimmed.split("|");
      if (!sha) {
        continue;
      }
      lines.push({
        action: "pick",
        sha: sha.trim(),
        subject: (subject ?? "").trim(),
      });
    }
    return lines;
  }

  async function dropCommit(repoRoot: string, sha: string): Promise<void> {
    await execGit(repoRoot, ["rebase", "--onto", `${sha}^`, sha]);
  }

  async function editMessage(
    repoRoot: string,
    sha: string,
    message: string,
    headSha: string | null,
  ): Promise<void> {
    if (headSha && sha === headSha) {
      await execGit(repoRoot, ["commit", "--amend", "-m", message]);
      return;
    }

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-rebase-msg-"));
    const messagePath = path.join(dir, "message.txt");
    await fs.writeFile(messagePath, message, "utf8");

    const commits = await listCommitsSince(repoRoot, `${sha}^`);
    const todo = commits.map((line) =>
      line.sha === sha ? { ...line, action: "reword" as const } : line,
    );
    await runWithEditors(execGit, repoRoot, `${sha}^`, todo, { messagePath });
  }

  async function rewriteCommit(
    repoRoot: string,
    sha: string,
    action: "squash" | "fixup" | "drop",
  ): Promise<void> {
    if (action === "drop") {
      await dropCommit(repoRoot, sha);
      return;
    }

    const commits = await listCommitsSince(repoRoot, `${sha}^`);
    const todo = commits.map((line) =>
      line.sha === sha ? { ...line, action } : line,
    );
    await runWithEditors(execGit, repoRoot, `${sha}^`, todo);
  }

  async function continueRebase(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["rebase", "--continue"], {
      env: nonInteractiveContinueEnv,
    });
  }

  async function skipRebase(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["rebase", "--skip"]);
  }

  async function abortRebase(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["rebase", "--abort"]);
  }

  return {
    dropCommit,
    editMessage,
    rewriteCommit,
    continueRebase,
    skipRebase,
    abortRebase,
    listCommitsSince,
  };
}