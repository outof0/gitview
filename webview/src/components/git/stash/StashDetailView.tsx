import { Button } from "../../ui/Button";
import { ToolbarIconButton } from "../../ui/ToolbarControls";
import { Tooltip } from "../../ui/Tooltip";
import { useCallback, useMemo, useState, memo } from "react";
import { ChevronDown, ChevronRight, List, ListTree } from "lucide-react";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type {
  StashDetail,
  StashFileEntry,
  StashFileStatus,
} from "@gitview/shared/types/stash";
import { ResizableSplit } from "../../ui/ResizableSplit";
import { WorkspaceDiffPanel } from "../WorkspaceDiffPanel";
import { cn } from "../../../lib/cn";
import {
  fileStatusTokenClass,
  type FileStatusVisual,
} from "../../../lib/fileStatusTheme";
import { GitFileIcon } from "../gitFileIcon";

type StashDetailViewProps = {
  detail: StashDetail | null;
  loading?: boolean;
  error?: string | null;
  selectedFile: StashFileEntry | null;
  onSelectFile: (file: StashFileEntry) => void;
  fileDiff: WorkspaceDiffDocument | null;
  fileDiffLoading?: boolean;
  fileDiffError?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  A: "Added",
  M: "Modified",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  T: "Type changed",
  U: "Unmerged",
};

function fileKey(file: StashFileEntry): string {
  return `${file.origin}:${file.path}`;
}

function visualStatusFromStashStatus(status: StashFileStatus): FileStatusVisual {
  switch (status) {
    case "A":
    case "C":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "U":
      return "conflicted";
    case "M":
    case "T":
      return "modified";
  }
}

type StashTreeNode = {
  name: string;
  path: string;
  isFolder: boolean;
  file?: StashFileEntry;
  children: StashTreeNode[];
};

type MutableStashTreeNode = StashTreeNode & {
  childMap: Map<string, MutableStashTreeNode>;
};

function buildStashFileTree(files: StashFileEntry[]): StashTreeNode[] {
  const root: MutableStashTreeNode = {
    name: "",
    path: "",
    isFolder: true,
    children: [],
    childMap: new Map(),
  };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;
    let builtPath = "";

    for (const [index, part] of parts.entries()) {
      const isLast = index === parts.length - 1;
      builtPath = builtPath ? `${builtPath}/${part}` : part;
      let child = current.childMap.get(part);
      if (!child) {
        child = {
          name: part,
          path: builtPath,
          isFolder: !isLast,
          file: isLast ? file : undefined,
          children: [],
          childMap: new Map(),
        };
        current.childMap.set(part, child);
        current.children.push(child);
      } else if (isLast) {
        child.isFolder = false;
        child.file = file;
      }
      current = child;
    }
  }

  const sortNodes = (nodes: StashTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  sortNodes(root.children);
  return root.children;
}

function StashFolderIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-icon-fg"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M14.5 3H8.2L6.7 1.5H1.5c-.8 0-1.5.7-1.5 1.5v10c0 .8.7 1.5 1.5 1.5h13c.8 0 1.5-.7 1.5-1.5V4.5c0-.8-.7-1.5-1.5-1.5z" />
    </svg>
  );
}

type StashFileRowProps = {
  file: StashFileEntry;
  selected: boolean;
  stagedPaths: Set<string>;
  depth?: number;
  onSelectFile: (file: StashFileEntry) => void;
};

function StashFileRow({
  file,
  selected,
  stagedPaths,
  depth,
  onSelectFile,
}: StashFileRowProps) {
  const visual = visualStatusFromStashStatus(file.status);
  const statusClass = fileStatusTokenClass(visual);
  const isTree = depth !== undefined;

  return (
    <Button
      variant="ghost"
      size="content"
      type="button"
      role={isTree ? "treeitem" : "option"}
      aria-selected={selected}
      aria-level={isTree ? depth + 1 : undefined}
      onClick={() => onSelectFile(file)}
      className={cn(
        "w-full text-left border-0 bg-transparent cursor-pointer",
        "flex items-center gap-1.5 min-h-row text-ui",
        isTree ? "py-1 pr-2" : "px-1.5",
        selected
          ? "bg-list-active text-list-activeForeground"
          : "hover:bg-list-hover",
      )}
      style={isTree ? { paddingLeft: `${22 + depth * 14}px` } : undefined}
      data-testid={`stash-file-${file.path}`}
      title={
        file.oldPath
          ? `${STATUS_LABEL[file.status]} from ${file.oldPath}`
          : STATUS_LABEL[file.status]
      }
    >
      <span
        className={`shrink-0 w-4 text-center font-mono font-bold ${statusClass}`}
        aria-label={STATUS_LABEL[file.status]}
      >
        {file.status}
      </span>
      <GitFileIcon fileName={file.path} />
      <span
        className={cn(
          "flex-1 min-w-0 truncate",
          !selected && statusClass,
          visual === "deleted" && !selected && "line-through opacity-90",
        )}
      >
        {isTree ? file.path.slice(file.path.lastIndexOf("/") + 1) : file.path}
      </span>
      {file.origin === "untracked" ? (
        <span
          className="shrink-0 text-ui-sm opacity-70"
          data-testid={`stash-file-untracked-${file.path}`}
        >
          untracked
        </span>
      ) : stagedPaths.has(file.path) ? (
        <span
          className="shrink-0 text-ui-sm opacity-70"
          data-testid={`stash-file-staged-${file.path}`}
        >
          staged
        </span>
      ) : null}
    </Button>
  );
}

