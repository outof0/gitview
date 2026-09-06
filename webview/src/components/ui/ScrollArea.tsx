import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * The one axis this region scrolls. `"none"` is for a region that
   * deliberately has no scrollbar of its own — an inner pane owns it. Naming
   * it here keeps "who scrolls" answerable from the markup instead of from the
   * absence of a class.
   */
  axis?: "vertical" | "horizontal" | "both" | "none";
};

const AXIS_CLASSES = {
  vertical: "overflow-y-auto overflow-x-hidden",
  horizontal: "overflow-x-auto overflow-y-hidden",
  both: "overflow-auto",
  none: "",
} as const;

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea({ axis = "vertical", className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        data-scroll-owner={axis}
        className={cn("min-h-0 min-w-0", AXIS_CLASSES[axis], className)}
      />
    );
  },
);
