import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Minus,
  Plus,
  ExternalLink,
} from "lucide-react";
import type { GitMenuAction } from "@gitview/types";
import { buildGitSubmenuEnablementContext } from "@gitview/types";
import type { Repository } from "@gitview/shared/types/repository";
import type { ChangeList, GitFileStatus } from "@gitview/shared/types/status";
import { groupWorkspaceFiles } from "../../lib/groupWorkspaceFiles";
import {
  fileStatusPrefix,
  fileStatusTokenClass,
  splitWorkspacePath,
  visualStatusFromFileKind,
} from "../../lib/fileStatusTheme";
import { GitContextMenuItems } from "./GitContextMenuItems";
import { GitFileIcon } from "./gitFileIcon";
import { ContextMenu } from "../ui/ContextMenu";
import { MenuDivider, MenuItem, MenuSectionHeader } from "../ui/MenuItem";

type WorkspaceChangesPanelProps = {
  files: GitFileStatus[];
  changelists?: ChangeList[];
  selectedPath: string | null;
  commitScope: Set<string>;
  /** Hide the Local Changes header when a parent toolbar already owns it. */
  hideHeader?: boolean;
  busy?: boolean;
  onSelectFile: (path: string) => void;
  onToggleCommitScope: (path: string) => void;
  onSetCommitScope?: (paths: Iterable<string>) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  onRollback: (paths: string[]) => void;
  onMoveToChangelist?: (listId: string, paths: string[]) => void;
  onGitMenuAction?: (action: GitMenuAction, path: string) => void;
  onShowGitHistory?: (path: string) => void;
  activeRepo?: Repository | null;
  stashCount?: number;
  shelfCount?: number;
  hasRemote?: boolean;
  compareLabel?: string | null;
  onOpenInEditor?: (path: string) => void;
  collapseRequest?: { collapsed: boolean; token: number };
};

// Takes path-keyed callbacks rather than pre-bound closures so the props stay
// referentially stable and the memo below actually skips work.
const FileRow = memo(function FileRow({
  file,
  selected,
  inCommitScope,
  onSelectFile,
  onToggleCommitScope,
  onContextMenuFile,
  onOpenInEditor,
}: {
  file: GitFileStatus;
  selected: boolean;
  inCommitScope: boolean;
  onSelectFile: (path: string) => void;
  onToggleCommitScope: (path: string) => void;
  onContextMenuFile?: (e: React.MouseEvent, path: string) => void;
  onOpenInEditor?: (path: string) => void;
}) {
  const committable = file.kind !== "conflicted" && file.kind !== "ignored";
  const visual = visualStatusFromFileKind(file.kind);
  const { name, dir } = splitWorkspacePath(file.path);
  const statusClass = fileStatusTokenClass(visual);

  return (
    <div
      className={`group w-full flex items-center gap-1.5 px-pad-x h-row min-h-row text-ui hover:bg-list-hover ${
        selected
          ? "bg-list-inactive-sel text-foreground border-l-2 border-ring"
          : "text-foreground border-l-2 border-transparent"
      }`}
      data-testid={`change-row-${file.path}`}
      onContextMenu={
        onContextMenuFile
          ? (e) => {
              e.preventDefault();
              onContextMenuFile(e, file.path);
            }
          : undefined
      }
    >
      {committable && (
        <Input
          type="checkbox"
          checked={inCommitScope}
          onChange={() => onToggleCommitScope(file.path)}
          aria-label={`Include ${file.path} in commit`}
          data-testid={`commit-checkbox-${file.path}`}
        />
      )}
      <Button variant="ghost" size="content"
        type="button"
        className="flex-1 text-left flex items-center gap-1.5 border-none bg-transparent cursor-pointer p-0 min-w-0"
        onClick={() => {
          onSelectFile(file.path);
        }}
        onDoubleClick={() => onOpenInEditor?.(file.path)}
        title="Double-click to open diff in editor"
      >
        <GitFileIcon fileName={name} className="w-3.5 h-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate leading-none">
          <span className={selected ? "font-semibold" : ""}>{name}</span>
          {dir ? (
            <span className="ml-1.5 text-path text-vscode-description">{dir}</span>
          ) : null}
        </span>
        <span
          className={`w-4 shrink-0 text-right text-section font-bold ${statusClass}`}
          data-testid={`change-status-${file.path}`}
        >
          {fileStatusPrefix(visual)}
        </span>
      </Button>
      {onOpenInEditor && (
        <Button variant="ghost" size="content"
          type="button"
          className="shrink-0 w-6 h-6 hidden group-hover:flex items-center justify-center rounded-vscode hover:bg-toolbar-hover text-vscode-description hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInEditor(file.path);
          }}
          data-testid={`open-editor-${file.path}`}
          title="Open diff in editor"
          aria-label={`Open ${file.path} in editor`}
        >
          <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
        </Button>
      )}
    </div>
  );
});

