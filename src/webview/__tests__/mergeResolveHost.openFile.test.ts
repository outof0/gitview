import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { serializeResult } from "../../core/serialize";
import { hasLeftoverMarkers } from "../../core/markers";
import {
  copyConflictRepo,
  ensureConflictFixture,
  isResolvedInIndex,
  hasUnmergedStages,
  readRepoFile,
  seedBinaryUnmerged,
} from "../../test/helpers/conflictRepoFixture";
import { DEFAULT_GITVIEW_SETTINGS } from "../../types/settings";
import type { HostToWebview } from "../../shared/protocol";
import {
  resolvedAcceptOurs,
  resolveBlocksMixed,
  makeHandler,
  freshRepo,
  cleanupMergeResolveHost,
  type MergeResolveHostContext,
} from "./mergeResolveHost.helpers";

describe("merge resolve host integration — openFile (TQ-1)", () => {
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

  it("merge.markResolved on utils.js writes mixed-resolution content", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent, {
      ...DEFAULT_GITVIEW_SETTINGS,
      autoStageOnResolved: true,
    });

    await handler({
      type: "merge.openFile", path: "utils.js",
    });

    const docMsg = sent.find((m) => m.type === "merge.document");
    expect(docMsg?.type).toBe("merge.document");
    if (docMsg?.type !== "merge.document") {
      return;
    }

    const resolved = serializeResult(
      resolveBlocksMixed(docMsg.payload.blocks),
      docMsg.payload.eol,
      docMsg.payload.hasFinalNewline,
    );
    expect(hasLeftoverMarkers(resolved)).toBe(false);

    sent.length = 0;
    await handler({
      type: "merge.markResolved", path: "utils.js", content: resolved,
    });

    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "merge.resolved",
          ok: true,
          payload: { path: "utils.js" },
        }),
      ]),
    );

    const onDisk = await readRepoFile(root, "utils.js");
    expect(onDisk).toBe(resolved);
    expect(onDisk).not.toMatch(/<<<<<<<|=======|>>>>>>>/);
    expect(hasLeftoverMarkers(onDisk)).toBe(false);
    expect(await isResolvedInIndex(root, "utils.js")).toBe(true);
  });

  it("merge.markResolved only mutates the selected workspace repo in multi-root setups", async () => {
    const rootA = await copyConflictRepo();
    ctx.tempParents.push(path.dirname(rootA));

    const rootB = await copyConflictRepo();
    ctx.tempParents.push(path.dirname(rootB));

    const beforeB = await readRepoFile(rootB, "file.txt");
    const sent: HostToWebview[] = [];
    const handler = makeHandler(rootA, sent);

    await handler({
      type: "merge.openFile", path: "file.txt",
    });
    const docMsg = sent.find((m) => m.type === "merge.document");
    expect(docMsg?.type).toBe("merge.document");
    if (docMsg?.type !== "merge.document") {
      return;
    }
    const resolved = resolvedAcceptOurs(docMsg.payload);
    sent.length = 0;

    await handler({
      type: "merge.markResolved", path: "file.txt", content: resolved,
    });

    expect(await isResolvedInIndex(rootA, "file.txt")).toBe(true);
    expect(await hasUnmergedStages(rootB, "file.txt")).toBe(true);
    expect(await readRepoFile(rootB, "file.txt")).toBe(beforeB);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "merge.resolved",
          ok: true,
          payload: { path: "file.txt" },
        }),
      ]),
    );
  });

  it("conflict.acceptLocal only mutates the selected workspace repo in multi-root setups", async () => {
    const rootA = await copyConflictRepo();
    const parentA = path.dirname(rootA);
    ctx.tempParents.push(parentA);

    const rootB = await copyConflictRepo();
    const parentB = path.dirname(rootB);
    ctx.tempParents.push(parentB);

    const beforeB = await readRepoFile(rootB, "file.txt");
    const sent: HostToWebview[] = [];
    const handler = makeHandler(rootA, sent);

    await handler({
      type: "conflict.acceptLocal", path: "file.txt",
    });

    expect(await isResolvedInIndex(rootA, "file.txt")).toBe(true);
    expect(await hasUnmergedStages(rootB, "file.txt")).toBe(true);
    expect(await readRepoFile(rootB, "file.txt")).toBe(beforeB);
    expect(await readRepoFile(rootA, "file.txt")).toContain("theirs change");
  });

  it("merge.openFile opens AA add/add file with empty-base semantics", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await handler({
      type: "merge.openFile", path: "edge/aa-file.ts",
    });

    const docMsg = sent.find((m) => m.type === "merge.document");
    expect(docMsg).toBeDefined();
    if (docMsg?.type !== "merge.document") {
      return;
    }
    expect(docMsg.payload.special).toBe("add_add");
    expect(docMsg.payload.base ?? "").toBe("");
    expect(docMsg.payload.blocks.some((b) => b.kind === "conflict")).toBe(true);
  });

  it("merge.openFile opens UD modify/delete file from the fixture repo", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await handler({
      type: "merge.openFile", path: "edge/du-file.ts",
    });

    const docMsg = sent.find((m) => m.type === "merge.document");
    expect(docMsg).toBeDefined();
    if (docMsg?.type !== "merge.document") {
      return;
    }
    expect(docMsg.payload.special).toBe("modify_delete");
    expect(docMsg.payload.theirs ?? "").toBe("");
  });

  it("merge.openFile opens DU delete/modify file from the fixture repo", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    await handler({
      type: "merge.openFile", path: "edge/ud-file.ts",
    });

    const docMsg = sent.find((m) => m.type === "merge.document");
    expect(docMsg).toBeDefined();
    if (docMsg?.type !== "merge.document") {
      return;
    }
    expect(docMsg.payload.special).toBe("delete_modify");
    expect(docMsg.payload.ours ?? "").toBe("");
  });

  it("merge.openFile returns BINARY_CONFLICT without mutating binary worktree content", async () => {
    const root = await freshRepo(ctx);
    const sent: HostToWebview[] = [];
    const handler = makeHandler(root, sent);

    const base = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    const ours = Buffer.from([0x00, 0x01, 0x02, 0x04, 0x05]);
    const theirs = Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0xfb]);

    await seedBinaryUnmerged(root, "binary.dat", { base, ours, theirs });
    const before = await fs.readFile(path.join(root, "binary.dat"));

    await handler({
      type: "merge.openFile", path: "binary.dat",
    });

    expect(sent[0]).toMatchObject({
      type: "error",
      ok: false,
      error: {
        code: "BINARY_CONFLICT",
      },
    });
    expect(sent.some((m) => m.type === "merge.document")).toBe(false);

    const after = await fs.readFile(path.join(root, "binary.dat"));
    expect(after.equals(before)).toBe(true);
    expect(after.equals(ours)).toBe(true);
  });
});