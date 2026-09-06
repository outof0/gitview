import { Button } from "../ui/Button";
type CollapsedRegionBannerProps = {
  hiddenLineCount: number;
  onExpand: () => void;
};

export function CollapsedRegionBanner({
  hiddenLineCount,
  onExpand,
}: CollapsedRegionBannerProps) {
  const label =
    hiddenLineCount === 1
      ? "… 1 line collapsed … (Expand)"
      : `… ${hiddenLineCount} lines collapsed … (Expand)`;

  return (
    <Button variant="ghost" size="content"
      type="button"
      className="nx-collapsed-banner nx-row w-full flex items-center gap-1.5 px-2 min-h-5 text-ui-sm text-vscode-description bg-editor-inactive-sel border-y border-vscode-panel-border cursor-pointer hover:bg-toolbar-hover"
      aria-label="expand-collapsed"
      onClick={(e) => {
        e.stopPropagation();
        onExpand();
      }}
    >
      <span aria-hidden>…</span>
      <span>{label}</span>
    </Button>
  );
}