function committableSectionFiles(files: GitFileStatus[]): GitFileStatus[] {
  return files.filter(
    (file) => file.kind !== "conflicted" && file.kind !== "ignored",
  );
}

const Section = memo(function Section({
  title,
  files,
  selectedPath,
  commitScope,
  treeChrome,
  onSelectFile,
  onToggleCommitScope,
  onSetCommitScope,
  onContextMenuFile,
  onOpenInEditor,
  collapseRequest,
  testId,
}: {
  title: string;
  files: GitFileStatus[];
  selectedPath: string | null;
  commitScope: Set<string>;
  treeChrome?: boolean;
  onSelectFile: (path: string) => void;
  onToggleCommitScope: (path: string) => void;
  onSetCommitScope?: (paths: Iterable<string>) => void;
  onContextMenuFile?: (e: React.MouseEvent, path: string) => void;
  onOpenInEditor?: (path: string) => void;
  collapseRequest?: { collapsed: boolean; token: number };
  testId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (collapseRequest) {
      setCollapsed(collapseRequest.collapsed);
    }
  }, [collapseRequest]);
  if (files.length === 0) {
    return null;
  }

  const committable = committableSectionFiles(files);
  const selectedCount = committable.filter((file) =>
    commitScope.has(file.path),
  ).length;
  const allSelected =
    committable.length > 0 && selectedCount === committable.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const conflictTitle = title === "Merge Conflicts";

  return (
    <section data-testid={testId}>
      {treeChrome ? (
        <div className="flex h-row min-h-row items-center gap-1 px-pad-x text-section font-semibold uppercase tracking-wide">
          <Button
            variant="ghost"
            size="icon"
            className="h-row w-row text-icon-fg"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={() => setCollapsed((open) => !open)}
            data-testid={`${testId}-toggle`}
          >
            {collapsed ? (
              <ChevronRight size={14} aria-hidden />
            ) : (
              <ChevronDown size={14} aria-hidden />
            )}
          </Button>
          {onSetCommitScope ? (
            <Input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someSelected;
                }
              }}
              onChange={() => {
                const next = new Set(commitScope);
                if (allSelected) {
                  for (const file of committable) {
                    next.delete(file.path);
                  }
                } else {
                  for (const file of committable) {
                    next.add(file.path);
                  }
                }
                onSetCommitScope(next);
              }}
              aria-label={`Include all ${title} in commit`}
              data-testid={`${testId}-select`}
            />
          ) : null}
          <span
            className={
              conflictTitle ? "nx-file-status-conflict" : "text-foreground"
            }
          >
            {title}
          </span>
          <span className="font-normal text-vscode-description">
            {files.length} {files.length === 1 ? "file" : "files"}
          </span>
        </div>
      ) : (
        <div
          className={`px-pad-x h-7 min-h-7 flex items-center justify-between text-section font-semibold uppercase tracking-wide ${
            conflictTitle
              ? "nx-file-status-conflict"
              : "text-vscode-description"
          }`}
        >
          <span>{title}</span>
          <span className="font-normal text-vscode-description">
            {files.length}
          </span>
        </div>
      )}
      {collapsed
        ? null
        : files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              selected={selectedPath === file.path}
              inCommitScope={commitScope.has(file.path)}
              onSelectFile={onSelectFile}
              onToggleCommitScope={onToggleCommitScope}
              onContextMenuFile={onContextMenuFile}
              onOpenInEditor={onOpenInEditor}
            />
          ))}
    </section>
  );
});

