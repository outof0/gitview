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

function shellPath(filePath: string): string {
  return process.platform === "win32" ? filePath.replaceAll("\\", "/") : filePath;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function createCopyEditor(sourcePath: string): string {
  const source = shellQuote(shellPath(sourcePath));
  return [
    "#!/bin/sh",
    `target=$(printf '%s' "$1" | sed 's#\\\\#/#g')`,
    `cp -- ${source} "$target"`,
    "",
  ].join("\n");
}

/**
 * Deletes a rebase temp directory.
 *
 * Every call site runs this in a `finally`, so throwing here would replace the
 * rebase failure the caller is about to see with an unrelated filesystem error
 * — the opposite of useful diagnostics. A leftover directory under the OS temp
 * dir leaks disk, not correctness, so the error is dropped deliberately, in
 * exactly one place, where the reason stays visible to the next reader.
 */
async function removeTempDir(dir: string): Promise<void> {
  await fs
    .rm(dir, { recursive: true, force: true })
    .catch(() => {}); // review-scope:allow silent-catch — see the doc comment
}

async function runWithEditors(
  execGit: GitExecFn,
  repoRoot: string,
  onto: string,
  todoLines: RebaseTodoLine[],
  opts?: { messagePath?: string; keepGeneratedMessage?: boolean },
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-rebase-"));
  const todoPath = path.join(dir, "todo");
  const seqEditor = path.join(dir, "seq-editor.sh");
  const todoContent = `${todoLines
    .map((line) => `${line.action} ${line.sha} ${line.subject}`)
    .join("\n")}\n`;
  await fs.writeFile(todoPath, todoContent, "utf8");
  await writeExecutable(seqEditor, createCopyEditor(todoPath));

  const env: NodeJS.ProcessEnv = {
    GIT_SEQUENCE_EDITOR: shellQuote(shellPath(seqEditor)),
  };
  if (opts?.messagePath) {
    const msgEditor = path.join(dir, "msg-editor.sh");
    await writeExecutable(msgEditor, createCopyEditor(opts.messagePath));
    env.GIT_EDITOR = shellQuote(shellPath(msgEditor));
  } else if (opts?.keepGeneratedMessage) {
    // `squash` asks git to compose a combined message. Without an editor that
    // accepts it, git opens the user's real editor and the command blocks
    // forever. Exiting without touching $1 keeps git's own message.
    const noopEditor = path.join(dir, "msg-keep.sh");
    await writeExecutable(noopEditor, "#!/bin/sh\nexit 0\n");
    env.GIT_EDITOR = shellQuote(shellPath(noopEditor));
  }

  try {
    await execGit(repoRoot, ["rebase", "-i", onto], { env });
  } finally {
    // The todo, the sequence editor and the message editor all live in this
    // temp directory. A failed or aborted rebase used to leave every one of
    // them behind, and the stale todo could be picked up by a later run.
    await removeTempDir(dir);
  }
}

export function createRebaseApi(execGit: GitExecFn) {
  /** Oldest-first. Omit `range` to read the whole history back to the root. */
  async function readTodoCommits(
    repoRoot: string,
    range?: string,
  ): Promise<RebaseTodoLine[]> {
    const args = ["log", "--reverse", `--format=%H|%s`];
    if (range) {
      args.push(range);
    }
    const { stdout } = await execGit(repoRoot, args);
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

  async function listCommitsSince(
    repoRoot: string,
    onto: string,
  ): Promise<RebaseTodoLine[]> {
    return readTodoCommits(repoRoot, `${onto}..HEAD`);
  }

  /** Parent of `sha`, or null when it does not exist (root commit). */
  async function resolveParent(
    repoRoot: string,
    sha: string,
  ): Promise<string | null> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "rev-parse",
        "--verify",
        "--quiet",
        `${sha}^`,
      ]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
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
    try {
      await runWithEditors(execGit, repoRoot, `${sha}^`, todo, { messagePath });
    } finally {
      await removeTempDir(dir);
    }
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

    const parent = await resolveParent(repoRoot, sha);
    if (!parent) {
      throw new Error(
        "This is the root commit — there is no earlier commit to squash it into.",
      );
    }

    // A squash/fixup line must have a previous commit to fold into, so the
    // target can never be the first line of the todo. Rebasing onto `sha^` made
    // it the first line every single time and git rejected the todo outright
    // with "cannot 'squash' without a previous commit". The range has to start
    // one commit earlier so the parent is picked first.
    const grandparent = await resolveParent(repoRoot, parent);
    const commits = await readTodoCommits(
      repoRoot,
      grandparent ? `${grandparent}..HEAD` : undefined,
    );
    const todo = commits.map((line) =>
      line.sha === sha ? { ...line, action } : line,
    );
    await runWithEditors(execGit, repoRoot, grandparent ?? "--root", todo, {
      keepGeneratedMessage: action === "squash",
    });
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
