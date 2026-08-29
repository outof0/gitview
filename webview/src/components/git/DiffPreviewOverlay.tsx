import { useEffect } from "react";
import { GitHistoryDiffViewer } from "./GitHistoryDiffViewer";
import { useDiffPreviewStore } from "../../stores/diffPreviewStore";

export function DiffPreviewOverlay() {
  const open = useDiffPreviewStore((s) => s.open);
  const title = useDiffPreviewStore((s) => s.title);
  const relativePath = useDiffPreviewStore((s) => s.relativePath);
  const diff = useDiffPreviewStore((s) => s.diff);
  const close = useDiffPreviewStore((s) => s.closeDiffPreview);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, close]);

  if (!open || !diff) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{
        background:
          "color-mix(in srgb, var(--vscode-widget-shadow, #000000) 38%, transparent)",
      }}
      data-testid="git-diff-preview-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden border"
        style={{
          width: "min(1120px, calc(100% - 24px))",
          height: "min(760px, calc(100% - 24px))",
          background: "var(--vscode-editor-background, var(--background))",
          borderColor:
            "var(--vscode-widget-border, var(--vscode-editorWidget-border, var(--border)))",
          boxShadow: "0 0 24px 4px var(--vscode-widget-shadow, rgba(0,0,0,0.36))",
          fontFamily: "var(--vscode-font-family)",
          fontSize: "var(--vscode-font-size, 13px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="flex h-[35px] min-h-[35px] shrink-0 items-center justify-between border-b px-3"
          style={{
            background:
              "var(--vscode-editorWidget-background, var(--vscode-titleBar-activeBackground))",
            borderColor:
              "var(--vscode-widget-border, var(--vscode-editorWidget-border, var(--border)))",
            color: "var(--vscode-foreground)",
          }}
        >
          <span className="min-w-0 truncate font-medium">{title}</span>
          <button
            type="button"
            className="h-[22px] shrink-0 px-2 text-[length:var(--vscode-font-size,13px)] hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            onClick={close}
            data-testid="git-diff-preview-close"
          >
            Close
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <GitHistoryDiffViewer
            diff={diff}
            filePath={relativePath}
            variant="standalone"
          />
        </div>
      </div>
    </div>
  );
}
