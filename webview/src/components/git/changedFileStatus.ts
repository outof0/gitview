import type { GitChangedFileStatus } from "@gitview/types";
import {
  fileStatusTokenClass,
  visualStatusFromChangedLetter,
} from "../../lib/fileStatusTheme";

export function changedFileStatusLabel(status: GitChangedFileStatus): string {
  switch (status) {
    case "A":
      return "Added";
    case "M":
      return "Modified";
    case "D":
      return "Deleted";
    case "R":
      return "Renamed";
    case "C":
      return "Copied";
    default:
      return status;
  }
}

export function changedFileStatusTextClass(
  status: GitChangedFileStatus,
  selected = false,
): string {
  if (selected) {
    return "";
  }
  const visual = visualStatusFromChangedLetter(status);
  const token = fileStatusTokenClass(visual);
  return visual === "deleted" ? `${token} line-through opacity-90` : token;
}

export function changedFileStatusBadgeClass(
  status: GitChangedFileStatus,
): string {
  return `${fileStatusTokenClass(visualStatusFromChangedLetter(status))} font-bold`;
}

export function changedFileRowBgClass(
  selected: boolean,
  highlighted: boolean,
): string {
  if (selected) {
    return "bg-list-active text-list-activeForeground";
  }
  if (highlighted) {
    return "bg-list-active/20 hover:bg-list-hover";
  }
  return "hover:bg-list-hover";
}