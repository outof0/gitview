import { GitHistoryDiffViewer } from "./GitHistoryDiffViewer";
import { useDiffPreviewStore } from "../../stores/diffPreviewStore";

export function DiffPreviewOverlay() {
  const open = useDiffPreviewStore((s) => s.open);
  const title = useDiffPreviewStore((s) => s.title);
  const relativePath = useDiffPreviewStore((s) => s.relativePath);
  const diff = useDiffPreviewStore((s) => s.diff);
  const close = useDiffPreviewStore((s) => s.closeDiffPreview);

  if (!open || !diff) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-6"
      data-testid="git-diff-preview-overlay"
    >
      <div className="w-[min(960px,calc(100vw-48px))] h-[min(560px,calc(100vh-48px))] bg-[var(--vscode-editorWidget-background,var(--background))] border border-border rounded-vscode shadow-2xl flex flex-col overflow-hidden">
        <div className="h-9 px-3 flex items-center justify-between border-b border-border flex-shrink-0">
          <span className="text-xs font-medium truncate">{title}</span>
          <button
            type="button"
            className="text-xs px-2 py-1 hover:bg-menu-selection rounded"
            onClick={close}
            data-testid="git-diff-preview-close"
          >
            Close
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <GitHistoryDiffViewer diff={diff} filePath={relativePath} />
        </div>
      </div>
    </div>
  );
}