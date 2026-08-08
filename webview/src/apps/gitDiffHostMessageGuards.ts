import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import type { StandaloneDiffPreview } from "@gitview/shared/types/diff";

export function isDiffPreview(
  value: unknown,
): value is { type: "diff.preview"; payload: StandaloneDiffPreview } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "diff.preview" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION &&
    typeof (value as { payload?: { relativePath?: string } }).payload?.relativePath ===
      "string"
  );
}

export function isErrorNotification(
  value: unknown,
): value is {
  type: "notification";
  payload: { level: "error"; message: string };
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "notification" &&
    (value as { protocolVersion?: number }).protocolVersion === PROTOCOL_VERSION &&
    (value as { payload?: { level?: string } }).payload?.level === "error" &&
    typeof (value as { payload?: { message?: string } }).payload?.message === "string"
  );
}