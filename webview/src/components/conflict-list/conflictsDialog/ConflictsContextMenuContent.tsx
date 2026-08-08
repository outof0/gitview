import { Check, GitMerge } from "lucide-react";
import type { GitMenuAction } from "@gitview/types";
import { GitContextMenuItems } from "../../git/GitContextMenuItems";
import { MenuDivider, MenuItem, MenuSectionHeader } from "../../ui/MenuItem";

export type ConflictsContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  path: string;
  isFolder: boolean;
};

type ConflictsContextMenuContentProps = {
  contextMenu: ConflictsContextMenuState;
  onClose: () => void;
  onMergeFile: (path: string) => void;
  onAcceptYours: (path: string) => void;
  onAcceptTheirs: (path: string) => void;
  onShowHistory: (path: string, isFolder: boolean) => void;
  onGitAction: (
    action: GitMenuAction,
    path: string,
    isFolder: boolean,
  ) => void;
};

const ICON = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };

export function ConflictsContextMenuContent({
  contextMenu,
  onClose,
  onMergeFile,
  onAcceptYours,
  onAcceptTheirs,
  onShowHistory,
  onGitAction,
}: ConflictsContextMenuContentProps) {
  return (
    <>
      {!contextMenu.isFolder && (
        <>
          <MenuSectionHeader label="Conflicts" />
          <MenuItem
            label="Merge..."
            onClick={() => {
              const { path } = contextMenu;
              onClose();
              onMergeFile(path);
            }}
            icon={<GitMerge {...ICON} />}
          />
          <MenuItem
            label="Accept Yours"
            testId="conflicts-menu-accept-yours"
            onClick={() => {
              const { path } = contextMenu;
              onClose();
              onAcceptYours(path);
            }}
            icon={<Check {...ICON} />}
          />
          <MenuItem
            label="Accept Theirs"
            testId="conflicts-menu-accept-theirs"
            onClick={() => {
              const { path } = contextMenu;
              onClose();
              onAcceptTheirs(path);
            }}
            icon={<Check {...ICON} />}
          />
          <MenuDivider />
        </>
      )}
      <GitContextMenuItems
        isFolder={contextMenu.isFolder}
        onClose={onClose}
        onShowHistory={() => {
          const { path, isFolder } = contextMenu;
          onClose();
          onShowHistory(path, isFolder);
        }}
        onGitAction={(action: GitMenuAction) => {
          const { path, isFolder } = contextMenu;
          onClose();
          onGitAction(action, path, isFolder);
        }}
      />
    </>
  );
}
