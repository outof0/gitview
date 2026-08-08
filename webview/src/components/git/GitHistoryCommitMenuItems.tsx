import {
  Copy,
  GitBranch,
  GitCompare,
  Redo2,
  RotateCcw,
} from "lucide-react";
import type { GitMenuAction } from "@gitview/types";
import { MenuDivider, MenuItem, MenuSectionHeader } from "../ui/MenuItem";

type GitHistoryCommitMenuItemsProps = {
  commitSha: string;
  commitMessage: string;
  relativePath?: string;
  onGitAction: (
    action: GitMenuAction,
    extra?: { commitMessage?: string },
  ) => void;
  onClose: () => void;
};

const ICON = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };

/** History tab — commit right-click menu. */
export function GitHistoryCommitMenuItems({
  commitSha: _commitSha,
  commitMessage,
  relativePath,
  onGitAction,
  onClose,
}: GitHistoryCommitMenuItemsProps) {
  const run = (action: GitMenuAction) => {
    onClose();
    onGitAction(action, { commitMessage });
  };

  return (
    <>
      <MenuSectionHeader label="Compare" />
      <MenuItem
        label="Compare with Local"
        disabled={!relativePath}
        disabledReason="Open history for a file to compare"
        onClick={() => run("compareWithLocal")}
        testId="git-history-menu-compare-local"
        icon={<GitCompare {...ICON} />}
      />
      <MenuDivider />
      <MenuSectionHeader label="History actions" />
      <MenuItem
        label="Cherry-Pick"
        onClick={() => run("cherryPick")}
        testId="git-history-menu-cherry-pick"
        icon={<Redo2 {...ICON} />}
      />
      <MenuItem
        label="Revert Commit"
        onClick={() => run("revertCommit")}
        testId="git-history-menu-revert"
        icon={<RotateCcw {...ICON} />}
      />
      <MenuItem
        label="Checkout Revision"
        onClick={() => run("checkoutRevision")}
        testId="git-history-menu-checkout"
        icon={<GitBranch {...ICON} />}
      />
      <MenuDivider />
      <MenuSectionHeader label="Copy" />
      <MenuItem
        label="Copy Revision Number"
        onClick={() => run("copyCommitId")}
        testId="git-history-menu-copy-sha"
        icon={<Copy {...ICON} />}
      />
      <MenuItem
        label="Copy Commit Message"
        onClick={() => run("copyCommitMessage")}
        testId="git-history-menu-copy-message"
        icon={<Copy {...ICON} />}
      />
    </>
  );
}
