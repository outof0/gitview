import { Button } from "../ui/Button";
import { useCallback, useState } from "react";
import type { BlameSnapshot } from "@gitview/shared/types/blame";
import { ToolEmptyState } from "../ui/ToolEmptyState";
import {
  BlameCodeEditor,
  type BlameSaveState,
} from "./BlameCodeEditor";
import { BlameLoadingSkeleton } from "./BlameLoadingSkeleton";
import { cn } from "../../lib/cn";

type GitBlameEditorPanelProps = {
  snapshot: BlameSnapshot | null;
  filePath: string | null;
  headSha?: string | null;
  loading?: boolean;
  error?: string | null;
  selectedSha?: string | null;
  /** 1-based line to reveal when the editor mounts. */
  focusLine?: number;
  onOpenCommit?: (sha: string) => void;
  onSaveContent?: (content: string) => void | Promise<void>;
  /** Notify host to mark the webview tab dirty (● in title). */
  onDirtyChange?: (dirty: boolean) => void;
};

function saveStateLabel(state: BlameSaveState): string | null {
  switch (state) {
    case "dirty":
      return "Modified";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    default:
      return null;
  }
}

export function GitBlameEditorPanel({
  snapshot,
  filePath,
  headSha,
  loading = false,
  error = null,
  selectedSha = null,
  focusLine,
  onOpenCommit,
  onSaveContent,
  onDirtyChange,
}: GitBlameEditorPanelProps) {
  const fileName = filePath?.split("/").pop() ?? filePath;
  const [saveState, setSaveState] = useState<BlameSaveState>("clean");

  const handleSaveStateChange = useCallback(
    (state: BlameSaveState) => {
      setSaveState(state);
      onDirtyChange?.(state === "dirty" || state === "saving" || state === "error");
    },
    [onDirtyChange],
  );

  const handleSaveClick = () => {
    document.querySelector<HTMLButtonElement>("[data-testid='blame-save-trigger']")?.click();
  };

  const dirty = saveState === "dirty" || saveState === "error";
  const status = saveStateLabel(saveState);

  return (
    <div
      className="flex-1 min-h-0 flex flex-col h-full w-full bg-vscode-editor-bg text-vscode-editor-fg"
      data-testid="git-blame-editor-panel"
      data-dirty={dirty ? "true" : "false"}
      data-save-state={saveState}
    >
      <div
        className="nx-tool-titlebar shrink-0 flex items-center gap-2 h-7 min-h-7 px-2 border-b border-vscode-panel-border bg-vscode-editor-bg font-ui"
        data-testid="blame-editor-tab"
      >
        {filePath ? (
          <span
            className={cn(
              "text-ui-sm font-editor truncate flex items-center gap-1.5 min-w-0",
              dirty
                ? "text-vscode-editor-fg font-semibold"
                : "text-vscode-editor-fg opacity-90",
            )}
            title={dirty ? `${fileName} — unsaved changes` : fileName ?? undefined}
          >
            {dirty && (
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0 bg-status-modified"
                aria-hidden
                data-testid="blame-dirty-dot"
              />
            )}
            <span className="truncate">
              {dirty ? `● ${fileName}` : fileName}
            </span>
          </span>
        ) : (
          <span className="text-ui-sm text-vscode-description">Annotate</span>
        )}

        <span className="flex-1 min-w-0" />

        {status && (
          <span
            className={cn(
              "text-section shrink-0",
              saveState === "error"
                ? "text-vscode-error"
                : saveState === "saved"
                  ? "text-testing-passed"
                  : "text-vscode-description",
            )}
            data-testid="blame-save-status"
          >
            {status}
          </span>
        )}

        {onSaveContent && filePath && (
          <Button variant="secondary" size="content"
            type="button"
            className={cn(
              "btn-vscode-secondary shrink-0 h-5 min-h-5 px-2 text-section",
              dirty
                ? "opacity-100"
                : "opacity-70",
            )}
            disabled={saveState !== "dirty" && saveState !== "error"}
            onClick={handleSaveClick}
            data-testid="blame-save-button"
            title="Save (Ctrl/Cmd+S)"
          >
            {saveState === "saving" ? "Saving…" : "Save"}
          </Button>
        )}
      </div>

      {error && (
        <div className="shrink-0 py-1 px-pad-x text-ui-sm text-vscode-error bg-[color-mix(in_srgb,var(--danger-background)_40%,transparent)]">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col h-full">
        {loading ? (
          <BlameLoadingSkeleton />
        ) : !filePath ? (
          <ToolEmptyState
            title="No file open for annotate."
            hint="Explorer → Git → Annotate with Git Blame."
            testId="blame-empty-no-file"
          />
        ) : snapshot && snapshot.lines.length > 0 ? (
          <BlameCodeEditor
            lines={snapshot.lines}
            filePath={filePath}
            headSha={headSha}
            selectedSha={selectedSha}
            focusLine={focusLine}
            onOpenCommit={onOpenCommit}
            onSaveContent={onSaveContent}
            onSaveStateChange={handleSaveStateChange}
          />
        ) : (
          <ToolEmptyState
            title="No blame data for this revision."
            hint="The file may be untracked or empty at HEAD."
            testId="blame-empty-no-data"
          />
        )}
      </div>
    </div>
  );
}
