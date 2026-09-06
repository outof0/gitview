import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
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
import { MenuDivider, MenuItem, MenuSectionHeader } from "../ui/MenuItem";

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
      className={`group w-full flex items-center gap-1.5 px-2 h-row-lg min-h-row-lg text-ui hover:bg-list-hover ${
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
          onOpenInEditor?.(file.path);
        }}
        title="Open diff in editor"
      >
        <GitFileIcon fileName={name} className="w-3.5 h-3.5 shrink-0" />
        <span className="min-w-0 flex-1 flex flex-col leading-tight">
          <span className={`truncate text-ui-sm ${selected ? "font-semibold" : ""}`}>
            {name}
          </span>
          {dir ? (
            <span className="truncate text-path text-vscode-description">{dir}</span>
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
        className={`px-pad-x h-7 min-h-7 flex items-center justify-between text-section font-semibold uppercase tracking-wide ${
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
      className="flex-1 min-h-0 flex flex-col font-ui"
      data-testid="workspace-changes"
    >
      <div className="shrink-0 flex items-center justify-between gap-1 px-pad-x h-header min-h-header border-b border-border overflow-hidden">
        <span className="shrink-0 whitespace-nowrap text-section font-bold uppercase tracking-wide text-foreground">
          Local Changes
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="content"
          type="button"
          className="h-row px-1.5 flex items-center gap-1 text-ui-sm rounded-vscode hover:bg-list-hover disabled:opacity-40 shrink-0"
          disabled={!selectedPath || busy}
          onClick={() => selectedPath && onStage([selectedPath])}
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
          data-testid="rollback-button"
        >
          <RotateCcw size={14} aria-hidden />
          <span className="max-changes-toolbar:hidden">Rollback</span>
        </Button>
        </div>
      </div>

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