/**
 * Memoized: this panel re-renders on every commit-message keystroke, and it owns
 * the memoized FileRow/Section lists. Skipping only works while callers keep the
 * props referentially stable — see GitWorkspaceChangesTab's useMemo on files.
 */
export const WorkspaceChangesPanel = memo(function WorkspaceChangesPanel({
  files,
  selectedPath,
  commitScope,
  hideHeader = false,
  busy = false,
  onSelectFile,
  onToggleCommitScope,
  onSetCommitScope,
  onStage,
  onUnstage,
  onRollback,
  changelists = [],
  onMoveToChangelist,
  onGitMenuAction,
  onShowGitHistory,
  onOpenInEditor,
  collapseRequest,
  activeRepo = null,
  stashCount = 0,
  shelfCount = 0,
  hasRemote,
  compareLabel = null,
}: WorkspaceChangesPanelProps) {
  const [fileMenu, setFileMenu] = useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);
  const openFileMenu = useCallback(
    (e: React.MouseEvent, path: string) =>
      setFileMenu({ x: e.clientX, y: e.clientY, path }),
    [],
  );
  const groups = useMemo(() => groupWorkspaceFiles(files), [files]);
  const inactiveLists = changelists.filter((list) => !list.active);
  const isEmpty =
    groups.changes.length === 0 &&
    groups.unversioned.length === 0 &&
    groups.conflicts.length === 0;

  const targetPaths = selectedPath ? [selectedPath] : [];

  return (
    <div
      className="flex-1 min-h-0 flex flex-col font-ui"
      data-testid="workspace-changes"
    >
      {hideHeader ? null : (
      <div className="flex h-toolbar min-h-toolbar shrink-0 items-center justify-between gap-1 overflow-hidden border-b border-border px-pad-x">
        <span className="shrink-0 whitespace-nowrap text-section font-bold uppercase tracking-wide text-foreground">
          Local Changes
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="content"
          type="button"
          className="h-row px-1.5 flex items-center gap-1 text-ui-sm rounded-vscode hover:bg-list-hover disabled:opacity-40 shrink-0"
          disabled={!selectedPath || busy}
          onClick={() => selectedPath && onStage([selectedPath])}
          title="Stage selected change"
          data-testid="stage-button"
        >
          <Plus size={14} aria-hidden />
          <span className="max-changes-toolbar:hidden">Stage</span>
        </Button>
        <Button variant="ghost" size="content"
          type="button"
          className="h-row px-1.5 flex items-center gap-1 text-ui-sm rounded-vscode hover:bg-list-hover disabled:opacity-40 shrink-0"
          disabled={!selectedPath || busy}
          onClick={() => selectedPath && onUnstage([selectedPath])}
          title="Unstage selected change"
          data-testid="unstage-button"
        >
          <Minus size={14} aria-hidden />
          <span className="max-changes-toolbar:hidden">Unstage</span>
        </Button>
        <Button variant="ghost" size="content"
          type="button"
          className="h-row px-1.5 flex items-center gap-1 text-ui-sm rounded-vscode hover:bg-list-hover disabled:opacity-40 shrink-0"
          disabled={targetPaths.length === 0 || busy}
          onClick={() => selectedPath && onRollback([selectedPath])}
          title="Rollback selected change"
          data-testid="rollback-button"
        >
          <RotateCcw size={14} aria-hidden />
          <span className="max-changes-toolbar:hidden">Rollback</span>
        </Button>
        </div>
      </div>
      )}

      {compareLabel ? (
        <div
          className="shrink-0 flex items-center justify-between gap-2 px-pad-x h-11 min-h-11 border-b border-border bg-sidebar-section-bg"
          data-testid="changes-compare-target"
        >
          <div className="min-w-0">
            <div className="text-micro text-vscode-description">Comparing with</div>
            <div className="truncate text-ui-sm text-vscode-link">
              {compareLabel}
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <div
          className="nx-tool-empty flex flex-col items-start justify-start gap-1 px-pad-x py-2 text-left"
          data-testid="changes-empty"
        >
          <div className="text-ui font-medium text-foreground">
            No local changes
          </div>
          <div className="text-ui-sm text-vscode-description">
            Edit files in the workspace to see them here.
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Section
            title="Merge Conflicts"
            files={groups.conflicts}
            selectedPath={selectedPath}
            commitScope={commitScope}
            treeChrome={hideHeader}
            onSelectFile={onSelectFile}
            onToggleCommitScope={onToggleCommitScope}
            onSetCommitScope={onSetCommitScope}
            onContextMenuFile={openFileMenu}
            onOpenInEditor={onOpenInEditor}
            collapseRequest={collapseRequest}
            testId="changes-conflicts"
          />
          <Section
            title="Changes"
            files={groups.changes}
            selectedPath={selectedPath}
            commitScope={commitScope}
            treeChrome={hideHeader}
            onSelectFile={onSelectFile}
            onToggleCommitScope={onToggleCommitScope}
            onSetCommitScope={onSetCommitScope}
            onContextMenuFile={openFileMenu}
            onOpenInEditor={onOpenInEditor}
            collapseRequest={collapseRequest}
            testId="changes-tracked"
          />
          <Section
            title="Unversioned Files"
            files={groups.unversioned}
            selectedPath={selectedPath}
            commitScope={commitScope}
            treeChrome={hideHeader}
            onSelectFile={onSelectFile}
            onToggleCommitScope={onToggleCommitScope}
            onSetCommitScope={onSetCommitScope}
            onContextMenuFile={openFileMenu}
            onOpenInEditor={onOpenInEditor}
            collapseRequest={collapseRequest}
            testId="changes-unversioned"
          />
        </div>
      )}

      <ContextMenu
        menu={
          fileMenu
            ? { visible: true, x: fileMenu.x, y: fileMenu.y }
            : null
        }
        onClose={() => setFileMenu(null)}
        testId="change-file-menu"
        ariaLabel="Change file actions"
      >
        {inactiveLists.length > 0 && onMoveToChangelist && fileMenu && (
          <>
            <MenuSectionHeader label="Move to changelist" />
            {inactiveLists.map((list) => (
              <MenuItem
                key={list.id}
                label={list.name}
                onClick={() => {
                  onMoveToChangelist(list.id, [fileMenu.path]);
                  setFileMenu(null);
                }}
                testId={`move-to-${list.id}`}
              />
            ))}
          </>
        )}
        {inactiveLists.length === 0 && !onGitMenuAction && (
          <div className="px-3 py-2 text-ui text-vscode-description">
            No other changelists
          </div>
        )}
        {fileMenu && onGitMenuAction && (
          <>
            {(inactiveLists.length > 0 || onMoveToChangelist) && (
              <MenuDivider />
            )}
            <GitContextMenuItems
              isFolder={false}
              enablement={buildGitSubmenuEnablementContext({
                repository: activeRepo,
                files,
                relativePath: fileMenu.path,
                isFolder: false,
                stashCount,
                shelfCount,
                hasRemote,
              })}
              onClose={() => setFileMenu(null)}
              onShowHistory={() => {
                const path = fileMenu.path;
                setFileMenu(null);
                if (onShowGitHistory) {
                  onShowGitHistory(path);
                } else {
                  onGitMenuAction("showHistoryForFile", path);
                }
              }}
              onGitAction={(action) => onGitMenuAction(action, fileMenu.path)}
            />
          </>
        )}
      </ContextMenu>
    </div>
  );
});
