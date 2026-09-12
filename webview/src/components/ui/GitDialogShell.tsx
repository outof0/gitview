import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ScrollArea } from "./ScrollArea";

type GitDialogSize = "default" | "medium" | "wide" | "list" | "xl";

type GitDialogShellProps = {
  title: string;
  titleIcon?: ReactNode;
  titleCentered?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  open?: boolean;
  testId?: string;
  className?: string;
  /** Wider body for lists / multi-root confirmations. Alias for size="wide". */
  wide?: boolean;
  /**
   * "xl" fills the viewport for list + diff layouts.
   * "list" is the dense picker used by Branches / Tags-style surfaces.
   */
  size?: GitDialogSize;
  /**
   * "embedded" is for editor-area webviews that *are* the dialog: no dim
   * overlay, so the VS Code tab chrome is not doubled.
   */
  variant?: "modal" | "embedded";
  onCancel?: () => void;
};

/**
 * Sizes carry geometry only. Scrolling belongs to `ScrollArea`, which is the
 * single place in the app allowed to name an overflow utility — see
 * `docs/maintainers/ui-system.md`.
 */
const SIZE_CLASSES: Record<GitDialogSize, string> = {
  default:
    "w-[min(400px,calc(100vw-var(--nx-dialog-inset)))] max-h-[min(calc(100%-var(--nx-dialog-inset)),640px)]",
  medium:
    "w-[min(420px,calc(100vw-var(--nx-dialog-inset)))] max-h-[min(calc(100%-var(--nx-dialog-inset)),640px)]",
  wide:
    "w-[min(520px,calc(100vw-var(--nx-dialog-inset)))] max-h-[min(calc(100%-var(--nx-dialog-inset)),640px)]",
  list: "w-[min(420px,calc(100vw-var(--nx-dialog-inset)))] h-[min(calc(100%-var(--nx-dialog-inset)),520px)] flex flex-col overflow-hidden",
  // An inner split pane owns scrolling at this size.
  xl: "w-[min(1000px,calc(100vw-var(--nx-dialog-inset)))] h-[min(calc(100%-var(--nx-dialog-inset)),700px)] flex flex-col",
};

/**
 * Dense modal chrome for Workspace Git dialogs.
 * VS Code tokens + IDE tool-window spacing (not marketing modals).
 */
export function GitDialogShell({
  title,
  titleIcon,
  titleCentered = false,
  children,
  footer,
  headerActions,
  open = true,
  testId,
  className,
  wide = false,
  size,
  variant = "modal",
  onCancel,
}: GitDialogShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const initial =
        dialog?.querySelector<HTMLElement>(
          '[data-dialog-initial-focus="true"]',
        ) ??
        dialog?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
      (initial ?? dialog)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const resolvedSize: GitDialogSize = size ?? (wide ? "wide" : "default");
  const fillsHeight = resolvedSize === "xl" || resolvedSize === "list";
  // "list" and "xl" hand scrolling to an inner pane; the compact sizes scroll
  // the whole dialog, header included.
  const scrollAxis = fillsHeight ? "none" : "vertical";
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ];
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const frame =
    variant === "embedded"
      ? "relative z-0 flex h-full w-full items-center justify-center bg-vscode-editor-bg p-3"
      : "fixed inset-0 z-[60] flex items-center justify-center bg-overlay-modal p-3";

  return (
    <div
      className={frame}
      role="presentation"
      onClick={
        variant === "modal" && onCancel
          ? (event) => {
              if (event.target === event.currentTarget) {
                onCancel();
              }
            }
          : undefined
      }
    >
      <ScrollArea
        ref={dialogRef}
        axis={scrollAxis}
        role="dialog"
        aria-modal={variant === "modal" ? true : undefined}
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        data-testid={testId}
        className={cn(
          "rounded-vscode border border-border shadow-lg",
          "bg-vscode-widget-bg",
          "text-foreground font-ui",
          "p-3",
          SIZE_CLASSES[resolvedSize],
          className,
        )}
      >
        <div
          className={cn(
            "relative mb-1.5 flex items-center gap-2 shrink-0",
            titleCentered && "min-h-control",
          )}
        >
          {titleIcon ? (
            <span
              className="inline-flex h-icon-md w-icon-md shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              {titleIcon}
            </span>
          ) : null}
          <h3
            className={cn(
              "m-0 text-ui font-semibold leading-tight",
              titleCentered
                ? "pointer-events-none absolute inset-0 flex items-center justify-center text-center"
                : "flex-1",
            )}
          >
            {title}
          </h3>
          {headerActions}
        </div>
        <div
          className={cn(
            resolvedSize === "list"
              ? "flex-1 min-h-0 flex flex-col overflow-hidden text-ui text-foreground leading-snug"
              : "text-ui-sm text-vscode-description leading-snug",
            fillsHeight &&
              resolvedSize !== "list" &&
              "flex-1 min-h-0 flex flex-col",
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="mt-3 mb-0.5 flex items-center justify-end gap-1.5 pt-1 shrink-0">
            {footer}
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}

/*
 * Dialog footer buttons are `<Button size="compact">` (see ./Button.tsx) — they
 * used to be these class-string constants, which silently lost to the
 * unlayered `.btn-vscode*` rules in base.css.
 */

export const gitDialogInput =
  "w-full h-row px-1.5 text-ui rounded-vscode border border-border bg-input text-foreground disabled:opacity-40";

export const gitDialogError =
  "m-0 text-danger-fg";

/** Stacked field label + control used by Git dialogs. */
export function GitDialogField({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
