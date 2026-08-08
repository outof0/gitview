import { useState, useEffect } from "react";
import { useGitViewStore } from "../../stores/gitViewStore";
import { useGitPanels } from "../../hooks/useGitPanels";
import { useMergeClientContext } from "../../hooks/merge/mergeClientContext";
import { ContextMenu } from "../ui/ContextMenu";
import { buildGitMenuActionPayload } from "@gitview/types";
import { ConflictsConfirmModal } from "./conflictsDialog/ConflictsConfirmModal";
import {
  ConflictsContextMenuContent,
  type ConflictsContextMenuState,
} from "./conflictsDialog/ConflictsContextMenuContent";
import { ConflictsFileTable } from "./conflictsDialog/ConflictsFileTable";

export function ConflictsDialog() {
  const { conflictFiles, branchInfo } = useGitViewStore();
  const client = useMergeClientContext();
  const { requestGitHistory } = useGitPanels();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [groupDir, setGroupDir] = useState<boolean>(false);
  const [collapsedFolders, setCollapsedFolders] = useState<
    Record<string, boolean>
  >({});
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<ConflictsContextMenuState | null>(
    null,
  );

  useEffect(() => {
    if (conflictFiles.length > 0) {
      if (selectedFolder) {
        return;
      }
      if (
        !selectedPath ||
        !conflictFiles.some((f) => f.relativePath === selectedPath)
      ) {
        // `!`: guarded by the `conflictFiles.length > 0` check above.
        setSelectedPath(conflictFiles[0]!.relativePath);
      }
    } else {
      setSelectedPath(null);
      setSelectedFolder(null);
    }
  }, [conflictFiles, selectedPath, selectedFolder]);

  const handleCloseAttempt = () => {
    if (conflictFiles.length > 0) {
      setShowConfirm(true);
    } else {
      void client.closePanel();
    }
  };

  const handleAcceptYours = () => {
    if (selectedPath) {
      if (client.repoId) {
        void client.acceptConflictLocal(client.repoId, [selectedPath]);
      }
    }
  };

  const handleAcceptTheirs = () => {
    if (selectedPath) {
      if (client.repoId) {
        void client.acceptConflictIncoming(client.repoId, [selectedPath]);
      }
    }
  };

  const handleMerge = () => {
    if (selectedPath) {
      if (client.repoId) {
        void client.openMergeFile(client.repoId, selectedPath);
      }
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    path: string,
    isFolder: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFolder) {
      setSelectedFolder(path === "./" ? "." : path);
      setSelectedPath(null);
    } else {
      setSelectedPath(path);
      setSelectedFolder(null);
    }
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      path: isFolder && path === "./" ? "." : path,
      isFolder,
    });
  };

  const toggleFolder = (dir: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [dir]: !prev[dir],
    }));
  };

  return (
    <div className="absolute inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center select-none font-sans p-6">
      <div
        className="w-[min(920px,calc(100%-48px))] h-[min(560px,calc(100%-48px))] max-h-full bg-[var(--vscode-editorWidget-background,var(--background))] border border-border rounded-vscode shadow-2xl flex flex-col overflow-hidden text-foreground"
        role="dialog"
        aria-modal="true"
        aria-label="Conflicts"
        data-testid="conflicts-dialog"
      >
        <div className="h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] px-[var(--nx-pad-x)] bg-[var(--vscode-editorWidget-background,var(--background))] grid grid-cols-[1fr_auto_1fr] items-center flex-shrink-0 border-b border-border font-[family-name:var(--nx-font-ui)]">
          <span />
          <span className="text-[length:var(--nx-font-size-ui)] font-semibold text-foreground">
            Conflicts
          </span>
          <button
            onClick={handleCloseAttempt}
            className="justify-self-end w-[var(--nx-row-h)] h-[var(--nx-row-h)] flex items-center justify-center rounded-vscode hover:bg-list-hover text-foreground/70 hover:text-foreground cursor-pointer border-none bg-transparent outline-none"
            title="Close"
            aria-label="Close conflicts dialog"
          >
            <span className="text-[length:var(--nx-font-size-ui)]">✕</span>
          </button>
        </div>

        <div className="flex-1 px-[var(--nx-pad-x)] pb-2 pt-2 flex flex-col gap-2 min-h-0 font-[family-name:var(--nx-font-ui)]">
          {branchInfo && (
            <div className="text-[length:var(--nx-font-size-ui)] leading-snug text-foreground/90 flex-shrink-0">
              Merging branch{" "}
              <strong>{branchInfo.mergeHead || "incoming"}</strong> into branch{" "}
              <strong>{branchInfo.currentBranch}</strong>
            </div>
          )}

          <div className="flex-1 flex gap-3 min-h-0">
            <ConflictsFileTable
              conflictFiles={conflictFiles}
              branchInfo={branchInfo}
              groupDir={groupDir}
              selectedPath={selectedPath}
              selectedFolder={selectedFolder}
              collapsedFolders={collapsedFolders}
              onSelectPath={(path) => {
                setSelectedPath(path);
                setSelectedFolder(null);
              }}
              onSelectFolder={(folder) => {
                setSelectedFolder(folder);
                setSelectedPath(null);
              }}
              onContextMenu={handleContextMenu}
              onToggleFolder={toggleFolder}
              onMerge={handleMerge}
            />

            <div className="w-[136px] flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={handleAcceptYours}
                disabled={!selectedPath}
                className="btn-vscode-secondary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                title="Accept Yours version for selected file"
              >
                Accept Yours
              </button>
              <button
                onClick={handleAcceptTheirs}
                disabled={!selectedPath}
                className="btn-vscode-secondary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                title="Accept Theirs version for selected file"
              >
                Accept Theirs
              </button>
              <button
                onClick={handleMerge}
                disabled={!selectedPath}
                className="btn-vscode w-full disabled:opacity-40 disabled:cursor-not-allowed"
                title="Open Conflict resolver"
              >
                Merge...
              </button>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-[var(--vscode-editorWidget-background,var(--background))] px-3 pt-2.5 pb-3 font-[family-name:var(--nx-font-ui)]"
          data-testid="conflicts-dialog-footer"
        >
          <label className="flex items-center gap-1.5 text-[length:var(--nx-font-size-ui-sm)] text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={groupDir}
              onChange={(e) => setGroupDir(e.target.checked)}
              className="cursor-pointer"
            />
            Group files by directory
          </label>
          <button
            onClick={handleCloseAttempt}
            className="btn-vscode-secondary min-w-[72px] h-[var(--nx-row-h)] text-[length:var(--nx-font-size-ui-sm)]"
            data-testid="conflicts-dialog-close"
          >
            Close
          </button>
        </div>
      </div>
      </div>

      {showConfirm && (
        <ConflictsConfirmModal
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            void client.closePanel();
          }}
        />
      )}

      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        testId="conflicts-context-menu"
      >
        {contextMenu && (
          <ConflictsContextMenuContent
            contextMenu={contextMenu}
            onClose={() => setContextMenu(null)}
            onMergeFile={(path) => {
              if (client.repoId) {
                void client.openMergeFile(client.repoId, path);
              }
            }}
            onAcceptYours={(path) => {
              if (client.repoId) {
                void client.acceptConflictLocal(client.repoId, [path]);
              }
            }}
            onAcceptTheirs={(path) => {
              if (client.repoId) {
                void client.acceptConflictIncoming(client.repoId, [path]);
              }
            }}
            onShowHistory={(path, isFolder) => requestGitHistory(path, isFolder)}
            onGitAction={(action, path, isFolder) => {
              if (client.repoId) {
                void client.menuAction(
                  client.repoId,
                  buildGitMenuActionPayload(action, {
                    relativePath: path,
                    isFolder,
                  }),
                );
              }
            }}
          />
        )}
      </ContextMenu>
    </div>
  );
}