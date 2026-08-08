import {
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
  CornerDownRight,
  X,
} from "lucide-react";

// Side panes show these on the OUTER edge: left actions hug the far-left,
// right actions hug the far-right. Icons point toward the result pane.
export function AcceptIcon({ side }: { side: "left" | "right" }) {
  const Icon = side === "left" ? ChevronsRight : ChevronsLeft;
  return <Icon size={17} strokeWidth={2.1} aria-hidden="true" />;
}

export function AppendIcon({ side }: { side: "left" | "right" }) {
  const Icon = side === "left" ? CornerDownRight : CornerDownLeft;
  return <Icon size={16} strokeWidth={2.1} aria-hidden="true" />;
}

export function IgnoreIcon() {
  return <X size={16} strokeWidth={2.1} aria-hidden="true" />;
}