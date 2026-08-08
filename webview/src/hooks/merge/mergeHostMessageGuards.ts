import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import type {
  ConflictSnapshot,
  MergeInitPayload,
} from "@gitview/shared/types/merge";
import type { GitViewSettings } from "@gitview/types";
import type { MergeDocument } from "../../../../src/core/types";
import type { StandaloneDiffPreview } from "@gitview/shared/types/diff";

type HostMessage = {
  protocolVersion?: number;
  type?: string;
  payload?: unknown;
};

function isHostMessage(data: unknown): data is HostMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as HostMessage).protocolVersion === PROTOCOL_VERSION &&
    typeof (data as HostMessage).type === "string"
  );
}

export function isMergeInit(
  data: unknown,
): data is { type: "merge.init"; payload: MergeInitPayload } {
  return isHostMessage(data) && data.type === "merge.init";
}

export function isMergeSettings(
  data: unknown,
): data is { type: "merge.settings"; payload: GitViewSettings } {
  return isHostMessage(data) && data.type === "merge.settings";
}

export function isMergeShowConflictList(
  data: unknown,
): data is { type: "merge.showConflictList" } {
  return isHostMessage(data) && data.type === "merge.showConflictList";
}

export function isConflictSnapshot(
  data: unknown,
): data is { type: "conflict.snapshot"; payload: ConflictSnapshot } {
  return isHostMessage(data) && data.type === "conflict.snapshot";
}

export function isMergeDocument(
  data: unknown,
): data is { type: "merge.document"; payload: MergeDocument } {
  return isHostMessage(data) && data.type === "merge.document";
}

export function isDiffPreview(
  data: unknown,
): data is { type: "diff.preview"; payload: StandaloneDiffPreview } {
  return isHostMessage(data) && data.type === "diff.preview";
}

export function isBlameAnnotateRequest(
  data: unknown,
): data is {
  type: "blame.annotateRequest";
  payload: { relativePath: string; side: "ours" | "theirs" };
} {
  return isHostMessage(data) && data.type === "blame.annotateRequest";
}

export function isBlameSnapshot(
  data: unknown,
): data is { type: "blame.snapshot"; payload: import("@gitview/shared/types/blame").BlameSnapshot } {
  return isHostMessage(data) && data.type === "blame.snapshot";
}