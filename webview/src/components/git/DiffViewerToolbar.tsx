import {
  ChevronDownIcon,
  ChevronUpIcon,
  ToolbarDropdown,
  ToolbarIconButton,
  ToolbarSeparator,
} from "../ui/ToolbarControls";
import type { DiffViewerOptions } from "./MonacoDiffViewer";

type DiffViewerToolbarProps = {
  options: DiffViewerOptions;
  onOptionsChange: (next: DiffViewerOptions) => void;
  onPrevDifference: () => void;
  onNextDifference: () => void;
  /** null while Monaco has not reported a diff yet. */
  diffCount: number | null;
};

function differenceLabel(count: number | null): string {
  if (count === null) {
    return "Comparing…";
  }
  if (count === 0) {
    return "Contents are identical";
  }
  return `${count} difference${count === 1 ? "" : "s"}`;
}

export function DiffViewerToolbar({
  options,
  onOptionsChange,
  onPrevDifference,
  onNextDifference,
  diffCount,
}: DiffViewerToolbarProps) {
  const canNavigate = (diffCount ?? 0) > 0;
  const set = (patch: Partial<DiffViewerOptions>) =>
    onOptionsChange({ ...options, ...patch });

  return (
    <div
      className="nx-tool-titlebar ui-responsive-toolbar flex min-w-0 items-center gap-0.5 px-pad-x h-toolbar min-h-toolbar border-b border-vscode-panel-border bg-tabs-bg font-ui"
      data-testid="git-diff-toolbar"
    >
      <ToolbarIconButton
        onClick={onPrevDifference}
        disabled={!canNavigate}
        title="Previous difference (Shift+F7)"
        aria-label="Previous difference"
        data-testid="git-diff-prev-difference"
      >
        <ChevronUpIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        onClick={onNextDifference}
        disabled={!canNavigate}
        title="Next difference (F7)"
        aria-label="Next difference"
        data-testid="git-diff-next-difference"
      >
        <ChevronDownIcon />
      </ToolbarIconButton>

      <ToolbarSeparator />

      <div className="ui-toolbar-secondary contents">
        <ToolbarDropdown
          testId="git-diff-whitespace"
          title="Whitespace policy"
          label={
            <>
              Whitespace:{" "}
              <span className="font-medium">
                {options.trimWhitespace ? "Trim whitespaces" : "Do not ignore"}
              </span>
            </>
          }
          items={[
            {
              value: "doNotIgnore",
              label: "Do not ignore",
              active: !options.trimWhitespace,
              onSelect: () => set({ trimWhitespace: false }),
            },
            {
              value: "trimWhitespaces",
              label: "Trim whitespaces",
              active: options.trimWhitespace,
              onSelect: () => set({ trimWhitespace: true }),
            },
          ]}
        />

        <ToolbarDropdown
          testId="git-diff-viewer-mode"
          title="Viewer mode"
          label={
            <span className="font-medium">
              {options.sideBySide ? "Side-by-side viewer" : "Unified viewer"}
            </span>
          }
          items={[
            {
              value: "sideBySide",
              label: "Side-by-side viewer",
              active: options.sideBySide,
              onSelect: () => set({ sideBySide: true }),
            },
            {
              value: "unified",
              label: "Unified viewer",
              active: !options.sideBySide,
              onSelect: () => set({ sideBySide: false }),
            },
          ]}
        />
      </div>

      <ToolbarDropdown
        testId="git-diff-view-options"
        title="Viewer settings"
        label="View"
        items={[
          {
            value: "sideBySide",
            label: "Side-by-side viewer",
            active: options.sideBySide,
            onSelect: () => set({ sideBySide: true }),
          },
          {
            value: "unified",
            label: "Unified viewer",
            active: !options.sideBySide,
            onSelect: () => set({ sideBySide: false }),
          },
          {
            value: "trimWhitespaces",
            label: "Trim whitespaces",
            active: options.trimWhitespace,
            onSelect: () => set({ trimWhitespace: !options.trimWhitespace }),
          },
          {
            value: "collapseUnchanged",
            label: "Collapse unchanged fragments",
            active: options.collapseUnchanged,
            onSelect: () =>
              set({ collapseUnchanged: !options.collapseUnchanged }),
          },
          {
            value: "softWrap",
            label: "Use soft wraps",
            active: options.softWrap,
            onSelect: () => set({ softWrap: !options.softWrap }),
          },
        ]}
      />

      <div className="flex-1" />

      <span
        className="ui-toolbar-tertiary text-ui-sm text-vscode-description px-2 whitespace-nowrap"
        data-testid="git-diff-difference-counter"
        role="status"
        aria-live="polite"
      >
        {differenceLabel(diffCount)}
      </span>
    </div>
  );
}
