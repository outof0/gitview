import type { GitChangedFileStatus } from "@gitview/types";

/** VCS tree colors — added green, modified blue, deleted red, renamed purple. */
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
  switch (status) {
    case "A":
    case "C":
      return "text-[#73bd79]";
    case "M":
      return "text-[#7cb3ff]";
    case "D":
      return "text-[#e39494] line-through decoration-[#e39494]/70";
    case "R":
      return "text-[#c9a0ff]";
    default:
      return "text-foreground";
  }
}

export function changedFileStatusBadgeClass(
  status: GitChangedFileStatus,
): string {
  switch (status) {
    case "A":
    case "C":
      return "text-[#73bd79] font-bold";
    case "M":
      return "text-[#7cb3ff] font-bold";
    case "D":
      return "text-[#e39494] font-bold";
    case "R":
      return "text-[#c9a0ff] font-bold";
    default:
      return "text-[var(--vscode-descriptionForeground)]";
  }
}

export function changedFileRowBgClass(
  status: GitChangedFileStatus,
  selected: boolean,
  highlighted: boolean,
): string {
  if (selected) {
    return "bg-list-active text-list-activeForeground";
  }
  if (highlighted) {
    return "bg-list-active/20 hover:bg-list-hover";
  }
  switch (status) {
    case "A":
    case "C":
      return "hover:bg-[#73bd79]/10";
    case "D":
      return "hover:bg-[#e39494]/10 opacity-90";
    case "R":
      return "hover:bg-[#c9a0ff]/10";
    default:
      return "hover:bg-list-hover";
  }
}