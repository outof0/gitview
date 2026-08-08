import { useEffect, useRef, useState, type ReactNode } from "react";

export function ToolbarSeparator() {
  return <span className="w-px h-5 bg-[var(--vscode-panel-border)] mx-1.5" />;
}

type ToolbarIconButtonProps = {
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  "data-testid"?: string;
  className?: string;
  children: ReactNode;
};

export function ToolbarIconButton({
  onClick,
  title,
  disabled,
  className = "",
  children,
  ...rest
}: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      aria-pressed={rest["aria-pressed"]}
      data-testid={rest["data-testid"]}
      className={`h-[22px] min-w-[22px] px-1 inline-flex items-center justify-center gap-1 rounded-[var(--nx-menu-radius)] text-[length:var(--nx-font-size-ui)] text-[var(--vscode-icon-foreground)] enabled:hover:bg-toolbar-hover disabled:opacity-40 disabled:cursor-default ${className}`}
    >
      {children}
    </button>
  );
}

export type ToolbarDropdownItem = {
  value: string;
  label: string;
  active: boolean;
  onSelect: () => void;
};

type ToolbarDropdownProps = {
  label: ReactNode;
  title: string;
  items: ToolbarDropdownItem[];
  align?: "left" | "right";
  testId?: string;
};

// Click-to-open menu matching the mockup's simple dropdowns. Closes on outside
// click or Escape.
export function ToolbarDropdown({
  label,
  title,
  items,
  align = "left",
  testId,
}: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        className="h-[22px] px-1.5 inline-flex items-center gap-1 rounded-[var(--nx-menu-radius)] text-[length:var(--nx-font-size-ui)] text-foreground hover:bg-toolbar-hover"
      >
        {label}{" "}
        <span className="text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-descriptionForeground)]">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          data-testid={testId ? `${testId}-menu` : undefined}
          className={`nx-context-menu absolute top-full mt-0.5 z-50 min-w-[200px] py-1 border border-menu-border bg-menu-bg shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
          style={{ borderRadius: "var(--nx-menu-radius)" }}
        >
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitemradio"
              aria-checked={item.active}
              data-testid={testId ? `${testId}-${item.value}` : undefined}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className="nx-menu-item w-full flex items-center justify-between gap-2 min-h-[var(--nx-menu-item-h)] px-[var(--nx-menu-pad-x)] py-[var(--nx-menu-pad-y)] text-[length:var(--nx-font-size-ui)] text-left text-menu-fg hover:bg-menu-selection hover:text-menu-selectionForeground border-0 bg-transparent cursor-pointer"
            >
              <span className="truncate">{item.label}</span>
              {item.active && (
                <span
                  className="shrink-0 text-[length:var(--nx-font-size-ui-sm)]"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4.5l5 5H3l5-5z" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 11.5l-5-5h10l-5 5z" />
    </svg>
  );
}
