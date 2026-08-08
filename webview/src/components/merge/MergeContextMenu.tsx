import { Check, Eye, RotateCcw } from "lucide-react";
import type { GitMenuAction } from "@gitview/types";
import type { ChangeBlock, ConflictSide } from "../../../../src/core/types";
import { GitContextMenuItems } from "../git/GitContextMenuItems";
import { ContextMenu } from "../ui/ContextMenu";
import { MenuDivider, MenuItem, MenuSectionHeader } from "../ui/MenuItem";
import type { EditorContextMenuState } from "../../hooks/merge/useMergeResolverController";
import { useGitViewStore } from "../../stores/gitViewStore";
import {
  canAppendSide,
  getResolveContextMenuMode,
  type ResolveContextMenuMode,
} from "../../stores/mergeResolveMenu";

type MergeContextMenuProps = {
  menu: EditorContextMenuState | null;
  showBlameLeft: boolean;
  showBlameRight: boolean;
  onClose: () => void;
  onToggleAnnotateBlame: (pane: "left" | "right") => void;
  onAnnotateFromMenu: () => void;
  onShowHistory: () => void;
  onGitAction: (action: GitMenuAction) => void;
};

const ICON = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };

function conflictSideStatus(
  block: ChangeBlock,
  side: ConflictSide,
): "pending" | "accepted" | "ignored" {
  if (block.kind !== "conflict") {
    return "pending";
  }
  if (block.metadata.conflict) {
    return block.metadata.conflict[side];
  }
  if (block.status === "accepted_ours") {
    return side === "ours" ? "accepted" : "ignored";
  }
  if (block.status === "accepted_theirs") {
    return side === "theirs" ? "accepted" : "ignored";
  }
  if (block.status === "accepted_both") {
    return "accepted";
  }
  if (block.status === "resolved" || block.status === "manual") {
    return "ignored";
  }
  return "pending";
}

function canHandleSide(block: ChangeBlock, side: ConflictSide): boolean {
  if (block.kind === "conflict") {
    return (
      block.status === "unresolved" &&
      conflictSideStatus(block, side) === "pending"
    );
  }
  if (block.status !== "unresolved") {
    return false;
  }
  if (block.kind === "ours_only") {
    return side === "ours";
  }
  if (block.kind === "theirs_only") {
    return side === "theirs";
  }
  return block.kind === "both_same";
}

