import { useGitViewStore } from "../../stores/gitViewStore";
import type {
  WhitespacePolicy,
  HighlightingMode,
  CompareMode,
} from "../../stores/gitViewStore";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ToolbarDropdown,
  ToolbarIconButton,
  ToolbarSeparator,
} from "../ui/ToolbarControls";

type ToolbarProps = {
  remainingConflicts: number;
  totalChanges: number;
  unresolvedNonConflicting: number;
  unresolvedSimpleConflicts: number;
  onPrev: () => void;
  onNext: () => void;
};

const WHITESPACE_LABELS: Record<WhitespacePolicy, string> = {
  doNotIgnore: "Do not ignore",
  ignoreWhitespaces: "Ignore whitespaces",
  trimWhitespaces: "Trim whitespaces",
};

const HIGHLIGHT_LABELS: Record<HighlightingMode, string> = {
  words: "Highlight words",
  lines: "Highlight lines",
  none: "Do not highlight",
};

const COMPARE_LABELS: Record<CompareMode, string> = {
  default: "Default (local vs base)",
  localBase: "Compare Local with Base",
  repoBase: "Compare Repository with Base",
  localRepo: "Compare Local with Repository",
  localMiddle: "Compare Local with Middle",
  repoMiddle: "Compare Repository with Middle",
};

