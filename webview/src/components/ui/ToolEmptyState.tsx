import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type ToolEmptyStateProps = {
  title: string;
  hint?: string;
  /** Optional compact actions (buttons) under the hint. */
  actions?: ReactNode;
  className?: string;
  testId?: string;
};

/**
 * IDE tool-window empty state — left-aligned, one-line density.
 * Avoid centered marketing / hero empty layouts.
 */
export function ToolEmptyState({
  title,
  hint,
  actions,
  className,
  testId,
}: ToolEmptyStateProps) {
  return (
    <div
      className={cn(
        "nx-tool-empty flex flex-col items-start justify-start gap-1",
        "px-[var(--nx-pad-x)] py-2 text-left",
        "font-[family-name:var(--nx-font-ui)]",
        className,
      )}
      data-testid={testId ?? "tool-empty-state"}
    >
      <div className="text-[length:var(--nx-font-size-ui)] font-medium text-foreground">
        {title}
      </div>
      {hint ? (
        <div className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description max-w-[42rem] leading-snug">
          {hint}
        </div>
      ) : null}
      {actions ? <div className="mt-1 flex flex-wrap gap-1">{actions}</div> : null}
    </div>
  );
}
