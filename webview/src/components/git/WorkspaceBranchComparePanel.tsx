import { Button } from "../ui/Button";
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
        <span className="text-ui font-semibold flex-1 truncate">{title}</span>
        {selectedFilePath && onApplyFile && diffDocument?.binary && (
          <span
            className="text-ui-sm text-vscode-description"
            data-testid="branch-compare-apply-unavailable"
          >
            Binary file — apply not available
          </span>
        )}
        {selectedFilePath && onApplyFile && !diffDocument?.binary && (
          <Button variant="ghost" size="content"
            type="button"
            className="h-7 px-2 text-ui-sm rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
            onClick={() => onApplyFile(selectedFilePath)}
            disabled={busy}
            data-testid="branch-compare-apply-file"
          >
            Apply file from branch
          </Button>
        )}
        <Button variant="ghost" size="content"
          type="button"
          className="h-7 px-2 text-ui-sm rounded-vscode border border-border hover:bg-list-hover"
          onClick={onClose}
          data-testid="branch-compare-close"
        >
          Close
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div
          className="w-branch-compare shrink-0 border-r border-border overflow-y-auto"
          data-testid="branch-compare-files"
        >
          {snapshot.files.length === 0 ? (
            <div className="p-3 text-ui text-vscode-description">
              No file differences.
            </div>
          ) : (
            snapshot.files.map((file) => (
              <Button variant="ghost" size="content"
                key={file.path}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-ui-sm font-mono hover:bg-list-hover ${
                  selectedFilePath === file.path
                    ? "bg-list-active text-list-activeForeground"
                    : ""
                }`}
                onClick={() => onSelectFile(file.path)}
                data-testid={`branch-compare-file-${file.path}`}
              >
                <span className="mr-2 text-vscode-description">
                  {changedFileStatusLabel(file.status)}
                </span>
                {file.path}
              </Button>
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