type StashTreeRowProps = {
  node: StashTreeNode;
  depth: number;
  selectedFile: StashFileEntry | null;
  stagedPaths: Set<string>;
  collapsed: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (file: StashFileEntry) => void;
};

const StashTreeRow = memo(function StashTreeRow({
  node,
  depth,
  selectedFile,
  stagedPaths,
  collapsed,
  onToggleFolder,
  onSelectFile,
}: StashTreeRowProps) {
  const open = !collapsed.has(node.path);

  if (node.isFolder) {
    return (
      <div
        role="treeitem"
        aria-expanded={open}
        data-testid={`stash-folder-${node.path}`}
      >
        <Button
          variant="ghost"
          size="content"
          type="button"
          className="w-full text-left flex items-center gap-1 py-1 pr-2 min-h-row text-ui border-none bg-transparent cursor-pointer text-foreground hover:bg-list-hover"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onToggleFolder(node.path)}
          data-testid={`stash-folder-toggle-${node.path}`}
          aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
        >
          {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
          <StashFolderIcon />
          <span className="truncate font-semibold text-icon-fg">{node.name}</span>
        </Button>
        {open
          ? node.children.map((child) => (
              <StashTreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                stagedPaths={stagedPaths}
                collapsed={collapsed}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))
          : null}
      </div>
    );
  }

  if (!node.file) {
    return null;
  }

  return (
    <StashFileRow
      file={node.file}
      selected={selectedFile !== null && fileKey(selectedFile) === fileKey(node.file)}
      stagedPaths={stagedPaths}
      depth={depth}
      onSelectFile={onSelectFile}
    />
  );
});

export function StashDetailView({
  detail,
  loading = false,
  error = null,
  selectedFile,
  onSelectFile,
  fileDiff,
  fileDiffLoading = false,
  fileDiffError = null,
}: StashDetailViewProps) {
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  const stagedPaths = new Set((detail?.indexFiles ?? []).map((f) => f.path));
  const tree = useMemo(
    () => buildStashFileTree(detail?.files ?? []),
    [detail?.files],
  );
  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const fileList = (
    <div className="h-full min-h-0 flex flex-col" data-testid="stash-detail-files">
      <div className="shrink-0 h-toolbar min-h-toolbar px-pad-x flex items-center justify-between text-section font-semibold uppercase tracking-wide text-vscode-description border-b border-border">
        <span>{detail ? `${detail.files.length} changed` : "Changes"}</span>
        <div
          className="flex items-center gap-0.5 normal-case tracking-normal"
          role="group"
          aria-label="Changed files view"
        >
          <Tooltip label="Tree view">
            <ToolbarIconButton
              onClick={() => setViewMode("tree")}
              aria-label="Tree view"
              aria-pressed={viewMode === "tree"}
              data-testid="stash-view-mode-tree"
              className={viewMode === "tree" ? "bg-list-hover text-foreground" : ""}
            >
              <ListTree size={14} aria-hidden />
            </ToolbarIconButton>
          </Tooltip>
          <Tooltip label="Flat view">
            <ToolbarIconButton
              onClick={() => setViewMode("flat")}
              aria-label="Flat view"
              aria-pressed={viewMode === "flat"}
              data-testid="stash-view-mode-flat"
              className={viewMode === "flat" ? "bg-list-hover text-foreground" : ""}
            >
              <List size={14} aria-hidden />
            </ToolbarIconButton>
          </Tooltip>
        </div>
      </div>
      {loading ? (
        <div className="px-1.5 py-2 text-vscode-description" data-testid="stash-detail-loading">
          Loading changes…
        </div>
      ) : error ? (
        <div
          className="px-1.5 py-2 text-danger-fg"
          data-testid="stash-detail-error"
        >
          {error}
        </div>
      ) : (detail?.files.length ?? 0) === 0 ? (
        <div className="px-1.5 py-2 text-vscode-description" data-testid="stash-detail-empty">
          This stash has no changes.
        </div>
      ) : (
        viewMode === "tree" ? (
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            role="tree"
            data-testid="stash-file-tree"
          >
            {tree.map((node) => (
              <StashTreeRow
                key={node.path}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                stagedPaths={stagedPaths}
                collapsed={collapsedFolders}
                onToggleFolder={toggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto m-0 p-0 list-none" role="listbox">
            {detail?.files.map((file) => (
              <li key={fileKey(file)} className="list-none">
                <StashFileRow
                  file={file}
                  selected={
                    selectedFile !== null && fileKey(selectedFile) === fileKey(file)
                  }
                  stagedPaths={stagedPaths}
                  onSelectFile={onSelectFile}
                />
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );

  const diffPane = (
    <div className="h-full min-h-0 flex flex-col" data-testid="stash-detail-diff">
      {selectedFile === null ? (
        <div className="px-1.5 py-2 text-vscode-description">
          Select a file to see its changes.
        </div>
      ) : (
        <WorkspaceDiffPanel
          document={fileDiff}
          filePath={selectedFile.path}
          loading={fileDiffLoading}
          error={fileDiffError}
          borderless
        />
      )}
    </div>
  );

  return (
    <ResizableSplit
      direction="horizontal"
      initialPercent={34}
      minFirstPercent={20}
      minSecondPercent={30}
      storageKey="nx.stash.detail.split"
      className="flex-1 min-h-0 border border-border rounded-vscode overflow-hidden"
      first={fileList}
      second={diffPane}
    />
  );
}
