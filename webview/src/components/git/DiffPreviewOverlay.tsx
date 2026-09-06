import { Button } from "../ui/Button";
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
          "color-mix(in srgb, var(--nx-widget-shadow) 38%, transparent)",
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
          background: "var(--nx-bg)",
          borderColor:
            "var(--nx-widget-border)",
          boxShadow: "0 0 24px 4px var(--nx-widget-shadow)",
          fontFamily: "var(--nx-font-app)",
          fontSize: "var(--nx-font-size-base)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="flex h-diff-preview-header min-h-diff-preview-header shrink-0 items-center justify-between border-b px-3"
          style={{
            background:
              "var(--nx-panel2)",
            borderColor:
              "var(--nx-widget-border)",
            color: "var(--nx-text)",
          }}
        >
          <span className="min-w-0 truncate font-medium">{title}</span>
          <Button variant="ghost" size="content"
            type="button"
            className="h-row shrink-0 px-2 text-ui-base hover:bg-toolbar-hover"
            onClick={close}
            data-testid="git-diff-preview-close"
          >
            Close
          </Button>
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
