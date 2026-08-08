import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { StashDetail, StashFileEntry } from "@gitview/shared/types/stash";
import { ResizableSplit } from "../../ui/ResizableSplit";
import { WorkspaceDiffPanel } from "../WorkspaceDiffPanel";
import { cn } from "../../../lib/cn";

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
  const stagedPaths = new Set((detail?.indexFiles ?? []).map((f) => f.path));

  const fileList = (
    <div className="h-full min-h-0 flex flex-col" data-testid="stash-detail-files">
      <div className="shrink-0 h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] px-[var(--nx-pad-x)] flex items-center text-[length:var(--nx-font-size-section)] font-semibold uppercase tracking-wide text-vscode-description border-b border-border">
        {detail ? `${detail.files.length} changed` : "Changes"}
      </div>
      {loading ? (
        <div className="px-1.5 py-2 text-vscode-description" data-testid="stash-detail-loading">
          Loading changes…
        </div>
      ) : error ? (
        <div
          className="px-1.5 py-2 text-[var(--vscode-inputValidation-errorForeground)]"
          data-testid="stash-detail-error"
        >
          {error}
        </div>
      ) : (detail?.files.length ?? 0) === 0 ? (
        <div className="px-1.5 py-2 text-vscode-description" data-testid="stash-detail-empty">
          This stash has no changes.
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto m-0 p-0 list-none" role="listbox">
          {detail?.files.map((file) => {
            const selected =
              selectedFile !== null && fileKey(selectedFile) === fileKey(file);
            return (
              <li key={fileKey(file)} className="list-none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelectFile(file)}
                  className={cn(
                    "w-full text-left border-0 bg-transparent cursor-pointer",
                    "flex items-center gap-1.5 px-1.5 min-h-[var(--nx-row-h)]",
                    "text-[length:var(--nx-font-size-ui)]",
                    selected
                      ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
                      : "hover:bg-list-hover",
                  )}
                  data-testid={`stash-file-${file.path}`}
                  title={
                    file.oldPath
                      ? `${STATUS_LABEL[file.status]} from ${file.oldPath}`
                      : STATUS_LABEL[file.status]
                  }
                >
                  <span
                    className="shrink-0 w-3 font-mono opacity-80"
                    aria-label={STATUS_LABEL[file.status]}
                  >
                    {file.status}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{file.path}</span>
                  {file.origin === "untracked" ? (
                    <span
                      className="shrink-0 text-[length:var(--nx-font-size-ui-sm)] opacity-70"
                      data-testid={`stash-file-untracked-${file.path}`}
                    >
                      untracked
                    </span>
                  ) : stagedPaths.has(file.path) ? (
                    <span
                      className="shrink-0 text-[length:var(--nx-font-size-ui-sm)] opacity-70"
                      data-testid={`stash-file-staged-${file.path}`}
                    >
                      staged
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
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
