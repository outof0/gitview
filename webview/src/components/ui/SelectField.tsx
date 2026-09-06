import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> & {
  size?: "compact" | "default";
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ size = "compact", className, ...props }, ref) {
    return (
      <select
        {...props}
        ref={ref}
        className={cn(
          "min-w-0 rounded-vscode border border-[var(--select-border)] bg-[var(--select-background)] px-1.5",
          "font-ui text-ui-sm text-[var(--select-foreground)]",
          "disabled:cursor-not-allowed disabled:opacity-40",
          size === "compact" ? "h-row" : "h-control",
          className,
        )}
      />
    );
  },
);
