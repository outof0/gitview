import { type WebviewToHost } from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchTagsWorktrees(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { tagHandlers, worktreeHandlers } = ctx;
  switch (request.type) {
      case "tag.list":
        await tagHandlers.list(request.requestId, request.payload.repoId);
        return true;

      case "tag.createAnnotated":
        await tagHandlers.createAnnotated(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
          request.payload.message,
          request.payload.sha,
        );
        return true;

      case "tag.checkout":
        await tagHandlers.checkout(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
        );
        return true;

      case "tag.push":
        await tagHandlers.push(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
          request.payload.remote,
        );
        return true;

      case "tag.delete":
        await tagHandlers.delete(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
        );
        return true;

      case "worktree.list":
        await worktreeHandlers.list(request.requestId, request.payload.repoId);
        return true;

      case "worktree.add":
        await worktreeHandlers.add(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          {
            branch: request.payload.branch,
            newBranch: request.payload.newBranch,
          },
        );
        return true;

      case "worktree.remove":
        await worktreeHandlers.remove(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.force,
          request.payload.confirmed,
        );
        return true;

      case "worktree.open":
        await worktreeHandlers.open(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
        );
        return true;
    default:
      return false;
  }
}
