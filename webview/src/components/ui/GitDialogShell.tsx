import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type GitDialogSize = "default" | "wide" | "xl";

type GitDialogShellProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  testId?: string;
  className?: string;
  /** Wider body for lists / multi-root confirmations. Alias for size="wide". */
  wide?: boolean;
  /** "xl" fills the viewport for list + diff layouts and lets children scroll. */
  size?: GitDialogSize;
};

const SIZE_CLASSES: Record<GitDialogSize, string> = {
  default: "w-[min(400px,calc(100vw-24px))] max-h-[min(80vh,640px)] overflow-auto",
  wide: "w-[min(520px,calc(100vw-24px))] max-h-[min(80vh,640px)] overflow-auto",
  // No overflow-auto: an inner split pane owns scrolling at this size.
  xl: "w-[min(1000px,calc(100vw-24px))] h-[min(80vh,700px)] flex flex-col",
};

/**
 * Dense modal chrome for Workspace Git dialogs.
 * VS Code tokens + IDE tool-window spacing (not marketing modals).
 */
export function GitDialogShell({
  title,
  children,
  footer,
  open = true,
  testId,
  className,
  wide = false,
  size,
}: GitDialogShellProps) {
  if (!open) {
    return null;
  }

  const resolvedSize: GitDialogSize = size ?? (wide ? "wide" : "default");
  const isXl = resolvedSize === "xl";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className={cn(
          "rounded-vscode border border-border shadow-lg",
          "bg-[var(--vscode-editorWidget-background,var(--background))]",
          "text-foreground font-[family-name:var(--nx-font-ui)]",
          "p-3",
          SIZE_CLASSES[resolvedSize],
          className,
        )}
      >
        <h3 className="m-0 mb-1.5 text-[length:var(--nx-font-size-ui)] font-semibold leading-tight">
          {title}
        </h3>
        <div
          className={cn(
            "text-[length:var(--nx-font-size-ui-sm)] text-vscode-description leading-snug",
            isXl && "flex-1 min-h-0 flex flex-col",
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="mt-3 mb-0.5 flex items-center justify-end gap-1.5 pt-1 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Shared dense action button classes for dialog footers. */
export const gitDialogBtnSecondary =
  "btn-vscode-secondary h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2.5 text-[length:var(--nx-font-size-ui-sm)] cursor-pointer";

export const gitDialogBtnPrimary =
  "btn-vscode h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2.5 text-[length:var(--nx-font-size-ui-sm)] disabled:opacity-40 cursor-pointer";

export const gitDialogBtnDanger =
  "h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2.5 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] hover:opacity-90 border border-solid cursor-pointer";
