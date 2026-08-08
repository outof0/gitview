import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import type { BlamePreviewPayload, HistoryInitPayload } from "@gitview/shared/types/history";
import type { BlameSnapshot } from "@gitview/shared/types/blame";
import type { LogSnapshot } from "@gitview/shared/types/log";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";

export function isHistoryInit(
  value: unknown,
): value is { type: "history.init"; payload: HistoryInitPayload } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "history.init" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isBlamePreview(
  value: unknown,
): value is { type: "blame.preview"; payload: BlamePreviewPayload } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "blame.preview" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isLogSnapshot(
  value: unknown,
): value is { type: "log.snapshot"; payload: LogSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "log.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isBlameSnapshotEvent(
  value: unknown,
): value is { type: "blame.snapshot"; payload: BlameSnapshot } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "blame.snapshot" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}

export function isDiffResult(
  value: unknown,
): value is { type: "diff.result"; payload: WorkspaceDiffDocument } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "diff.result" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION
  );
}