import { memo, useCallback, useMemo, useState } from "react";
import { RotateCcw, Minus, Plus, ExternalLink } from "lucide-react";
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

type WorkspaceChangesPanelProps = {
  files: GitFileStatus[];
  changelists?: ChangeList[];
  selectedPath: string | null;
  commitScope: Set<string>;
  busy?: boolean;
  onSelectFile: (path: string) => void;
  onToggleCommitScope: (path: string) => void;
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
      className={`group w-full flex items-center gap-1.5 px-2 h-[30px] min-h-[30px] text-[length:var(--nx-font-size-ui)] hover:bg-list-hover ${
        selected
          ? "bg-[var(--vscode-list-inactiveSelectionBackground,var(--list-active))] text-foreground border-l-2 border-[var(--vscode-focusBorder)]"
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
        <input
          type="checkbox"
          checked={inCommitScope}
          onChange={() => onToggleCommitScope(file.path)}
          aria-label={`Include ${file.path} in commit`}
          data-testid={`commit-checkbox-${file.path}`}
        />
      )}
      <button
        type="button"
        className="flex-1 text-left flex items-center gap-1.5 border-none bg-transparent cursor-pointer p-0 min-w-0"
        onClick={() => {
          onSelectFile(file.path);
          onOpenInEditor?.(file.path);
        }}
        title="Open diff in editor"
      >
        <GitFileIcon fileName={name} className="w-3.5 h-3.5 shrink-0" />
        <span className="min-w-0 flex-1 flex flex-col leading-tight">
          <span className={`truncate text-[11px] ${selected ? "font-semibold" : ""}`}>
            {name}
          </span>
          {dir ? (
            <span className="truncate text-[8px] text-vscode-description">{dir}</span>
          ) : null}
        </span>
        <span
          className={`w-4 shrink-0 text-right text-[10px] font-bold ${statusClass}`}
          data-testid={`change-status-${file.path}`}
        >
          {fileStatusPrefix(visual)}
        </span>
      </button>
      {onOpenInEditor && (
        <button
          type="button"
          className="shrink-0 w-6 h-6 hidden group-hover:flex items-center justify-center rounded-vscode hover:bg-[var(--vscode-toolbar-hoverBackground)] text-vscode-description hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInEditor(file.path);
          }}
          data-testid={`open-editor-${file.path}`}
          title="Open diff in editor"
          aria-label={`Open ${file.path} in editor`}
        >
          <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  );
});

const Section = memo(function Section({
  title,
  files,
  selectedPath,
  commitScope,
  onSelectFile,
  onToggleCommitScope,
  onContextMenuFile,
  onOpenInEditor,
  testId,
}: {
  title: string;
  files: GitFileStatus[];
  selectedPath: string | null;
  commitScope: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleCommitScope: (path: string) => void;
  onContextMenuFile?: (e: React.MouseEvent, path: string) => void;
  onOpenInEditor?: (path: string) => void;
  testId: string;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <section data-testid={testId}>
      <div
        className={`px-[var(--nx-pad-x)] h-7 min-h-7 flex items-center justify-between text-[length:var(--nx-font-size-section)] font-semibold uppercase tracking-wide ${
          title === "Merge Conflicts"
            ? "nx-file-status-conflict"
            : "text-vscode-description"
        }`}
      >
        <span>{title}</span>
        <span className="font-normal text-vscode-description">{files.length}</span>
      </div>
      {files.map((file) => (
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
  busy = false,
  onSelectFile,
  onToggleCommitScope,
  onStage,
  onUnstage,
  onRollback,
  changelists = [],
  onMoveToChangelist,
  onGitMenuAction,
  onShowGitHistory,
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
      className="flex-1 min-h-0 flex flex-col font-[family-name:var(--nx-font-ui)]"
      data-testid="workspace-changes"
    >
      <div className="shrink-0 flex items-center justify-between gap-1 px-[var(--nx-pad-x)] h-[38px] min-h-[38px] border-b border-border overflow-hidden">
        <span className="shrink-0 whitespace-nowrap text-[length:var(--nx-font-size-section)] font-bold uppercase tracking-wide text-foreground">
          Local Changes
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          className="h-[var(--nx-row-h)] px-1.5 flex items-center gap-1 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode hover:bg-list-hover disabled:opacity-40 shrink-0"
          disabled={!selectedPath || busy}
          onClick={() => selectedPath && onStage([selectedPath])}
          data-testid="stage-button"
        >
          <Plus size={14} aria-hidden />
          <span className="max-[1100px]:hidden">Stage</span>
        </button>
        <button
          type="button"
          className="h-[var(--nx-row-h)] px-1.5 flex items-center gap-1 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode hover:bg-list-hover disabled:opacity-40 shrink-0"
          disabled={!selectedPath || busy}
          onClick={() => selectedPath && onUnstage([selectedPath])}
          data-testid="unstage-button"
        >
          <Minus size={14} aria-hidden />
          <span className="max-[1100px]:hidden">Unstage</span>
        </button>
        <button
          type="button"
          className="h-[var(--nx-row-h)] px-1.5 flex items-center gap-1 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode hover:bg-list-hover disabled:opacity-40 shrink-0"
          disabled={targetPaths.length === 0 || busy}
          onClick={() => selectedPath && onRollback([selectedPath])}
          data-testid="rollback-button"
        >
          <RotateCcw size={14} aria-hidden />
          <span className="max-[1100px]:hidden">Rollback</span>
        </button>
        </div>
      </div>

      {compareLabel ? (
        <div
          className="shrink-0 flex items-center justify-between gap-2 px-[var(--nx-pad-x)] h-11 min-h-11 border-b border-border bg-[var(--vscode-sideBarSectionHeader-background,transparent)]"
          data-testid="changes-compare-target"
        >
          <div className="min-w-0">
            <div className="text-[9px] text-vscode-description">Comparing with</div>
            <div className="truncate text-[11px] text-[var(--vscode-textLink-foreground,var(--nx-status-modified))]">
              {compareLabel}
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <div
          className="nx-tool-empty flex flex-col items-start justify-start gap-1 px-[var(--nx-pad-x)] py-2 text-left"
          data-testid="changes-empty"
        >
          <div className="text-[length:var(--nx-font-size-ui)] font-medium text-foreground">
            No local changes
          </div>
          <div className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description">
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
            onSelectFile={onSelectFile}
            onToggleCommitScope={onToggleCommitScope}
            onContextMenuFile={openFileMenu}
            testId="changes-conflicts"
          />
          <Section
            title="Changes"
            files={groups.changes}
            selectedPath={selectedPath}
            commitScope={commitScope}
            onSelectFile={onSelectFile}
            onToggleCommitScope={onToggleCommitScope}
            onContextMenuFile={openFileMenu}
            testId="changes-tracked"
          />
          <Section
            title="Unversioned Files"
            files={groups.unversioned}
            selectedPath={selectedPath}
            commitScope={commitScope}
            onSelectFile={onSelectFile}
            onToggleCommitScope={onToggleCommitScope}
            onContextMenuFile={openFileMenu}
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
          <div className="py-1">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
              Move to changelist
            </div>
            {inactiveLists.map((list) => (
              <button
                key={list.id}
                type="button"
                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-list-hover"
                onClick={() => {
                  onMoveToChangelist(list.id, [fileMenu.path]);
                  setFileMenu(null);
                }}
                data-testid={`move-to-${list.id}`}
              >
                {list.name}
              </button>
            ))}
          </div>
        )}
        {inactiveLists.length === 0 && !onGitMenuAction && (
          <div className="px-3 py-2 text-[12px] text-[var(--vscode-descriptionForeground)]">
            No other changelists
          </div>
        )}
        {fileMenu && onGitMenuAction && (
          <>
            {(inactiveLists.length > 0 || onMoveToChangelist) && (
              <div className="h-[1px] bg-menu-border my-1" />
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