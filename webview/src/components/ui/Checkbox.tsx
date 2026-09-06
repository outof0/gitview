import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
  className?: string;
  /** Top-align the box for multi-line labels (default centers it). */
  alignTop?: boolean;
  /** Secondary line under the label, same chrome as dialog option hints. */
  hint?: ReactNode;
  children?: ReactNode;
  "aria-label"?: string;
};

/**
 * Shared checkbox row. Uses a visible themed input so hover/focus match
 * `input[type=checkbox]:not(.sr-only)` in base.css (Changes list, file
 * pickers) instead of a painted Lucide box with no native hover.
 */
export function Checkbox({
  checked,
  onChange,
  disabled = false,
  testId,
  className,
  alignTop = false,
  hint,
  children,
  "aria-label": ariaLabel,
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex gap-2 text-ui-sm text-foreground",
        alignTop || hint ? "items-start" : "items-center",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer rounded-vscode hover:bg-list-hover",
        className,
      )}
    >
      <input
        type="checkbox"
        className={cn("shrink-0", (alignTop || Boolean(hint)) && "mt-0.5")}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
      />
      {children || hint ? (
        <span className="min-w-0 leading-snug">
          {children}
          {hint ? (
            <span className="block text-vscode-description opacity-90">
              {hint}
            </span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
