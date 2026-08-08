import { useEffect, useRef } from "react";

type SearchPanelProps = {
  query: string;
  matchCount: number;
  activeIndex: number; // 0-based; -1 when no matches
  onQueryChange: (q: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
};

export function SearchPanel({
  query,
  matchCount,
  activeIndex,
  onQueryChange,
  onPrev,
  onNext,
  onClose,
  onReplace,
  onReplaceAll,
}: SearchPanelProps) {
  const findRef = useRef<HTMLInputElement | null>(null);
  const replaceRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    findRef.current?.focus();
    findRef.current?.select();
  }, []);

  const countLabel =
    matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : "0/0";

  return (
    <div
      className="absolute right-6 top-2 z-[200] flex flex-col gap-1 p-1.5 rounded-vscode border border-border bg-[var(--vscode-editorWidget-background,var(--background))] shadow-xl font-sans"
      data-testid="search-panel"
      role="dialog"
      aria-label="Find and replace"
      aria-modal="false"
    >
      <div className="flex items-center gap-1">
        <input
          ref={findRef}
          type="text"
          aria-label="find"
          placeholder="Find (Ctrl+F)"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) {
                onPrev();
              } else {
                onNext();
              }
            }
          }}
          className="w-[150px] px-1.5 py-0.5 text-xs rounded-vscode bg-input text-input-foreground border border-input-border focus:outline-none focus:border-ring"
        />
        <button
          type="button"
          className="w-5 h-5 flex items-center justify-center rounded-vscode text-foreground/80 hover:bg-list-hover hover:text-foreground cursor-pointer border-none bg-transparent outline-none"
          aria-label="find-prev"
          title="Previous match"
          onClick={onPrev}
        >
          ↑
        </button>
        <button
          type="button"
          className="w-5 h-5 flex items-center justify-center rounded-vscode text-foreground/80 hover:bg-list-hover hover:text-foreground cursor-pointer border-none bg-transparent outline-none"
          aria-label="find-next"
          title="Next match"
          onClick={onNext}
        >
          ↓
        </button>
        <span
          className="text-[10px] text-[var(--vscode-descriptionForeground,#70727a)] px-1 min-w-[32px] text-center"
          data-testid="search-count"
        >
          {countLabel}
        </span>
        <button
          type="button"
          className="w-5 h-5 flex items-center justify-center rounded-vscode text-[var(--vscode-descriptionForeground,#70727a)] hover:text-foreground hover:bg-list-hover cursor-pointer border-none bg-transparent outline-none"
          aria-label="close-search"
          title="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-1">
        <input
          ref={replaceRef}
          type="text"
          aria-label="replace-input"
          placeholder="Replace (Ctrl+H)"
          className="w-[150px] px-1.5 py-0.5 text-xs rounded-vscode bg-input text-input-foreground border border-input-border focus:outline-none focus:border-ring"
        />
        <button
          type="button"
          className="px-2 py-0.5 text-[10px] rounded-vscode bg-secondary hover:bg-secondary-hover text-secondary-foreground border border-[var(--vscode-button-border,var(--border))] cursor-pointer font-medium outline-none"
          aria-label="replace"
          title="Replace current match"
          onClick={() => onReplace(replaceRef.current?.value ?? "")}
        >
          Replace
        </button>
        <button
          type="button"
          className="px-2 py-0.5 text-[10px] rounded-vscode bg-secondary hover:bg-secondary-hover text-secondary-foreground border border-[var(--vscode-button-border,var(--border))] cursor-pointer font-medium outline-none"
          aria-label="replace-all"
          title="Replace all matches"
          onClick={() => onReplaceAll(replaceRef.current?.value ?? "")}
        >
          All
        </button>
      </div>
    </div>
  );
}
