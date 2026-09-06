import { Button } from "../ui/Button";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

type GitPanelChromeProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
};

export function GitPanelChrome({
  title,
  subtitle,
  onClose,
  footer,
  children,
  testId,
}: GitPanelChromeProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[2000] flex items-center justify-center font-sans p-5 max-surface-stacked:p-2",
        "bg-overlay-subtle",
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden text-foreground",
          "w-[min(1040px,calc(100vw-40px))] h-[min(640px,calc(100vh-40px))]",
          "max-surface-stacked:w-[calc(100vw-16px)] max-surface-stacked:h-[calc(100vh-16px)]",
          "border border-border rounded-vscode bg-vscode-widget-bg shadow-modal",
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="git-panel-dialog"
      >
        <div className="flex items-center gap-2.5 min-h-control-lg px-2.5 pl-3 border-b border-border bg-vscode-titlebar-bg">
          <span className="min-w-0 text-xs font-semibold text-foreground whitespace-nowrap">
            {title}
          </span>
          {subtitle && (
            <span className="min-w-0 overflow-hidden text-ui-sm font-normal text-vscode-description truncate">
              {subtitle}
            </span>
          )}
          <span className="flex-1" />
          <Button variant="ghost" size="content"
            type="button"
            className="inline-flex items-center justify-center w-row h-row rounded-vscode text-icon-fg hover:bg-toolbar-hover"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={14} strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-between gap-3 min-h-11 py-footer-pad-y px-3 border-t border-border bg-vscode-widget-bg max-surface-stacked:flex-wrap"
            data-testid="git-panel-footer"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
