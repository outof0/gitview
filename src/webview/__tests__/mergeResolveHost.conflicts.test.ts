import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  ensureConflictFixture,
  gitPorcelain,
  hasUnmergedStages,
  isResolvedInIndex,
  readRepoFile,
  seedNonConflictingUnmerged,
} from "../../test/helpers/conflictRepoFixture";
import type { HostToWebview } from "../../shared/protocol";
import {
  makeHandler,
  freshRepo,
  cleanupMergeResolveHost,
  type MergeResolveHostContext,
} from "./mergeResolveHost.helpers";

describe("merge resolve host integration — conflicts (TQ-1)", () => {
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

  it("conflict.acceptLocal resolves file.txt on disk and stages index", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await handler({
      type: "conflict.acceptLocal", path: "file.txt",
    });

    const onDisk = await readRepoFile(root, "file.txt");
    expect(onDisk).not.toMatch(/<<<<<<<|=======|>>>>>>>/);
    expect(onDisk).toContain("theirs change");
    expect(await isResolvedInIndex(root, "file.txt")).toBe(true);
    const status = await gitPorcelain(root);
    expect(status).not.toMatch(/^UU\s+file\.txt/m);
  });

  it("conflict.acceptIncoming resolves file.txt with theirs content", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await handler({
      type: "conflict.acceptIncoming", path: "file.txt",
    });

    const onDisk = await readRepoFile(root, "file.txt");
    expect(onDisk).not.toMatch(/<<<<<<<|=======|>>>>>>>/);
    expect(onDisk).toContain("ours change");
    expect(await isResolvedInIndex(root, "file.txt")).toBe(true);
  });

  it("conflict.applyNonConflicting writes and stages files with only non-conflicting changes", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await seedNonConflictingUnmerged(
      root,
      "nonconflict.txt",
      {
        base: "line1\nline2\nline3\n",
        ours: "line1\nours-nc\nline3\n",
        theirs: "line1\nline2\nline3\n",
      },
      "line1\n<<<<<<< HEAD\nours-nc\n=======\nline2\n>>>>>>> feature\nline3\n",
    );

    await handler({ type: "conflict.applyNonConflicting" });

    expect(await readRepoFile(root, "nonconflict.txt")).toBe(
      "line1\nours-nc\nline3\n",
    );
    expect(await isResolvedInIndex(root, "nonconflict.txt")).toBe(true);
    expect(await hasUnmergedStages(root, "file.txt")).toBe(true);
    const status = await gitPorcelain(root);
    expect(status).toMatch(/^UU\s+file\.txt/m);
    expect(status).not.toMatch(/^UU\s+nonconflict\.txt/m);
  }, 15_000);

  it("conflict.applyNonConflicting leaves real conflict files unmerged", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await handler({ type: "conflict.applyNonConflicting" });

    const status = await gitPorcelain(root);
    expect(status).toMatch(/^UU\s+file\.txt/m);
    expect(await readRepoFile(root, "file.txt")).toMatch(
      /<<<<<<<|=======|>>>>>>>/,
    );
  }, 15_000);
});