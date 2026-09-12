import { PROTOCOL_VERSION } from "@gitview/shared/protocol";

type BranchOverlaySurface = "createBranch" | "branches";

export type BranchOverlayRequest = {
  surface: BranchOverlaySurface;
  repoId: string;
  startPoint?: string;
};

/** Host `git.openOverlay` event asking this tab to render a branch overlay. */
export function isOpenOverlayEvent(
  value: unknown,
): value is { type: "git.openOverlay"; payload: BranchOverlayRequest } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const message = value as { type?: unknown; protocolVersion?: unknown };
  if (
    message.type !== "git.openOverlay" ||
    message.protocolVersion !== PROTOCOL_VERSION
  ) {
    return false;
  }
  const payload = (value as { payload?: unknown }).payload;
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const request = payload as Record<string, unknown>;
  if (request.surface !== "createBranch" && request.surface !== "branches") {
    return false;
  }
  if (typeof request.repoId !== "string" || request.repoId.length === 0) {
    return false;
  }
  return (
    request.startPoint === undefined || typeof request.startPoint === "string"
  );
}
