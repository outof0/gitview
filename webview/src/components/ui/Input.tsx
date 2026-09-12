import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ type = "text", className, ...props }, ref) {
  const selectionControl = type === "checkbox" || type === "radio";

  return (
    <input
      {...props}
      ref={ref}
      type={type}
      className={cn(
        selectionControl
          ? "shrink-0 accent-ring"
          : "min-w-0 rounded-vscode border border-input-border bg-input px-2 font-ui text-ui text-input-foreground placeholder:text-control-placeholder",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    />
  );
});
