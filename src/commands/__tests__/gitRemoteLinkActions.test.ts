import "./gitMenuActions.testSetup";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as vscode from "vscode";
import {
  gitCopyRemoteLink,
  gitCopyRemoteLinkMarkdown,
  gitOpenOnRemote,
} from "../gitMenuRemoteLinkActions";
import type { GitCommandRuntime } from "../gitMenuActionsHelpers";

const FULL_SHA = "a".repeat(40);

function execFor(outputs: Record<string, string>) {
  return async (_repoRoot: string, args: string[]) => {
    const key = args.join(" ");
    if (key in outputs) {
      return { stdout: outputs[key]!, stderr: "" };
    }
    throw new Error(`unexpected git call: ${key}`);
  };
}

function runtimeFor(
  outputs: Record<string, string>,
  findRepoRoot: () => Promise<string | null> = async () => "/repo",
): GitCommandRuntime {
  return {
    gitService: {
      execGit: execFor(outputs),
      findRepoRoot,
    },
  } as unknown as GitCommandRuntime;
}

function mockSettings(settings: Record<string, string>): void {
  vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
    get: (key: string, fallback?: unknown) =>
      key in settings ? settings[key] : fallback,
  } as unknown as vscode.WorkspaceConfiguration);
}

const resource = vscode.Uri.file("/repo/src/app.ts");
const baseOutputs = {
  "remote get-url origin": "git@github.com:owner/repo.git\n",
  "rev-parse HEAD": `${FULL_SHA}\n`,
  "branch --show-current": "main\n",
};

describe("gitMenuRemoteLinkActions", () => {
  beforeEach(() => {
    mockSettings({});
  });

  it("refuses a file url when neither HEAD nor its branch is pushed", async () => {
    const runtime = runtimeFor({ ...baseOutputs });
    await gitOpenOnRemote(resource, undefined, runtime);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("Push the current branch or commit"),
    );
    expect(vscode.env.openExternal).not.toHaveBeenCalled();
  });

  it("pins the commit sha when HEAD is on the remote", async () => {
    const runtime = runtimeFor({
      ...baseOutputs,
      [`branch -r --contains ${FULL_SHA} --format=%(refname)`]:
        "refs/remotes/origin/main\n",
    });
    await gitCopyRemoteLink(resource, undefined, runtime);
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      `https://github.com/owner/repo/blob/${FULL_SHA}/src/app.ts`,
    );
  });

  it("copies markdown with a file label", async () => {
    const runtime = runtimeFor({
      ...baseOutputs,
      "for-each-ref --format=%(refname) refs/remotes/origin":
        "refs/remotes/origin/main\n",
    });
    await gitCopyRemoteLinkMarkdown(resource, undefined, runtime);
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      "[src/app.ts](https://github.com/owner/repo/blob/main/src/app.ts)",
    );
  });

  it("links a commit sha from history menus", async () => {
    const runtime = runtimeFor({ ...baseOutputs });
    await gitCopyRemoteLink(undefined, undefined, runtime, {
      commitSha: "abc1234",
    });
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      "https://github.com/owner/repo/commit/abc1234",
    );
  });

  it("pins a file to the commit sha from history file menus", async () => {
    const runtime = runtimeFor({ ...baseOutputs });
    await gitCopyRemoteLink(resource, undefined, runtime, {
      commitSha: "abc1234",
    });
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      "https://github.com/owner/repo/blob/abc1234/src/app.ts",
    );
  });

  it("warns when no remote is configured", async () => {
    const runtime = runtimeFor({});
    await gitCopyRemoteLink(resource, undefined, runtime);
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('No remote "origin"'),
    );
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("honours the configured remote name", async () => {
    mockSettings({ remoteName: "upstream" });
    const runtime = runtimeFor({
      "remote get-url upstream": "https://gitlab.com/g/r.git\n",
      "rev-parse HEAD": `${FULL_SHA}\n`,
      "branch --show-current": "main\n",
      "for-each-ref --format=%(refname) refs/remotes/upstream":
        "refs/remotes/upstream/main\n",
    });
    await gitCopyRemoteLink(resource, undefined, runtime);
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      `https://gitlab.com/g/r/-/blob/main/src/app.ts`,
    );
  });

  it("includes the editor line selection in file links", async () => {
    const window = vscode.window as unknown as {
      activeTextEditor:
        | {
            document: { uri: unknown };
            selection: { anchor: { line: number }; active: { line: number } };
          }
        | undefined;
    };
    const previous = window.activeTextEditor;
    window.activeTextEditor = {
      document: { uri: resource },
      selection: { anchor: { line: 6 }, active: { line: 4 } },
    };
    try {
      const runtime = runtimeFor({
        ...baseOutputs,
        "for-each-ref --format=%(refname) refs/remotes/origin":
          "refs/remotes/origin/main\n",
      });
      await gitCopyRemoteLink(resource, undefined, runtime);
      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
        "https://github.com/owner/repo/blob/main/src/app.ts#L5-L7",
      );
    } finally {
      window.activeTextEditor = previous;
    }
  });

  it("links directories", async () => {
    const runtime = runtimeFor({
      ...baseOutputs,
      "for-each-ref --format=%(refname) refs/remotes/origin":
        "refs/remotes/origin/main\n",
    });
    await gitCopyRemoteLink(resource, undefined, runtime, { isFolder: true });
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      "https://github.com/owner/repo/tree/main/src/app.ts",
    );
  });

  it("warns when no repository is found", async () => {
    const runtime = runtimeFor({ ...baseOutputs }, async () => null);
    await gitCopyRemoteLink(resource, undefined, runtime);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("could not find a Git repository"),
    );
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("errors when no url can be built", async () => {
    const runtime = runtimeFor({ ...baseOutputs });
    await gitCopyRemoteLink(undefined, "/repo", runtime, { commitSha: "zzz" });
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("Could not build a remote link"),
    );
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });
});
