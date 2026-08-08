import type { BranchCompareSnapshot } from "@gitview/shared/types/branch";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import { WorkspaceDiffPanel } from "./WorkspaceDiffPanel";
import { changedFileStatusLabel } from "./changedFileStatus";

type WorkspaceBranchComparePanelProps = {
  snapshot: BranchCompareSnapshot;
  selectedFilePath: string | null;
  diffDocument: WorkspaceDiffDocument | null;
  diffLoading?: boolean;
  diffError?: string | null;
  busy?: boolean;
  onSelectFile: (path: string) => void;
  onApplyFile?: (path: string) => void;
  onClose: () => void;
};

export function WorkspaceBranchComparePanel({
  snapshot,
  selectedFilePath,
  diffDocument,
  diffLoading = false,
  diffError = null,
  busy = false,
  onSelectFile,
  onApplyFile,
  onClose,
}: WorkspaceBranchComparePanelProps) {
  const title =
    snapshot.mode === "current"
      ? `Compare ${snapshot.selectedLabel} with ${snapshot.baseLabel}`
      : `Compare ${snapshot.baseLabel} with ${snapshot.selectedLabel}`;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      data-testid="workspace-branch-compare-panel"
    >
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-[12px] font-semibold flex-1 truncate">{title}</span>
        {selectedFilePath && onApplyFile && (
          <button
            type="button"
            className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
            onClick={() => onApplyFile(selectedFilePath)}
            disabled={busy}
            data-testid="branch-compare-apply-file"
          >
            Apply file from branch
          </button>
        )}
        <button
          type="button"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover"
          onClick={onClose}
          data-testid="branch-compare-close"
        >
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div
          className="w-[220px] shrink-0 border-r border-border overflow-y-auto"
          data-testid="branch-compare-files"
        >
          {snapshot.files.length === 0 ? (
            <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
              No file differences.
            </div>
          ) : (
            snapshot.files.map((file) => (
              <button
                key={file.path}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-list-hover ${
                  selectedFilePath === file.path ? "bg-list-active" : ""
                }`}
                onClick={() => onSelectFile(file.path)}
                data-testid={`branch-compare-file-${file.path}`}
              >
                <span className="mr-2 text-[var(--vscode-descriptionForeground)]">
                  {changedFileStatusLabel(file.status)}
                </span>
                {file.path}
              </button>
            ))
          )}
        </div>
        <WorkspaceDiffPanel
          document={diffDocument}
          filePath={selectedFilePath}
          loading={diffLoading}
          error={diffError}
          busy={busy}
          borderless
        />
      </div>
    </div>
  );
}