import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { hasLeftoverMarkers } from "../../core/markers";
import {
  ensureConflictFixture,
  gitPorcelain,
  hasUnmergedStages,
  isResolvedInIndex,
  readRepoFile,
} from "../../test/helpers/conflictRepoFixture";
import { DEFAULT_GITVIEW_SETTINGS } from "../../types/settings";
import type { HostToWebview } from "../../shared/protocol";
import {
  resolvedAcceptOurs,
  makeHandler,
  freshRepo,
  cleanupMergeResolveHost,
  type MergeResolveHostContext,
} from "./mergeResolveHost.helpers";

describe("merge resolve host integration — markResolved (TQ-1)", () => {
  const ctx: MergeResolveHostContext = {
    repoRoot: "",
    tempParent: "",
    tempParents: [],
  };

  beforeAll(async () => {
    await ensureConflictFixture();
  }, 120_000);

  afterEach(async () => {
    await cleanupMergeResolveHost(ctx);
  });

  it("merge.save writes worktree content but keeps the file unmerged and unstaged", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent, {
      ...DEFAULT_GITVIEW_SETTINGS,
      autoStageOnResolved: true,
    });

    expect(await hasUnmergedStages(root, "file.txt")).toBe(true);

    const saved = "line1\nsaved worktree\nline3\n";
    sent.length = 0;
    await handler({
      type: "merge.save", path: "file.txt", content: saved,
    });

    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "merge.saved",
          ok: true,
          payload: {
            path: "file.txt",
            hint: "Saved. Use Apply to finish resolving this file.",
          },
        }),
      ]),
    );
    expect(await readRepoFile(root, "file.txt")).toBe(saved);
    expect(await hasUnmergedStages(root, "file.txt")).toBe(true);
    expect(await isResolvedInIndex(root, "file.txt")).toBe(false);
    const status = await gitPorcelain(root);
    expect(status).toMatch(/^UU\s+file\.txt/m);
  });

  it("merge.markResolved is a no-op when host confirm is declined", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(
      root,
      sent,
      {
        ...DEFAULT_GITVIEW_SETTINGS,
        confirmBeforeMarkResolved: true,
      },
      { confirmMarkResolved: async () => false },
    );

    await handler({ type: "merge.openFile", path: "file.txt" });
    const docMsg = sent.find((m) => m.type === "merge.document");
    if (docMsg?.type !== "merge.document") {
      throw new Error("expected merge.document");
    }
    const content = resolvedAcceptOurs(docMsg.payload);

    sent.length = 0;
    await handler({
      type: "merge.markResolved",
      path: "file.txt",
      content,
    });

    expect(
      sent.some(
        (m) =>
          m.type === "error" &&
          m.ok === false &&
          (m as { error?: { code?: string } }).error?.code ===
            "CONFIRMATION_REQUIRED",
      ),
    ).toBe(true);
    const onDisk = await readRepoFile(root, "file.txt");
    expect(onDisk).toContain("<<<<<<<");
  });

  it("merge.markResolved writes resolved content and stages when autoStageOnResolved is true", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent, {
      ...DEFAULT_GITVIEW_SETTINGS,
      autoStageOnResolved: true,
    });

    await handler({
      type: "merge.openFile", path: "file.txt",
    });

    const docMsg = sent.find((m) => m.type === "merge.document");
    expect(docMsg?.type).toBe("merge.document");
    if (docMsg?.type !== "merge.document") {
      return;
    }

    const resolved = resolvedAcceptOurs(docMsg.payload);
    expect(hasLeftoverMarkers(resolved)).toBe(false);
    expect(resolved).toBe("line1\ntheirs change\nline3\n");

    sent.length = 0;
    await handler({
      type: "merge.markResolved", path: "file.txt", content: resolved,
    });

    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "merge.resolved",
          ok: true,
          payload: { path: "file.txt" },
        }),
      ]),
    );

    const onDisk = await readRepoFile(root, "file.txt");
    expect(onDisk).toBe(resolved);
    expect(onDisk).not.toMatch(/<<<<<<<|=======|>>>>>>>/);

    expect(await hasUnmergedStages(root, "file.txt")).toBe(false);
    expect(await isResolvedInIndex(root, "file.txt")).toBe(true);
    const status = await gitPorcelain(root);
    expect(status).not.toMatch(/^UU\s+file\.txt/m);
  });

  it("merge.markResolved writes resolved content but leaves index unmerged when autoStageOnResolved is false", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent, {
      ...DEFAULT_GITVIEW_SETTINGS,
      autoStageOnResolved: false,
    });

    await handler({
      type: "merge.openFile", path: "file.txt",
    });

    const docMsg = sent.find((m) => m.type === "merge.document");
    expect(docMsg?.type).toBe("merge.document");
    if (docMsg?.type !== "merge.document") {
      return;
    }

    const resolved = resolvedAcceptOurs(docMsg.payload);

    await handler({
      type: "merge.markResolved", path: "file.txt", content: resolved,
    });

    const onDisk = await readRepoFile(root, "file.txt");
    expect(onDisk).toBe(resolved);

    const status = await gitPorcelain(root);
    expect(status).toMatch(/^UU\s+file\.txt/m);
  });

  it("merge.markResolved with traversal path does not mutate the conflicted file", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await handler({
      type: "merge.markResolved",
      path: "../outside",
      content: "line1\ntheirs change\nline3\n",
    });

    expect(sent[0]).toMatchObject({
      type: "error",
      ok: false,
      error: { code: "INVALID_PATH" },
    });

    const onDisk = await readRepoFile(root, "file.txt");
    expect(onDisk).toMatch(/<<<<<<<|=======|>>>>>>>/);
  });

  it("merge.markResolved with leftover markers does not mutate disk", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);
    const before = await readRepoFile(root, "file.txt");

    await handler({
      type: "merge.markResolved",
      path: "file.txt",
      content:
        "line1\n<<<<<<< HEAD\nbroken\n=======\nx\n>>>>>>> feature\n",
    });

    expect(sent[0]).toMatchObject({
      type: "error",
      ok: false,
      error: { code: "MARKERS_REMAIN" },
    });
    expect(await readRepoFile(root, "file.txt")).toBe(before);
    expect(await hasUnmergedStages(root, "file.txt")).toBe(true);
  });
});