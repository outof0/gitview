import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={cn(
        "min-w-0 rounded-vscode border border-input-border bg-input px-2 py-1.5",
        "font-ui text-ui text-input-foreground",
        "placeholder:text-control-placeholder disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    />
  );
});
