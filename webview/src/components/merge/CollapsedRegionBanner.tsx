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
    <button
      type="button"
      className="nx-collapsed-banner nx-row w-full flex items-center gap-1.5 px-2 min-h-5 text-[11px] text-vscode-description bg-[var(--vscode-editor-inactiveSelectionBackground,rgba(128,128,128,0.15))] border-y border-vscode-panel-border cursor-pointer hover:bg-toolbar-hover"
      aria-label="expand-collapsed"
      onClick={(e) => {
        e.stopPropagation();
        onExpand();
      }}
    >
      <span aria-hidden>…</span>
      <span>{label}</span>
    </button>
  );
}