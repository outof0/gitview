import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { FileDiffView } from "@gitview/types";
import type { DiffLineHighlight } from "../buildDiffDisplayRows";
import type { WhitespacePolicy } from "../../../stores/gitViewStore";

export const WHITESPACE_LABELS: Record<WhitespacePolicy, string> = {
  doNotIgnore: "Do not ignore",
  ignoreWhitespaces: "Ignore whitespaces",
  trimWhitespaces: "Trim whitespaces",
};

export function toFileDiffView(doc: WorkspaceDiffDocument): FileDiffView {
  return {
    layout: doc.layout,
    status: doc.status,
    left: doc.left,
    right: doc.right,
    binary: doc.binary,
  };
}

/** CSS class for intentional change fills only (not plain code rows). */
export function highlightClass(side: DiffLineHighlight): string {
  switch (side) {
    case "removed":
      return "nx-hl-removed";
    case "added":
      return "nx-hl-added";
    case "changed":
      return "nx-hl-changed";
    default:
      return "nx-hl-none";
  }
}