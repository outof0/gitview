import { type WebviewToHost } from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchBranches(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { branches } = ctx;
  switch (request.type) {
      case "branch.list":
        await branches.list(request.requestId, request.payload.repoId);
        return true;

      case "branch.checkout":
        await branches.checkout(
          request.requestId,
          request.payload.repoId,
          request.payload.ref,
          {
            smart: request.payload.smart,
            force: request.payload.force,
          },
        );
        return true;

      case "branch.syncOperation":
        await branches.syncOperation(
          request.requestId,
          request.payload.repoId,
          request.payload.ref,
          {
            smart: request.payload.smart,
            force: request.payload.force,
            confirmed: request.payload.confirmed,
          },
        );
        return true;

      case "branch.create":
        await branches.create(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
          request.payload.startPoint,
          {
            checkout: request.payload.checkout,
            force: request.payload.force,
          },
        );
        return true;

      case "branch.rename":
        await branches.rename(
          request.requestId,
          request.payload.repoId,
          request.payload.oldName,
          request.payload.newName,
        );
        return true;

      case "branch.delete":
        await branches.delete(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
          request.payload.force,
        );
        return true;

      case "branch.push":
        await branches.push(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
          {
            remote: request.payload.remote,
            setUpstream: request.payload.setUpstream,
          },
        );
        return true;

      case "branch.favorite":
        await branches.favorite(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
        );
        return true;

      case "branch.compareCurrent":
        await branches.compareCurrent(
          request.requestId,
          request.payload.repoId,
          request.payload.ref,
          request.payload.path,
        );
        return true;

      case "branch.compareWorkingTree":
        await branches.compareWorkingTree(
          request.requestId,
          request.payload.repoId,
          request.payload.ref,
          request.payload.path,
        );
        return true;

      case "branch.compareFile":
        await branches.compareFile(
          request.requestId,
          request.payload.repoId,
          request.payload.ref,
          request.payload.path,
          request.payload.mode,
        );
        return true;

      case "branch.compareApplyFile":
        await branches.compareApplyFile(
          request.requestId,
          request.payload.repoId,
          request.payload.ref,
          request.payload.path,
          request.payload.mode,
        );
        return true;

      case "branch.merge":
        await branches.merge(
          request.requestId,
          request.payload.repoId,
          request.payload.ref,
          {
            noFf: request.payload.noFf,
            squash: request.payload.squash,
            message: request.payload.message,
            noCommit: request.payload.noCommit,
            log: request.payload.log,
          },
        );
        return true;

      case "branch.rebaseOnto":
        await branches.rebaseOnto(
          request.requestId,
          request.payload.repoId,
          request.payload.onto,
          {
            interactive: request.payload.interactive,
            from: request.payload.from,
            rebaseMerges: request.payload.rebaseMerges,
          },
        );
        return true;
    default:
      return false;
  }
}
