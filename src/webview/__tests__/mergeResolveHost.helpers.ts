import * as fs from "fs/promises";
import * as path from "path";
import {
  acceptOurs,
  acceptSide,
  ignoreSide,
  appendSide,
} from "../../core/resolve";
import { reflowResultRanges, serializeResult } from "../../core/serialize";
import type { ChangeBlock } from "../../core/types";
import type { MergeDocument } from "../../core/types";
import { createFileService } from "../../services/fileService";
import { defaultExecGit } from "../../services/git/exec";
import { createProtectionService } from "../../services/protectionService";
import { createRepositoryService } from "../../services/repositoryService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import { copyConflictRepo } from "../../test/helpers/conflictRepoFixture";
import { DEFAULT_GITVIEW_SETTINGS } from "../../types/settings";
import {
  PROTOCOL_VERSION,
  type HostToWebview,
} from "../../shared/protocol";
import { createMessageRouter } from "../../webviewHost/messageRouter";

export const files = createFileService();

export function resolvedAcceptOurs(doc: MergeDocument): string {
  let blocks = doc.blocks.map((b) =>
    b.kind === "conflict" ? acceptOurs(b) : b,
  );
  blocks = reflowResultRanges(blocks);
  return serializeResult(blocks, doc.eol, doc.hasFinalNewline);
}

export function resolveBlocksMixed(blocks: ChangeBlock[]): ChangeBlock[] {
  let resolved = [...blocks];
  const conflicts = resolved.filter((b) => b.kind === "conflict");
  if (conflicts.length >= 1) {
    resolved = resolved.map((b) =>
      b.id === conflicts[0]!.id ? acceptSide(b, "ours") : b,
    );
    const updated = resolved.find((b) => b.id === conflicts[0]!.id)!;
    resolved = resolved.map((b) =>
      b.id === conflicts[0]!.id ? ignoreSide(updated, "theirs") : b,
    );
  }
  if (conflicts.length >= 2) {
    resolved = resolved.map((b) =>
      b.id === conflicts[1]!.id ? acceptSide(b, "theirs") : b,
    );
    const updated = resolved.find((b) => b.id === conflicts[1]!.id)!;
    resolved = resolved.map((b) =>
      b.id === conflicts[1]!.id ? appendSide(updated, "ours") : b,
    );
  }
  return reflowResultRanges(resolved);
}

/** Convenience v1 merge/conflict requests used by host integration tests. */
export type MergeHostTestRequest =
  | { type: "merge.openFile"; path: string }
  | { type: "merge.save"; path: string; content: string }
  | { type: "merge.markResolved"; path: string; content: string }
  | { type: "conflict.acceptLocal"; path: string }
  | { type: "conflict.acceptIncoming"; path: string }
  | { type: "conflict.applyNonConflicting" }
  | { type: "conflict.refresh" };

export function makeHandler(
  repoRoot: string,
  sent: HostToWebview[],
  settings = DEFAULT_GITVIEW_SETTINGS,
  opts?: {
    confirmMarkResolved?: (message: string) => Promise<boolean>;
  },
) {
  const openedMergePaths = new Set<string>();
  const execGit = defaultExecGit;
  const repositoryService = createRepositoryService({
    execGit,
    discoverGitRoots: async () => [repoRoot],
  });
  const refreshCoordinator = createRefreshCoordinator({
    execGit,
    repositoryService,
    getWorkspaceFolders: () => [{ uriPath: repoRoot, name: "repo" }],
    getTrusted: () => true,
  });

  const router = createMessageRouter({
    execGit,
    repositoryService,
    protectionService: createProtectionService([]),
    refreshCoordinator,
    trusted: true,
    workspaceFolders: [{ uriPath: repoRoot, name: "repo" }],
    postMessage: (msg) => sent.push(msg),
    mergePanel: {
      fileService: files,
      openedMergePaths,
      getSettings: () => settings,
      confirmMarkResolved: opts?.confirmMarkResolved,
    },
  });

  let requestCounter = 0;

  return async function handleRequest(
    msg: MergeHostTestRequest,
  ): Promise<void> {
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: repoRoot, name: "repo" }],
      trusted: true,
    });
    const repoId = repos[0]?.id;
    if (!repoId) {
      throw new Error("Test repository not discovered");
    }

    requestCounter += 1;
    const requestId = `test-${requestCounter}`;
    const base = {
      protocolVersion: PROTOCOL_VERSION,
      requestId,
    } as const;

    switch (msg.type) {
      case "merge.openFile":
        await router.handleRawMessage({
          ...base,
          type: "merge.openFile",
          payload: { repoId, path: msg.path },
        });
        return;
      case "merge.save":
        await router.handleRawMessage({
          ...base,
          type: "merge.save",
          payload: { repoId, path: msg.path, content: msg.content },
        });
        return;
      case "merge.markResolved":
        await router.handleRawMessage({
          ...base,
          type: "merge.markResolved",
          payload: { repoId, path: msg.path, content: msg.content },
        });
        return;
      case "conflict.acceptLocal":
        await router.handleRawMessage({
          ...base,
          type: "conflict.acceptLocal",
          payload: { repoId, paths: [msg.path] },
        });
        return;
      case "conflict.acceptIncoming":
        await router.handleRawMessage({
          ...base,
          type: "conflict.acceptIncoming",
          payload: { repoId, paths: [msg.path] },
        });
        return;
      case "conflict.applyNonConflicting":
        await router.handleRawMessage({
          ...base,
          type: "conflict.applyNonConflicting",
          payload: { repoId },
        });
        return;
      case "conflict.refresh":
        await router.handleRawMessage({
          ...base,
          type: "conflict.refresh",
          payload: { repoId },
        });
        return;
      default: {
        const _exhaustive: never = msg;
        throw new Error(`Unsupported merge host test request: ${JSON.stringify(_exhaustive)}`);
      }
    }
  };
}

export type MergeResolveHostContext = {
  repoRoot: string;
  tempParent: string;
  tempParents: string[];
};

export async function freshRepo(ctx: MergeResolveHostContext): Promise<string> {
  ctx.repoRoot = await copyConflictRepo();
  ctx.tempParent = path.dirname(ctx.repoRoot);
  return ctx.repoRoot;
}

export async function cleanupMergeResolveHost(
  ctx: MergeResolveHostContext,
): Promise<void> {
  for (const parent of ctx.tempParents) {
    await fs.rm(parent, { recursive: true, force: true });
  }
  ctx.tempParents.length = 0;
  if (ctx.tempParent) {
    await fs.rm(ctx.tempParent, { recursive: true, force: true });
    ctx.tempParent = "";
    ctx.repoRoot = "";
  }
}