function MergeResolveMenuItems({
  blockId,
  block,
  mode,
  onClose,
}: {
  blockId: string;
  block: ChangeBlock;
  mode: ResolveContextMenuMode;
  onClose: () => void;
}) {
  const run = (action: () => void) => {
    onClose();
    action();
  };

  if (mode === "reset-only") {
    return (
      <>
        <MenuSectionHeader label="Resolve" />
        <MenuItem
          label="Reset"
          testId="merge-context-reset"
          onClick={() =>
            run(() => useGitViewStore.getState().applyResetConflict(blockId))
          }
          icon={<RotateCcw {...ICON} />}
        />
        <MenuDivider />
      </>
    );
  }

  return (
    <>
      <MenuSectionHeader label="Resolve" />
      {canAppendSide(block, "ours") ? (
        <MenuItem
          label="Append Left Side"
          testId="merge-context-append-local"
          onClick={() =>
            run(() => useGitViewStore.getState().applyAppendSide(blockId, "ours"))
          }
          icon={<Check {...ICON} />}
        />
      ) : (
        canHandleSide(block, "ours") && (
          <MenuItem
            label="Accept Left Side"
            testId="merge-context-accept-local"
            onClick={() =>
              run(() =>
                useGitViewStore.getState().applyAcceptSide(blockId, "ours"),
              )
            }
            icon={<Check {...ICON} />}
          />
        )
      )}
      {canAppendSide(block, "theirs") ? (
        <MenuItem
          label="Append Right Side"
          testId="merge-context-append-repository"
          onClick={() =>
            run(() =>
              useGitViewStore.getState().applyAppendSide(blockId, "theirs"),
            )
          }
          icon={<Check {...ICON} />}
        />
      ) : (
        canHandleSide(block, "theirs") && (
          <MenuItem
            label="Accept Right Side"
            testId="merge-context-accept-repository"
            onClick={() =>
              run(() =>
                useGitViewStore.getState().applyAcceptSide(blockId, "theirs"),
              )
            }
            icon={<Check {...ICON} />}
          />
        )
      )}
      {canHandleSide(block, "ours") && (
        <MenuItem
          label="Ignore Left Side"
          testId="merge-context-ignore-local"
          onClick={() =>
            run(() => useGitViewStore.getState().applyIgnore(blockId, "ours"))
          }
          hideIcon
        />
      )}
      {canHandleSide(block, "theirs") && (
        <MenuItem
          label="Ignore Right Side"
          testId="merge-context-ignore-repository"
          onClick={() =>
            run(() => useGitViewStore.getState().applyIgnore(blockId, "theirs"))
          }
          hideIcon
        />
      )}
      {block.kind === "conflict" && (
        <>
          <MenuItem
            label="Resolve Using Left"
            testId="merge-context-resolve-local"
            onClick={() =>
              run(() => useGitViewStore.getState().applyAcceptOurs(blockId))
            }
            icon={<Check {...ICON} />}
          />
          <MenuItem
            label="Resolve Using Right"
            testId="merge-context-resolve-repository"
            onClick={() =>
              run(() => useGitViewStore.getState().applyAcceptTheirs(blockId))
            }
            icon={<Check {...ICON} />}
          />
        </>
      )}
      <MenuItem
        label="Reset"
        testId="merge-context-reset"
        onClick={() =>
          run(() => useGitViewStore.getState().applyResetConflict(blockId))
        }
        icon={<RotateCcw {...ICON} />}
      />
      <MenuDivider />
    </>
  );
}

export function MergeContextMenu({
  menu,
  showBlameLeft,
  showBlameRight,
  onClose,
  onToggleAnnotateBlame,
  onAnnotateFromMenu,
  onShowHistory,
  onGitAction,
}: MergeContextMenuProps) {
  const activeDocument = useGitViewStore((s) => s.activeDocument);
  const resolveBlock: ChangeBlock | undefined =
    menu?.blockId && activeDocument
      ? activeDocument.blocks.find((b) => b.id === menu.blockId)
      : undefined;
  const resolveMode = getResolveContextMenuMode(resolveBlock);
  const showResolveItems = resolveMode !== "none" && !!menu?.blockId;
  const resolveBlockId = showResolveItems ? menu.blockId : null;
  const annotateActive =
    (menu?.side === "left" && showBlameLeft) ||
    (menu?.side === "right" && showBlameRight);

  return (
    <ContextMenu
      menu={menu}
      onClose={onClose}
      testId="merge-context-menu"
      ariaLabel="Merge resolver context menu"
      minWidth={260}
    >
      {menu && (
        <>
          {resolveBlockId && (
            <MergeResolveMenuItems
              blockId={resolveBlockId}
              block={resolveBlock!}
              mode={resolveMode}
              onClose={onClose}
            />
          )}
          {menu.type === "gutter" ? (
            <>
              <MenuSectionHeader label="Annotate" />
              <MenuItem
                label="Annotate with Git Blame"
                testId="editor-context-menu-annotate-gutter"
                onClick={() => {
                  const side = menu.side;
                  onClose();
                  if (side === "left" || side === "right") {
                    onToggleAnnotateBlame(side);
                  }
                }}
                icon={<Eye {...ICON} />}
                trailing={annotateActive ? "✓" : undefined}
              />
              <MenuDivider />
              <GitContextMenuItems
                isFolder={false}
                onClose={onClose}
                onShowHistory={onShowHistory}
                onGitAction={onGitAction}
                showAnnotate={false}
              />
            </>
          ) : (
            <GitContextMenuItems
              isFolder={false}
              onClose={onClose}
              onShowHistory={onShowHistory}
              onGitAction={onGitAction}
              onAnnotateBlame={onAnnotateFromMenu}
              showAnnotate={menu.side !== "center"}
            />
          )}
        </>
      )}
    </ContextMenu>
  );
}
