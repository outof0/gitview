import { Download, FileDiff, FolderOpen, History } from "lucide-react";
import type { GitMenuAction } from "@gitview/types";
import { MenuDivider, MenuItem, MenuSectionHeader } from "../ui/MenuItem";

type GitHistoryFileMenuItemsProps = {
  filePath: string;
  commitSha: string | null;
  onGitAction: (action: GitMenuAction) => void;
  onShowDiff: () => void;
  onClose: () => void;
};

const ICON = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };

/** History tab — changed file right-click menu. */
export function GitHistoryFileMenuItems({
  filePath: _filePath,
  commitSha,
  onGitAction,
  onShowDiff,
  onClose,
}: GitHistoryFileMenuItemsProps) {
  const run = (action: GitMenuAction) => {
    onClose();
    onGitAction(action);
  };

  return (
    <>
      <MenuSectionHeader label="File" />
      <MenuItem
        label="Show Diff"
        onClick={() => {
          onClose();
          onShowDiff();
        }}
        testId="git-history-file-menu-show-diff"
        icon={<FileDiff {...ICON} />}
      />
      <MenuItem
        label="Open File"
        onClick={() => run("openFile")}
        testId="git-history-file-menu-open-file"
        icon={<FolderOpen {...ICON} />}
      />
      <MenuItem
        label="Show History"
        onClick={() => run("showHistoryForFile")}
        testId="git-history-file-menu-show-history"
        icon={<History {...ICON} />}
      />
      <MenuDivider />
      <MenuSectionHeader label="Revision" />
      <MenuItem
        label="Get from Revision"
        disabled={!commitSha}
        disabledReason="Select a commit first"
        onClick={() => run("getFromRevision")}
        testId="git-history-file-menu-get-revision"
        icon={<Download {...ICON} />}
      />
    </>
  );
}
