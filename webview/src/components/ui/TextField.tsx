import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  size?: "compact" | "default";
  containerClassName?: string;
  inputClassName?: string;
};

/** VS Code-themed text field, including composite search/action fields. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    {
      leading,
      trailing,
      size = "default",
      // The root element is the shell, so `className` styles the shell. It has to
      // be destructured: `<input>` below sets `className` explicitly, so a
      // `className` left in `...inputProps` would be overwritten and lost.
      className,
      containerClassName,
      inputClassName,
      disabled,
      type = "text",
      ...inputProps
    },
    ref,
  ) {
    return (
      <div
        className={cn(
          "ui-field-shell inline-flex min-w-0 items-center gap-1.5 rounded-vscode border border-input-border bg-input px-2",
          "text-input-foreground disabled:opacity-40",
          size === "compact" ? "h-row" : "h-control",
          disabled && "opacity-40",
          className,
          containerClassName,
        )}
      >
        {leading ? (
          <span
            className="inline-flex shrink-0 items-center justify-center text-vscode-description"
            aria-hidden="true"
          >
            {leading}
          </span>
        ) : null}
        <input
          {...inputProps}
          ref={ref}
          type={type}
          disabled={disabled}
          className={cn(
            "ui-field-control h-full min-w-0 flex-1 border-0 bg-transparent p-0",
            "font-ui text-ui leading-none text-input-foreground",
            "placeholder:text-control-placeholder",
            inputClassName,
          )}
        />
        {trailing ? (
          <span className="inline-flex shrink-0 items-center gap-0.5">
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);