export function Toolbar({
  remainingConflicts,
  totalChanges,
  unresolvedNonConflicting,
  unresolvedSimpleConflicts,
  onPrev,
  onNext,
}: ToolbarProps) {
  const applyAllNonConflicting = useGitViewStore((s) => s.applyAllNonConflicting);
  const applyAllNonConflictingLeft = useGitViewStore(
    (s) => s.applyAllNonConflictingLeft,
  );
  const applyAllNonConflictingRight = useGitViewStore(
    (s) => s.applyAllNonConflictingRight,
  );
  const resolveSimpleConflicts = useGitViewStore((s) => s.resolveSimpleConflicts);
  const whitespacePolicy = useGitViewStore((s) => s.whitespacePolicy);
  const setWhitespacePolicy = useGitViewStore((s) => s.setWhitespacePolicy);
  const highlightingMode = useGitViewStore((s) => s.highlightingMode);
  const setHighlightingMode = useGitViewStore((s) => s.setHighlightingMode);
  const showBase = useGitViewStore((s) => s.showBase);
  const compareMode = useGitViewStore((s) => s.compareMode);
  const toggleShowBase = useGitViewStore((s) => s.toggleShowBase);
  const setCompareMode = useGitViewStore((s) => s.setCompareMode);

  const hasNavigation = totalChanges > 1;
  const hasNonConflicting = unresolvedNonConflicting > 0;
  const hasSimpleConflicts = unresolvedSimpleConflicts > 0;
  const hasLeft = hasNavigation || hasNonConflicting || hasSimpleConflicts;

  return (
    <div
      className="nx-tool-titlebar flex items-center gap-0.5 px-[var(--nx-pad-x)] h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background))] font-[family-name:var(--nx-font-ui)]"
      data-testid="merge-toolbar"
    >
      {/* Navigation — only when multiple changes */}
      {hasNavigation && (
        <>
          <ToolbarIconButton
            onClick={onPrev}
            title="Previous difference (Shift+F7)"
            aria-label="Previous difference"
          >
            <ChevronUpIcon />
          </ToolbarIconButton>
          <ToolbarIconButton
            onClick={onNext}
            title="Next difference (F7)"
            aria-label="Next difference"
          >
            <ChevronDownIcon />
          </ToolbarIconButton>
        </>
      )}

      {/* Apply non-conflicting — only when there are unresolved non-conflicting blocks */}
      {hasNonConflicting && (
        <>
          {hasNavigation && <ToolbarSeparator />}
          <span className="text-xs text-[var(--vscode-descriptionForeground)] px-1">
            Apply non-conflicting:
          </span>
          <ToolbarIconButton
            onClick={applyAllNonConflictingLeft}
            title="Apply Non-Conflicting Changes from the Left"
            aria-label="Apply non-conflicting from left"
          >
            <ApplyLeftIcon />
          </ToolbarIconButton>
          <ToolbarIconButton
            onClick={applyAllNonConflicting}
            title="Apply All Non-Conflicting Changes"
            aria-label="Apply all non-conflicting"
          >
            <ApplyAllIcon />
          </ToolbarIconButton>
          <ToolbarIconButton
            onClick={applyAllNonConflictingRight}
            title="Apply Non-Conflicting Changes from the Right"
            aria-label="Apply non-conflicting from right"
          >
            <ApplyRightIcon />
          </ToolbarIconButton>
        </>
      )}

      {/* Magic resolve — only when there are unresolved both_same blocks */}
      {hasSimpleConflicts && (
        <>
          {(hasNavigation || hasNonConflicting) && <ToolbarSeparator />}
          <ToolbarIconButton
            onClick={resolveSimpleConflicts}
            title="Resolve simple conflicts"
            aria-label="Resolve simple conflicts"
            className="text-sm text-[var(--vscode-charts-yellow,#d9a441)]"
          >
            ✦
          </ToolbarIconButton>
        </>
      )}

      {/* Separator before the options dropdowns if any left section was shown */}
      {hasLeft && <ToolbarSeparator />}

      {/* Whitespace dropdown */}
      <ToolbarDropdown
        label={
          <>
            Whitespace:{" "}
            <span className="font-medium">
              {WHITESPACE_LABELS[whitespacePolicy]}
            </span>
          </>
        }
        title="Whitespace policy"
        items={(Object.keys(WHITESPACE_LABELS) as WhitespacePolicy[]).map(
          (value) => ({
            value,
            label: WHITESPACE_LABELS[value],
            active: value === whitespacePolicy,
            onSelect: () => setWhitespacePolicy(value),
          }),
        )}
      />

      {/* Highlighting dropdown */}
      <ToolbarDropdown
        label={
          <>
            Highlighting:{" "}
            <span className="font-medium">
              {HIGHLIGHT_LABELS[highlightingMode]}
            </span>
          </>
        }
        title="Highlighting policy"
        items={(Object.keys(HIGHLIGHT_LABELS) as HighlightingMode[]).map(
          (value) => ({
            value,
            label: HIGHLIGHT_LABELS[value],
            active: value === highlightingMode,
            onSelect: () => setHighlightingMode(value),
          }),
        )}
      />

      {/* View dropdown */}
      <ToolbarDropdown
        label="View"
        title="View options"
        items={[
          {
            value: "show-base",
            label: "Show Base Revision",
            active: showBase,
            onSelect: toggleShowBase,
          },
          ...(Object.keys(COMPARE_LABELS) as CompareMode[]).map((mode) => ({
            value: `compare-${mode}`,
            label: COMPARE_LABELS[mode],
            active: compareMode === mode,
            onSelect: () => setCompareMode(mode),
          })),
        ]}
      />

      <div className="flex-1" />

      {/* Counter — conflict count in red (mockup .counter .cf) */}
      <span
        className="text-[11.5px] text-[var(--vscode-descriptionForeground)] px-2"
        data-testid="conflict-counter"
        role="status"
        aria-live="polite"
        aria-label={`${totalChanges} change${totalChanges !== 1 ? "s" : ""}, ${remainingConflicts} conflict${remainingConflicts !== 1 ? "s" : ""}`}
      >
        {totalChanges} change{totalChanges !== 1 ? "s" : ""}.{" "}
        <span className="font-medium text-[var(--vscode-errorForeground,#cf5c56)]">
          {remainingConflicts} conflict{remainingConflicts !== 1 ? "s" : ""}.
        </span>
      </span>
    </div>
  );
}
function ApplyLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 3h2v10H3zm5 1.5l5 3.5-5 3.5v-7z" />
    </svg>
  );
}

function ApplyAllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 8l4-3.5v7zm12 0l-4-3.5v7zm-5-5h2v10H9z" />
    </svg>
  );
}

function ApplyRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13 3h-2v10h2zm-5 8.5L3 8l5-3.5v7z" />
    </svg>
  );
}
