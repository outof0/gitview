import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Eye,
  Folder,
  X,
} from "lucide-react";
import type { GitChangedFile } from "@gitview/types";
import type { GitFileStatus } from "@gitview/shared/types/status";
import { Button } from "../ui/Button";
import { GitDialogShell } from "../ui/GitDialogShell";
import { Input } from "../ui/Input";
import { ScrollArea } from "../ui/ScrollArea";
import {
  ToolbarIconButton,
  ToolbarSeparator,
} from "../ui/ToolbarControls";
import { Tooltip } from "../ui/Tooltip";
import { buildChangedFilesTree, type ChangedFileTreeNode } from "./changedFilesTree";
import { GitFileIcon } from "./gitFileIcon";
import {
  fileStatusPrefix,
  fileStatusTokenClass,
  visualStatusFromFileKind,
} from "../../lib/fileStatusTheme";
import { cn } from "../../lib/cn";

type RollbackChangesDialogProps = {
  open: boolean;
  paths: string[];
  selectedPaths?: string[];
  files: GitFileStatus[];
  busy?: boolean;
  onConfirm: (paths: string[]) => void;
  onCancel: () => void;
};

const STATUS_BY_KIND: Record<GitFileStatus["kind"], GitChangedFile["status"]> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  // The history tree has no unversioned/ignored status letters. U is the
  // closest neutral marker and the file's own status class remains visible.
  unversioned: "U",
  ignored: "U",
  conflicted: "U",
};

function filePaths(node: ChangedFileTreeNode): string[] {
  if (!node.isFolder) {
    return [node.path];
  }
  return node.children.flatMap(filePaths);
}

function selectedState(
  paths: string[],
  selectedPaths: Set<string>,
): { all: boolean; some: boolean } {
  const selectedCount = paths.reduce(
    (count, path) => count + (selectedPaths.has(path) ? 1 : 0),
    0,
  );
  return {
    all: paths.length > 0 && selectedCount === paths.length,
    some: selectedCount > 0,
  };
}

function TreeCheckbox({
  paths,
  selectedPaths,
  onToggle,
  label,
  testId,
}: {
  paths: string[];
  selectedPaths: Set<string>;
  onToggle: (paths: string[]) => void;
  label: string;
  testId: string;
}) {
  const state = selectedState(paths, selectedPaths);
  return (
    <Input
      type="checkbox"
      checked={state.all}
      className="h-4 w-4"
      ref={(element) => {
        if (element) {
          element.indeterminate = state.some && !state.all;
        }
      }}
      onClick={(event) => event.stopPropagation()}
      onChange={() => onToggle(paths)}
      aria-label={label}
      data-testid={testId}
    />
  );
}

