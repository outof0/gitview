import type { ConflictFile } from "../../../stores/gitViewStoreTypes";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
} from "./ConflictsDialogIcons";
import {
  getDirectory,
  getFilename,
  getFileIcon,
} from "./conflictsDialogUtils";

type ConflictsFileTableProps = {
  conflictFiles: ConflictFile[];
  branchInfo: {
    currentBranch?: string;
    mergeHead?: string;
  } | null;
  groupDir: boolean;
  selectedPath: string | null;
  selectedFolder: string | null;
  collapsedFolders: Record<string, boolean>;
  onSelectPath: (path: string) => void;
  onSelectFolder: (folder: string) => void;
  onContextMenu: (
    e: React.MouseEvent,
    path: string,
    isFolder: boolean,
  ) => void;
  onToggleFolder: (dir: string) => void;
  onMerge: () => void;
};

export function ConflictsFileTable({
  conflictFiles,
  branchInfo,
  groupDir,
  selectedPath,
  selectedFolder,
  collapsedFolders,
  onSelectPath,
  onSelectFolder,
  onContextMenu,
  onToggleFolder,
  onMerge,
}: ConflictsFileTableProps) {
  const groups: Record<string, ConflictFile[]> = {};
  conflictFiles.forEach((file) => {
    const dir = getDirectory(file.relativePath);
    const group = groups[dir];
    if (group) {
      group.push(file);
    } else {
      groups[dir] = [file];
    }
  });

  const sortedDirs = Object.keys(groups).sort();

  return (
    <div className="flex-1 border border-border bg-background flex flex-col overflow-hidden min-w-0">
      <div className="grid grid-cols-[minmax(220px,1fr)_140px_140px] h-8 bg-[var(--vscode-editorWidget-background,var(--background))] border-b border-border font-semibold text-[13px] text-[var(--vscode-descriptionForeground,var(--foreground))] flex-shrink-0">
        <div className="px-3 flex items-center">Name</div>
        <div className="px-3 flex items-center border-l border-border overflow-hidden whitespace-nowrap text-ellipsis">
          Yours ({branchInfo?.currentBranch || "master"})
        </div>
        <div className="px-3 flex items-center border-l border-border overflow-hidden whitespace-nowrap text-ellipsis">
          Theirs ({branchInfo?.mergeHead || "incoming"})
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conflictFiles.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-[var(--vscode-descriptionForeground,#70727a)]">
            {branchInfo ? "No conflicts remaining." : "Loading conflicts…"}
          </div>
        ) : groupDir ? (
          sortedDirs.map((dir) => {
            const isCollapsed = collapsedFolders[dir];
            return (
              <div key={dir}>
                <div
                  data-testid={`conflicts-folder-row-${dir}`}
                  onClick={() => onSelectFolder(dir === "./" ? "." : dir)}
                  onContextMenu={(e) => onContextMenu(e, dir, true)}
                  className={`grid grid-cols-1 h-7 items-center text-[13px] text-foreground cursor-pointer hover:bg-list-hover ${
                    selectedFolder === dir ||
                    (dir === "./" && selectedFolder === ".")
                      ? "bg-list-active text-list-activeForeground hover:bg-list-active"
                      : ""
                  }`}
                >
                  <div className="px-2 font-semibold flex items-center gap-1">
                    <span
                      data-folder-chevron
                      aria-label={`Toggle folder ${dir}`}
                      className="w-4 h-4 flex items-center justify-center text-foreground/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFolder(dir);
                      }}
                    >
                      {isCollapsed ? (
                        <ChevronRightIcon />
                      ) : (
                        <ChevronDownIcon />
                      )}
                    </span>
                    <FolderIcon className="w-4 h-4 text-foreground/75 flex-shrink-0" />
                    <span>{dir}</span>
                  </div>
                </div>

                {!isCollapsed &&
                  // `!`: `dir` comes from `Object.keys(groups)`.
                  groups[dir]!.map((file) => {
                    const isSelected = selectedPath === file.relativePath;
                    const filename = getFilename(file.relativePath);
                    return (
                      <div
                        key={file.relativePath}
                        data-testid={`conflicts-file-row-${file.relativePath}`}
                        onClick={() => onSelectPath(file.relativePath)}
                        onDoubleClick={onMerge}
                        onContextMenu={(e) =>
                          onContextMenu(e, file.relativePath, false)
                        }
                        className={`grid grid-cols-[minmax(220px,1fr)_140px_140px] h-6 items-center text-[13px] text-foreground cursor-pointer hover:bg-list-hover ${
                          isSelected
                            ? "bg-list-active text-list-activeForeground hover:bg-list-active"
                            : ""
                        }`}
                      >
                        <div className="px-3 pl-7 flex items-center overflow-hidden text-ellipsis whitespace-nowrap">
                          {getFileIcon(filename)}
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {filename}
                          </span>
                        </div>
                        <div
                          className={`px-3 h-full flex items-center ${
                            isSelected
                              ? "text-list-activeForeground"
                              : "text-[var(--vscode-descriptionForeground,#c7c9cf)]"
                          }`}
                        >
                          Modified
                        </div>
                        <div
                          className={`px-3 h-full flex items-center ${
                            isSelected
                              ? "text-list-activeForeground"
                              : "text-[var(--vscode-descriptionForeground,#c7c9cf)]"
                          }`}
                        >
                          Modified
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })
        ) : (
          conflictFiles.map((file) => {
            const isSelected = selectedPath === file.relativePath;
            const filename = getFilename(file.relativePath);
            return (
              <div
                key={file.relativePath}
                data-testid={`conflicts-file-row-${file.relativePath}`}
                onClick={() => onSelectPath(file.relativePath)}
                onDoubleClick={onMerge}
                onContextMenu={(e) =>
                  onContextMenu(e, file.relativePath, false)
                }
                className={`grid grid-cols-[minmax(220px,1fr)_140px_140px] h-6 items-center text-[13px] text-foreground cursor-pointer hover:bg-list-hover ${
                  isSelected
                    ? "bg-list-active text-list-activeForeground hover:bg-list-active"
                    : ""
                }`}
              >
                <div className="px-3 flex items-center overflow-hidden text-ellipsis whitespace-nowrap">
                  {getFileIcon(filename)}
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {file.relativePath}
                  </span>
                </div>
                <div
                  className={`px-3 h-full flex items-center ${
                    isSelected
                      ? "text-list-activeForeground"
                      : "text-[var(--vscode-descriptionForeground,#c7c9cf)]"
                  }`}
                >
                  Modified
                </div>
                <div
                  className={`px-3 h-full flex items-center ${
                    isSelected
                      ? "text-list-activeForeground"
                      : "text-[var(--vscode-descriptionForeground,#c7c9cf)]"
                  }`}
                >
                  Modified
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}