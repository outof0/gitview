import type { HTMLAttributes, ReactNode } from "react";

/** Column shell: fixed header + scrollable editor body. */
export function MergePaneFrame({
  header,
  children,
  className = "",
  ...rest
}: {
  header: ReactNode;
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 h-full overflow-hidden ${className}`}
      {...rest}
    >
      <div className="shrink-0">{header}</div>
      <div className="flex-1 min-h-0 min-w-0 h-full overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
