import { createError } from "../shared/errors/codes";
import {
  PROTOCOL_VERSION,
  createHostError,
  createHostResponse,
  type WebviewToHost,
} from "../shared/protocol";
import type { Repository } from "../shared/types/repository";
import type { StatusSnapshot } from "../shared/types/status";
import { buildRepoStatusSnapshot } from "../services/statusSnapshot";
import { readGitWorkspaceSettings } from "../config/readGitWorkspaceSettings";
import type { MessageRouterContext } from "./messageRouterContext";
import { isWorkspaceTrusted } from "./messageRouterTrust";

async function buildStatusForRepository(
  ctx: MessageRouterContext,
  repo: Repository,
  includeIgnored?: boolean,
): Promise<StatusSnapshot> {
  return buildRepoStatusSnapshot(ctx.statusApi, repo.rootPath, repo.id, {
    includeIgnored,
    changelistStorage: ctx.deps.changelistStorage,
    mode: readGitWorkspaceSettings().mode,
  });
}

export async function dispatchRepo(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { deps } = ctx;
  switch (request.type) {
    case "webview.ready":
      deps.postMessage(
        createHostResponse(request.requestId, "webview.ready", {
          surface: request.payload.surface,
          settings: readGitWorkspaceSettings(),
        }),
      );
      return true;

    case "workspace.collapsePanel": {
      if (!deps.executeWorkspaceCommand) {
        deps.postMessage(
          createHostError(
            request.requestId,
            createError("NOT_IMPLEMENTED", "Workspace action is unavailable."),
          ),
        );
        return true;
      }
      await deps.executeWorkspaceCommand("collapsePanel");
      deps.postMessage(
        createHostResponse(request.requestId, "workspace.collapsePanel", {
          collapsed: true,
        }),
      );
      return true;
    }

    case "workspace.openFolder":
    case "workspace.clone":
    case "workspace.manageTrust":
    case "repository.addRemote": {
      const command =
        request.type === "workspace.openFolder"
          ? "openFolder"
          : request.type === "workspace.clone"
            ? "clone"
            : request.type === "workspace.manageTrust"
              ? "manageTrust"
              : "addRemote";
      if (!deps.executeWorkspaceCommand) {
        deps.postMessage(
          createHostError(
            request.requestId,
            createError("NOT_IMPLEMENTED", "Workspace action is unavailable."),
          ),
        );
        return true;
      }
      await deps.executeWorkspaceCommand(command);
      if (request.type === "workspace.openFolder") {
        deps.postMessage(
          createHostResponse(request.requestId, "workspace.openFolder", {
            opened: true,
          }),
        );
      } else if (request.type === "workspace.clone") {
        deps.postMessage(
          createHostResponse(request.requestId, "workspace.clone", {
            opened: true,
          }),
        );
      } else if (request.type === "workspace.manageTrust") {
        deps.postMessage(
          createHostResponse(request.requestId, "workspace.manageTrust", {
            opened: true,
          }),
        );
      } else {
        deps.postMessage(
          createHostResponse(request.requestId, "repository.addRemote", {
            opened: true,
          }),
        );
      }
      return true;
    }

    case "repo.refresh": {
      const repos = await deps.repositoryService.discoverRepositories({
        workspaceFolders: deps.workspaceFolders,
        trusted: isWorkspaceTrusted(deps),
      });
      const active = request.payload.repoId ?? repos[0]?.id ?? null;
      const snapshot = deps.repositoryService.buildSnapshot(repos, active);
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "repo.snapshot",
        payload: snapshot,
        requestId: request.requestId,
      });

      // A refresh is an aggregate UI operation, not repository discovery
      // alone. Sending the active status after the webview-initiated
      // handshake prevents initial status from being lost while HTML boots.
      const activeRepo = snapshot.activeRepoId
        ? repos.find((repo) => repo.id === snapshot.activeRepoId)
        : undefined;
      if (activeRepo) {
        deps.postMessage({
          protocolVersion: PROTOCOL_VERSION,
          type: "status.snapshot",
          payload: await buildStatusForRepository(ctx, activeRepo),
          requestId: request.requestId,
        });
      }
      deps.postMessage(
        createHostResponse(request.requestId, "repo.refresh", {
          refreshed: true,
        }),
      );
      return true;
    }

    case "status.list": {
      const repos = await deps.repositoryService.discoverRepositories({
        workspaceFolders: deps.workspaceFolders,
        explicitRepoId: request.payload.repoId,
        trusted: isWorkspaceTrusted(deps),
      });
      const repo = deps.repositoryService.resolveRepositoryForResource(
        repos,
        undefined,
        request.payload.repoId,
      );
      if (!repo) {
        deps.postMessage(
          createHostError(
            request.requestId,
            createError(
              "REPOSITORY_NOT_FOUND",
              "Repository not found for status request.",
            ),
          ),
        );
        return true;
      }
      const snapshot = await buildStatusForRepository(
        ctx,
        repo,
        request.payload.includeIgnored,
      );
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "status.snapshot",
        payload: snapshot,
        requestId: request.requestId,
      });
      deps.postMessage(
        createHostResponse(request.requestId, "status.list", snapshot),
      );
      return true;
    }
    default:
      return false;
  }
}