function RollbackTreeRow({
  node,
  depth,
  filesByPath,
  selectedPaths,
  collapsed,
  onToggleSelection,
  onToggleFolder,
}: {
  node: ChangedFileTreeNode;
  depth: number;
  filesByPath: Map<string, GitFileStatus>;
  selectedPaths: Set<string>;
  collapsed: Set<string>;
  onToggleSelection: (paths: string[]) => void;
  onToggleFolder: (path: string) => void;
}) {
  const paths = useMemo(() => filePaths(node), [node]);
  const open = !collapsed.has(node.path);
  const selection = selectedState(paths, selectedPaths);

  if (node.isFolder) {
    return (
      <div
        data-testid={`rollback-folder-${node.path}`}
        role="treeitem"
        aria-expanded={open}
      >
        <div
          className="flex min-h-row-lg items-center gap-1 pr-2 text-ui hover:bg-list-hover"
          style={{ paddingLeft: `${6 + depth * 16}px` }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-row w-row shrink-0 text-icon-fg"
            onClick={() => onToggleFolder(node.path)}
            aria-expanded={open}
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            data-testid={`rollback-folder-toggle-${node.path}`}
          >
            {open ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
          </Button>
          <TreeCheckbox
            paths={paths}
            selectedPaths={selectedPaths}
            onToggle={onToggleSelection}
            label={`Select all files in ${node.name}`}
            testId={`rollback-folder-select-${node.path}`}
          />
          <Button
            variant="ghost"
            size="content"
            className="flex min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-ui text-foreground"
            onClick={() => onToggleFolder(node.path)}
          >
            <Folder size={18} className="shrink-0 text-icon-fg" aria-hidden />
            <span className="truncate">{node.name}</span>
            <span className="shrink-0 text-ui text-vscode-description">
              {paths.length} {paths.length === 1 ? "file" : "files"}
            </span>
          </Button>
        </div>
        {open
          ? node.children.map((child) => (
              <RollbackTreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                filesByPath={filesByPath}
                selectedPaths={selectedPaths}
                collapsed={collapsed}
                onToggleSelection={onToggleSelection}
                onToggleFolder={onToggleFolder}
              />
            ))
          : null}
      </div>
    );
  }

  const file = filesByPath.get(node.path);
  const visual = visualStatusFromFileKind(file?.kind ?? "modified");
  const status = fileStatusPrefix(visual);
  const rowSurface = selection.all
    ? file?.kind === "added" || file?.kind === "unversioned"
      ? "nx-added"
      : file?.kind === "deleted"
        ? "nx-deleted"
        : "nx-modified"
    : "";

  return (
    <div
      className={cn(
        "flex min-h-row-lg items-center gap-1.5 pr-2 text-ui hover:bg-list-hover",
        rowSurface,
      )}
      style={{ paddingLeft: `${38 + depth * 16}px` }}
      data-testid={`rollback-file-${node.path}`}
      role="treeitem"
      aria-selected={selection.all}
    >
      <Input
        type="checkbox"
        checked={selectedPaths.has(node.path)}
        className="h-4 w-4"
        onChange={() => onToggleSelection([node.path])}
        aria-label={`Select ${node.path}`}
        data-testid={`rollback-file-select-${node.path}`}
      />
      <Button
        variant="ghost"
        size="content"
        className="flex min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-ui text-foreground"
        onClick={() => onToggleSelection([node.path])}
        title={node.path}
      >
        <GitFileIcon fileName={node.name} className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span
          className={`w-4 shrink-0 text-right font-mono text-section font-bold ${fileStatusTokenClass(visual)}`}
          aria-label={file?.kind ?? "modified"}
        >
          {status}
        </span>
      </Button>
    </div>
  );
}

function collectFolderPaths(nodes: ChangedFileTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.isFolder
      ? [node.path, ...collectFolderPaths(node.children)]
      : [],
  );
}

function filterSelectedTree(
  nodes: ChangedFileTreeNode[],
  selectedPaths: Set<string>,
): ChangedFileTreeNode[] {
  return nodes.flatMap((node) => {
    if (!node.isFolder) {
      return selectedPaths.has(node.path) ? [node] : [];
    }
    const children = filterSelectedTree(node.children, selectedPaths);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

function RollbackFileTree({
  files,
  selectedPaths,
  onToggleSelection,
  onInvertSelection,
  onClose,
}: {
  files: GitFileStatus[];
  selectedPaths: Set<string>;
  onToggleSelection: (paths: string[]) => void;
  onInvertSelection: () => void;
  onClose: () => void;
}) {
  const treeFiles = useMemo<GitChangedFile[]>(
    () =>
      files.map((file) => ({
        path: file.path,
        status: STATUS_BY_KIND[file.kind],
      })),
    [files],
  );
  const tree = useMemo(() => buildChangedFilesTree(treeFiles), [treeFiles]);
  const filesByPath = useMemo(
    () => new Map(files.map((file) => [file.path, file])),
    [files],
  );
  const allPaths = useMemo(() => files.map((file) => file.path), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const rootSelection = selectedState(allPaths, selectedPaths);
  const folderPaths = useMemo(() => collectFolderPaths(tree), [tree]);
  const visibleTree = useMemo(
    () => (showSelectedOnly ? filterSelectedTree(tree, selectedPaths) : tree),
    [selectedPaths, showSelectedOnly, tree],
  );

  return (
    <div
      className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="rollback-file-tree"
    >
      <div
        className="flex h-control-lg min-h-control-lg shrink-0 items-center gap-1 border-b border-border px-2"
        data-testid="rollback-tree-toolbar"
      >
        <Tooltip label="Invert file selection">
          <ToolbarIconButton
            onClick={onInvertSelection}
            disabled={allPaths.length === 0}
            aria-label="Invert file selection"
            data-testid="rollback-invert-selection"
          >
            <ArrowLeftRight size={16} aria-hidden />
          </ToolbarIconButton>
        </Tooltip>
        <ToolbarSeparator />
        <Tooltip
          label={showSelectedOnly ? "Show all changes" : "Show selected changes"}
        >
          <ToolbarIconButton
            onClick={() => setShowSelectedOnly((current) => !current)}
            disabled={allPaths.length === 0}
            aria-label={showSelectedOnly ? "Show all changes" : "Show selected changes"}
            aria-pressed={showSelectedOnly}
            data-testid="rollback-toggle-preview"
          >
            <Eye size={17} aria-hidden />
          </ToolbarIconButton>
        </Tooltip>
        <span className="flex-1" />
        <Tooltip label="Expand all folders">
          <ToolbarIconButton
            onClick={() => setCollapsed(new Set())}
            disabled={folderPaths.length === 0}
            aria-label="Expand all folders"
            data-testid="rollback-expand-all"
          >
            <ChevronsDown size={17} aria-hidden />
          </ToolbarIconButton>
        </Tooltip>
        <Tooltip label="Collapse all folders">
          <ToolbarIconButton
            onClick={() => setCollapsed(new Set(folderPaths))}
            disabled={folderPaths.length === 0}
            aria-label="Collapse all folders"
            data-testid="rollback-collapse-all"
          >
            <ChevronsUp size={17} aria-hidden />
          </ToolbarIconButton>
        </Tooltip>
        <Tooltip label="Close rollback dialog">
          <ToolbarIconButton
            onClick={onClose}
            aria-label="Close rollback dialog"
            data-testid="rollback-toolbar-close"
          >
            <X size={17} aria-hidden />
          </ToolbarIconButton>
        </Tooltip>
      </div>
      <div className="flex min-h-row-lg shrink-0 items-center gap-2 border-b border-border bg-list-active px-2 text-ui font-semibold text-list-activeForeground">
        <Input
          type="checkbox"
          checked={rootSelection.all}
          className="h-4 w-4"
          ref={(element) => {
            if (element) {
              element.indeterminate = rootSelection.some && !rootSelection.all;
            }
          }}
          onChange={() => onToggleSelection(allPaths)}
          aria-label="Select all rollback changes"
          data-testid="rollback-select-all"
        />
        <span>Changes</span>
        <span className="font-normal opacity-80">
          {allPaths.length} {allPaths.length === 1 ? "file" : "files"}
        </span>
      </div>
      <ScrollArea
        axis="vertical"
        className="flex-1 py-2"
        role="tree"
        aria-label="Rollback changes"
      >
        {visibleTree.map((node) => (
          <RollbackTreeRow
            key={node.path}
            node={node}
            depth={0}
            filesByPath={filesByPath}
            selectedPaths={selectedPaths}
            collapsed={collapsed}
            onToggleSelection={onToggleSelection}
            onToggleFolder={(path) =>
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(path)) {
                  next.delete(path);
                } else {
                  next.add(path);
                }
                return next;
              })
            }
          />
        ))}
        {showSelectedOnly && visibleTree.length === 0 ? (
          <div className="px-3 py-4 text-ui-sm text-vscode-description">
            No selected changes.
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}

function selectionSummary(
  files: GitFileStatus[],
  selectedPaths: Set<string>,
): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (!selectedPaths.has(file.path)) {
      continue;
    }
    const label =
      file.kind === "renamed" || file.kind === "copied"
        ? "modified"
        : file.kind;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const order = [
    "modified",
    "added",
    "deleted",
    "unversioned",
    "conflicted",
    "ignored",
  ];
  return (
    order
      .filter((label) => (counts.get(label) ?? 0) > 0)
      .map((label) => `${counts.get(label)} ${label}`)
      .join(" · ") || "0 selected"
  );
}

export function RollbackChangesDialog({
  open,
  paths,
  selectedPaths: selectedPathsProp,
  files,
  busy = false,
  onConfirm,
  onCancel,
}: RollbackChangesDialogProps) {
  const allPaths = useMemo(() => {
    const source = paths.length > 0 ? paths : files.map((file) => file.path);
    return [...new Set(source.filter((path) => path.length > 0))];
  }, [files, paths]);
  const rollbackFiles = useMemo(() => {
    const byPath = new Map(files.map((file) => [file.path, file]));
    return allPaths.map(
      (path) =>
        byPath.get(path) ?? {
          repoId: files[0]?.repoId ?? "",
          path,
          kind: "modified" as const,
          indexStatus: "M",
          workingTreeStatus: "M",
          staged: false,
          conflicted: false,
          binary: false,
        },
    );
  }, [allPaths, files]);
  const initialSelectedPaths = useMemo(() => {
    const allowed = new Set(allPaths);
    const source = selectedPathsProp ?? allPaths;
    return [
      ...new Set(source.filter((path) => allowed.has(path))),
    ];
  }, [allPaths, selectedPathsProp]);
  const pathsKey = allPaths.join("\u0000");
  const selectedPathsKey = initialSelectedPaths.join("\u0000");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(initialSelectedPaths),
  );

  useEffect(() => {
    // Compare the path content rather than the derived array identity. The
    // dialog can receive equivalent file data from a parent refresh; that must
    // not undo a checkbox the user just cleared.
    setSelectedPaths(
      new Set(selectedPathsKey ? selectedPathsKey.split("\u0000") : []),
    );
  }, [pathsKey, selectedPathsKey]);

  const selectedCount = rollbackFiles.reduce(
    (count, file) => count + (selectedPaths.has(file.path) ? 1 : 0),
    0,
  );
  const summary = selectionSummary(rollbackFiles, selectedPaths);

  const toggleSelection = (targetPaths: string[]) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      const shouldSelect = targetPaths.some((path) => !next.has(path));
      for (const path of targetPaths) {
        if (shouldSelect) {
          next.add(path);
        } else {
          next.delete(path);
        }
      }
      return next;
    });
  };

  const invertSelection = () => {
    setSelectedPaths((current) => {
      const next = new Set<string>();
      for (const file of rollbackFiles) {
        if (!current.has(file.path)) {
          next.add(file.path);
        }
      }
      return next;
    });
  };

  return (
    <GitDialogShell
      open={open}
      title="Rollback Changes"
      titleCentered
      size="xl"
      className="!w-[min(760px,calc(100vw-var(--nx-dialog-inset)))] !h-[min(calc(100%-var(--nx-dialog-inset)),860px)]"
      testId="rollback-changes-dialog"
      onCancel={onCancel}
      footer={
        <>
          <div className="mr-auto flex min-w-0 flex-col items-start gap-1.5">
            <span
              className="text-ui text-vscode-link"
              data-testid="rollback-changes-summary"
            >
              {summary}
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="default"
            onClick={onCancel}
            data-dialog-initial-focus="true"
            data-testid="rollback-changes-close"
          >
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            size="default"
            disabled={selectedCount === 0 || busy}
            onClick={() =>
              onConfirm(
                rollbackFiles
                  .map((file) => file.path)
                  .filter((path) => selectedPaths.has(path)),
              )
            }
            data-testid="rollback-changes-confirm"
          >
            {busy ? "Rolling back…" : "Rollback"}
          </Button>
        </>
      }
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        data-testid="rollback-changes-content"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-vscode border border-border">
          <RollbackFileTree
            files={rollbackFiles}
            selectedPaths={selectedPaths}
            onToggleSelection={toggleSelection}
            onInvertSelection={invertSelection}
            onClose={onCancel}
          />
        </div>
      </div>
    </GitDialogShell>
  );
}
