import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type MenuItemProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  testId?: string;
  /** Leading icon (Lucide, 14px). Pass null explicitly to keep icon column empty. */
  icon?: ReactNode | null;
  /** Hide the leading icon column entirely (compact text-only menus). */
  hideIcon?: boolean;
  /** Trailing affordance (checkmark, shortcut). */
  trailing?: ReactNode;
};

/**
 * Dense IDE-style context menu row (compact density, GitView chrome).
 */
export function MenuItem({
  label,
  onClick,
  disabled,
  disabledReason,
  testId,
  icon,
  hideIcon = false,
  trailing,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        "nx-menu-item w-full flex items-center gap-2 text-left border-0 bg-transparent outline-none",
        "font-ui text-ui leading-none",
        "min-h-menu-item px-menu-pad-x py-menu-pad-y",
        "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
        disabled
          ? "text-menu-fg opacity-40 cursor-not-allowed"
          : "text-menu-fg hover:bg-menu-selection hover:text-menu-selectionForeground cursor-pointer",
      )}
      onClick={() => {
        if (disabled) {
          return;
        }
        onClick();
      }}
    >
      {!hideIcon ? (
        <span
          className="inline-flex items-center justify-center shrink-0 w-icon-sm h-icon-sm text-current opacity-80"
          aria-hidden="true"
        >
          {icon ?? null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing ? (
        <span className="shrink-0 text-ui-sm opacity-80">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

export function MenuSectionHeader({
  label,
  testId,
}: {
  label: string;
  testId?: string;
}) {
  return (
    <div
      role="presentation"
      data-testid={testId ?? "git-menu-section"}
      data-section={label}
      className={cn(
        "px-menu-pad-x pt-1.5 pb-0.5 select-none",
        "text-section font-semibold uppercase tracking-wider",
        "text-menu-fg/55",
      )}
    >
      {label}
    </div>
  );
}

export function MenuDivider() {
  return (
    <div
      role="separator"
      data-testid="git-menu-divider"
      className="h-px bg-menu-border my-section-gap mx-1"
    />
  );
}
