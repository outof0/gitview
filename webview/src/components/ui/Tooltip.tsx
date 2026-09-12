import {
  cloneElement,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  label: string;
  children: ReactNode;
};

/** Small, theme-aware tooltip for controls whose visible label is hidden. */
export function Tooltip({ label, children }: TooltipProps) {
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<
    (CSSProperties & { visibility: "hidden" | "visible" }) | null
  >(null);

  useLayoutEffect(() => {
    if (!visible) {
      setTooltipStyle(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const tooltip = tooltipRef.current;
      if (!anchor || !tooltip) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const edge = 8;
      const gap = 4;
      const preferredCenter = anchorRect.left + anchorRect.width / 2;
      const minCenter = edge + tooltipRect.width / 2;
      const maxCenter = window.innerWidth - edge - tooltipRect.width / 2;
      const center = Math.min(
        Math.max(preferredCenter, minCenter),
        Math.max(minCenter, maxCenter),
      );
      const below = anchorRect.bottom + gap;
      const fitsBelow = below + tooltipRect.height <= window.innerHeight - edge;
      const top = fitsBelow
        ? below
        : Math.max(edge, anchorRect.top - tooltipRect.height - gap);

      setTooltipStyle({
        left: center,
        top,
        transform: "translateX(-50%)",
        visibility: "visible",
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [label, visible]);

  const describedChildren = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ "aria-describedby"?: string }>,
        {
          "aria-describedby": [
            children.props["aria-describedby"],
            tooltipId,
          ]
            .filter(Boolean)
            .join(" "),
        },
      )
    : children;

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={() => setVisible(false)}
    >
      {describedChildren}
      {visible && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[1100] max-w-[calc(100vw-1rem)] whitespace-nowrap rounded-vscode border border-menu-border bg-menu-bg px-1.5 py-1 text-ui-sm text-menu-fg shadow-lg"
              style={
                tooltipStyle ?? {
                  left: 0,
                  top: 0,
                  visibility: "hidden",
                }
              }
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
