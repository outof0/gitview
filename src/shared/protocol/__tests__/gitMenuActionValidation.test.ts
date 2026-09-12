import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../base";
import { parseWebviewRequestResult } from "../requestValidation";

function menuAction(payload: unknown) {
  return parseWebviewRequestResult({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "menu-1",
    type: "git.menuAction",
    payload,
  });
}

describe("git.menuAction validation", () => {
  it("accepts rollback panel requests with an initial selection", () => {
    const result = parseWebviewRequestResult({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "rollback-1",
      type: "rollback.openPanel",
      payload: {
        repoId: "repo",
        path: "src/app.ts",
        selectedPaths: ["src/app.ts", "README.md"],
      },
    });
    expect(result).toMatchObject({ ok: true });
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "rollback-2",
        type: "rollback.openPanel",
        payload: {
          repoId: "repo",
          path: "src/app.ts",
          selectedPaths: ["../outside.ts"],
        },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("accepts file-scoped webview actions with a contained path", () => {
    expect(
      menuAction({ repoId: "repo", action: "openFile", relativePath: "src/app.ts" }),
    ).toMatchObject({ ok: true });
    expect(
      menuAction({ repoId: "repo", action: "showDiff", relativePath: "src/app.ts" }),
    ).toMatchObject({ ok: true });
  });

  it("accepts a contained initial selection for rollback", () => {
    expect(
      menuAction({
        repoId: "repo",
        action: "rollback",
        relativePath: "src/app.ts",
        selectedPaths: ["src/app.ts", "README.md"],
      }),
    ).toMatchObject({ ok: true });
    expect(
      menuAction({
        repoId: "repo",
        action: "rollback",
        relativePath: "src/app.ts",
        selectedPaths: ["../outside.ts"],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("accepts commit actions with a safe operand", () => {
    expect(
      menuAction({ repoId: "repo", action: "cherryPick", commitSha: "abc1234" }),
    ).toMatchObject({ ok: true });
    expect(
      menuAction({
        repoId: "repo",
        action: "getFromRevision",
        commitSha: "abc1234",
        relativePath: "src/app.ts",
      }),
    ).toMatchObject({ ok: true });
  });

  it("accepts command-only actions only without operands", () => {
    expect(menuAction({ repoId: "repo", action: "pull" })).toMatchObject({
      ok: true,
    });
    expect(
      menuAction({ repoId: "repo", action: "pull", commitSha: "abc1234" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(
      menuAction({ repoId: "repo", action: "push", relativePath: "src/app.ts" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects option-like commit SHAs", () => {
    expect(
      menuAction({ repoId: "repo", action: "cherryPick", commitSha: "--abort" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(
      menuAction({ repoId: "repo", action: "revertCommit", commitSha: "--continue" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects traversal and absolute paths", () => {
    for (const relativePath of ["../../sibling/src", "/abs/path", "../repo/file"]) {
      expect(
        menuAction({ repoId: "repo", action: "openFile", relativePath }),
      ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    }
  });

  it("requires operands for actions that need them", () => {
    expect(
      menuAction({ repoId: "repo", action: "getFromRevision", commitSha: "abc1234" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(
      menuAction({ repoId: "repo", action: "copyCommitId" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    for (const action of [
      "cherryPick",
      "revertCommit",
      "checkoutRevision",
      "compareWithLocal",
      "showRevisionDiff",
    ]) {
      expect(
        menuAction({ repoId: "repo", action }),
        `${action} without a SHA must be rejected`,
      ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
      expect(
        menuAction({
          repoId: "repo",
          action,
          commitSha: "abc1234",
          relativePath: "src/app.ts",
        }),
        `${action} with operands stays valid`,
      ).toMatchObject({ ok: true });
    }
    expect(
      menuAction({ repoId: "repo", action: "copyCommitMessage" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(
      menuAction({
        repoId: "repo",
        action: "copyCommitMessage",
        commitMessage: "subject",
      }),
    ).toMatchObject({ ok: true });
  });

  it("accepts remote-link actions with file or commit operands", () => {
    expect(
      menuAction({
        repoId: "repo",
        action: "copyRemoteLink",
        relativePath: "src/app.ts",
      }),
    ).toMatchObject({ ok: true });
    expect(
      menuAction({ repoId: "repo", action: "openOnRemote", commitSha: "abc1234" }),
    ).toMatchObject({ ok: true });
    expect(
      menuAction({
        repoId: "repo",
        action: "copyRemoteLinkMarkdown",
        commitSha: "abc1234",
        relativePath: "src/app.ts",
      }),
    ).toMatchObject({ ok: true });
    expect(
      menuAction({
        repoId: "repo",
        action: "copyRemoteLink",
        commitSha: "--abort",
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects commit operands on actions that never use them", () => {
    expect(
      menuAction({ repoId: "repo", action: "add", commitSha: "abc1234" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(
      menuAction({
        repoId: "repo",
        action: "showDiff",
        relativePath: "src/app.ts",
        commitMessage: "subject",
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });
});
