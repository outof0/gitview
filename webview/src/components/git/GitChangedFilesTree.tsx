import { memo, useCallback, useMemo, useState } from "react";
import type { GitChangedFile } from "@gitview/types";
import {
  buildChangedFilesTree,
  type ChangedFileTreeNode,
} from "./changedFilesTree";
import {
  changedFileRowBgClass,
  changedFileStatusBadgeClass,
  changedFileStatusTextClass,
} from "./changedFileStatus";
import { GitFileIcon } from "./gitFileIcon";
import { statusBadge } from "./gitPanelFormat";

type GitChangedFilesTreeProps = {
  files: GitChangedFile[];
  selectedPath: string | null;
  highlightPath?: string;
  onSelectFile: (path: string) => void;
  onContextMenuFile?: (e: React.MouseEvent, path: string) => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6 4l4 4-4 4z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0 text-[#c5c5c5]"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M14.5 3H8.2L6.7 1.5H1.5c-.8 0-1.5.7-1.5 1.5v10c0 .8.7 1.5 1.5 1.5h13c.8 0 1.5-.7 1.5-1.5V4.5c0-.8-.7-1.5-1.5-1.5z" />
    </svg>
  );
}

const TreeRow = memo(function TreeRow({
  node,
  depth,
  selectedPath,
  highlightPath,
  collapsed,
  onToggle,
  onSelectFile,
  onContextMenuFile,
}: {
  node: ChangedFileTreeNode;
  depth: number;
  selectedPath: string | null;
  highlightPath?: string;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onSelectFile: (path: string) => void;
  onContextMenuFile?: (e: React.MouseEvent, path: string) => void;
}) {
  const isOpen = !collapsed.has(node.path);
  const isSelected = !node.isFolder && selectedPath === node.path;
  const isHighlighted =
    !!highlightPath &&
    !node.isFolder &&
    (node.path === highlightPath || node.path.endsWith(`/${highlightPath}`));

  if (node.isFolder) {
    return (
      <>
        <button
          type="button"
          className="w-full text-left flex items-center gap-1 py-0.5 pr-2 text-[11px] font-mono hover:bg-list-hover border-none bg-transparent cursor-pointer text-foreground"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onToggle(node.path)}
          data-testid={`changed-files-folder-${node.path}`}
        >
          <Chevron open={isOpen} />
          <FolderIcon />
          <span className="truncate font-semibold text-[#c5c5c5]">
            {node.name}
          </span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              highlightPath={highlightPath}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              onContextMenuFile={onContextMenuFile}
            />
          ))}
      </>
    );
  }

  const status = node.status ?? "M";

  return (
    <button
      type="button"
      className={`w-full text-left flex items-center gap-1 py-0.5 pr-2 text-[11px] font-mono border-none cursor-pointer truncate ${changedFileRowBgClass(status, isSelected, isHighlighted)}`}
      style={{ paddingLeft: `${22 + depth * 14}px` }}
      onClick={() => onSelectFile(node.path)}
      onContextMenu={
        onContextMenuFile
          ? (e) => {
              e.preventDefault();
              onContextMenuFile(e, node.path);
            }
          : undefined
      }
      data-testid={`changed-files-file-${node.path}`}
      title={`${statusBadge(status)} ${node.path}`}
    >
      <span
        className={`inline-block w-4 shrink-0 text-center ${changedFileStatusBadgeClass(status)}`}
      >
        {statusBadge(status)}
      </span>
      <GitFileIcon fileName={node.name} />
      <span
        className={`truncate ${isSelected ? "" : changedFileStatusTextClass(status)}`}
      >
        {node.name}
      </span>
    </button>
  );
});

export function GitChangedFilesTree({
  files,
  selectedPath,
  highlightPath,
  onSelectFile,
  onContextMenuFile,
}: GitChangedFilesTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Rebuilding on every render would re-walk every path on each folder toggle.
  const tree = useMemo(() => buildChangedFilesTree(files), [files]);

  const toggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (files.length === 0) {
    return (
      <div className="px-3 py-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
        No file changes in this revision.
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-auto" data-testid="git-changed-files-tree">
      {tree.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          highlightPath={highlightPath}
          collapsed={collapsed}
          onToggle={toggle}
          onSelectFile={onSelectFile}
          onContextMenuFile={onContextMenuFile}
        />
      ))}
    </div>
  );
}
