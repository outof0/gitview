import type { ReactNode } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDot,
  Eye,
  FileDiff,
  GitBranch,
  GitBranchPlus,
  GitCommit,
  GitCompare,
  GitMerge,
  GitPullRequest,
  History,
  Layers,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Plus,
  Minus,
} from "lucide-react";
import type { GitMenuAction } from "@gitview/types";
import {
  type GitSubmenuEnablementContext,
  type GitSubmenuItem,
  evaluateGitSubmenuAction,
  getGitSubmenuItems,
  gitSubmenuGroupKey,
  gitSubmenuSectionLabel,
  isFileOnlyScope,
} from "@gitview/types";
import { MenuDivider, MenuItem, MenuSectionHeader } from "../ui/MenuItem";

type GitContextMenuItemsProps = {
  isFolder: boolean;
  onShowHistory: () => void;
  onGitAction: (action: GitMenuAction) => void;
  onClose: () => void;
  /** Merge resolver handles blame locally via git:blame. */
  onAnnotateBlame?: () => void;
  /** Hide Annotate when gutter menu already exposes it, or center pane has no side. */
  showAnnotate?: boolean;
  /** Contextual enablement — greys out actions that do not apply. */
  enablement?: GitSubmenuEnablementContext;
  /**
   * Omit disabled rows instead of greying them out.
   * Requires `enablement` for evaluation; without it, all items stay visible.
   */
  hideDisabled?: boolean;
  /** Optional allow-list of menu actions (e.g. compare line menu). */
  allowedActions?: ReadonlySet<string> | readonly string[];
};

const ICON_PROPS = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };

function actionIcon(action: string): ReactNode {
  switch (action) {
    case "openConflictResolver":
      return <CircleDot {...ICON_PROPS} />;
    case "showHistory":
      return <History {...ICON_PROPS} />;
    case "compareWithRevision":
      return <GitCompare {...ICON_PROPS} />;
    case "compareWithBranch":
      return <GitBranch {...ICON_PROPS} />;
    case "showDiff":
      return <FileDiff {...ICON_PROPS} />;
    case "annotateBlame":
      return <Eye {...ICON_PROPS} />;
    case "rollback":
      return <RotateCcw {...ICON_PROPS} />;
    case "add":
      return <Plus {...ICON_PROPS} />;
    case "unstage":
      return <Minus {...ICON_PROPS} />;
    case "commit":
    case "commitAndPush":
      return <GitCommit {...ICON_PROPS} />;
    case "fetch":
      return <ArrowDownToLine {...ICON_PROPS} />;
    case "pull":
      return <GitPullRequest {...ICON_PROPS} />;
    case "push":
      return <ArrowUpFromLine {...ICON_PROPS} />;
    case "sync":
      return <RefreshCw {...ICON_PROPS} />;
    case "checkoutBranch":
      return <GitBranch {...ICON_PROPS} />;
    case "createBranch":
      return <GitBranchPlus {...ICON_PROPS} />;
    case "stash":
      return <Archive {...ICON_PROPS} />;
    case "unstash":
      return <PackageOpen {...ICON_PROPS} />;
    case "shelve":
      return <Layers {...ICON_PROPS} />;
    case "unshelve":
      return <PackageOpen {...ICON_PROPS} />;
    case "merge":
      return <GitMerge {...ICON_PROPS} />;
    case "rebase":
      return <GitPullRequest {...ICON_PROPS} />;
    default:
      return null;
  }
}

function resolveDisabled(
  entry: GitSubmenuItem,
  enablement: GitSubmenuEnablementContext | undefined,
  isFolder: boolean,
): { disabled: boolean; reason?: string } {
  if (isFileOnlyScope(entry.scope) && isFolder) {
    return { disabled: true, reason: "Select a file" };
  }

  if (!enablement) {
    return { disabled: false };
  }

  const result = evaluateGitSubmenuAction(entry.action, {
    ...enablement,
    isFolder,
  });
  return { disabled: !result.enabled, reason: result.reason };
}

export function GitContextMenuItems({
  isFolder,
  onShowHistory,
  onGitAction,
  onClose,
  onAnnotateBlame,
  showAnnotate = true,
  enablement,
  hideDisabled = false,
  allowedActions,
}: GitContextMenuItemsProps) {
  const allow =
    allowedActions == null
      ? null
      : allowedActions instanceof Set
        ? allowedActions
        : new Set(allowedActions);

  const items = getGitSubmenuItems({ showAnnotate }).filter((entry) => {
    if (allow && !allow.has(entry.action)) {
      return false;
    }
    if (!hideDisabled) {
      return true;
    }
    const { disabled } = resolveDisabled(entry, enablement, isFolder);
    return !disabled;
  });

  const run = (action: GitMenuAction) => {
    onClose();
    onGitAction(action);
  };

  let lastGroupKey: string | null = null;

  return (
    <>
      {items.map((entry) => {
        const groupKey = gitSubmenuGroupKey(entry.group);
        const sectionLabel = gitSubmenuSectionLabel(groupKey);
        const isNewGroup = lastGroupKey !== null && lastGroupKey !== groupKey;
        const isFirstInGroup = lastGroupKey !== groupKey;
        lastGroupKey = groupKey;

        const { disabled, reason } = resolveDisabled(
          entry,
          enablement,
          isFolder,
        );

        const onActivate = () => {
          if (entry.action === "showHistory") {
            onClose();
            onShowHistory();
            return;
          }
          if (entry.annotate) {
            onClose();
            if (onAnnotateBlame) {
              onAnnotateBlame();
            } else {
              run("annotateBlame");
            }
            return;
          }
          run(entry.action as GitMenuAction);
        };

        return (
          <span key={entry.testId} className="contents">
            {isNewGroup ? <MenuDivider /> : null}
            {isFirstInGroup && sectionLabel ? (
              <MenuSectionHeader label={sectionLabel} />
            ) : null}
            <MenuItem
              label={entry.title}
              disabled={disabled}
              disabledReason={reason}
              onClick={onActivate}
              testId={entry.testId}
              icon={actionIcon(entry.action)}
            />
          </span>
        );
      })}
    </>
  );
}
