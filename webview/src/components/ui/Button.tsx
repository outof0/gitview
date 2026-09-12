import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "toolbar";
type ButtonSize = "compact" | "default" | "icon" | "content";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/**
 * Standard sizes own the shared button geometry; variants own interaction
 * intent and surface colours. Composed content-sized controls can keep their
 * feature-specific geometry while still declaring that intent explicitly.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-primary-foreground font-semibold enabled:hover:bg-primary-hover",
  secondary:
    "border-border bg-secondary text-secondary-foreground enabled:hover:bg-secondary-hover",
  danger:
    "border-danger-border bg-danger-bg text-danger-fg enabled:hover:opacity-90",
  ghost:
    "border-transparent bg-transparent text-foreground enabled:hover:bg-list-hover",
  toolbar:
    "border-transparent bg-transparent text-vscode-description enabled:hover:bg-toolbar-hover enabled:hover:text-fg",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  compact:
    "h-row min-h-row px-2 text-ui-sm",
  default: "h-control min-h-control px-3 text-ui",
  icon: "h-row min-h-row w-row min-w-row p-0",
  // Composed rows and icon controls can own their geometry while the
  // semantic variant still records the interaction intent.
  content: "",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      type = "button",
      variant = "secondary",
      size = "compact",
      className,
      ...props
    },
    ref,
  ) {
    const contentSize = size === "content";
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={cn(
          contentSize
            ? "font-ui disabled:cursor-not-allowed disabled:opacity-40"
            : "inline-flex shrink-0 items-center justify-center gap-1 rounded-vscode border font-ui leading-none",
          // `base.css` resets `button { border: none }` with an element selector,
          // which outranks Tailwind's `*{border-style:solid}` reset. Without an
          // explicit `border-solid` the `border` width collapses to a computed
          // 0 and no utility can ever give a Button a visible border.
          !contentSize && "border-solid",
          !contentSize && "disabled:cursor-not-allowed disabled:opacity-40",
          !contentSize && VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        data-button-variant={variant}
      />
    );
  },
);
