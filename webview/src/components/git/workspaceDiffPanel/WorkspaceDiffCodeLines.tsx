import type { DiffLineHighlight } from "../buildDiffDisplayRows";
import { HighlightedCodeLine } from "../HighlightedCodeLine";
import { highlightClass } from "./workspaceDiffPanelUtils";

export function CodeLine({
  lineNum,
  text,
  highlight,
  selectable = false,
  selected = false,
  testId,
  filePath,
  onSelect,
}: {
  lineNum: number | null;
  text: string;
  highlight: DiffLineHighlight;
  selectable?: boolean;
  selected?: boolean;
  testId?: string;
  filePath?: string | null;
  onSelect?: (shiftKey: boolean) => void;
}) {
  const changed = highlight !== "none";
  return (
    <div
      className={`nx-diff-hover-line relative flex min-h-[18px] ${highlightClass(highlight)} ${
        selectable && changed ? "cursor-pointer" : ""
      } ${selected ? "ring-1 ring-inset ring-[var(--vscode-focusBorder)]" : ""}`}
      data-testid={testId}
      onClick={
        selectable && changed && onSelect
          ? (event) => onSelect(event.shiftKey)
          : undefined
      }
      data-selected={selected ? "true" : undefined}
    >
      <span className="w-9 shrink-0 text-right pr-2 text-[var(--vscode-editorLineNumber-foreground,#6e7681)] select-none">
        {lineNum ?? ""}
      </span>
      <span className="flex-1 px-1 whitespace-pre overflow-x-auto">
        <HighlightedCodeLine text={text} filePath={filePath} />
      </span>
    </div>
  );
}

export function UnifiedCodeLine({
  prefix,
  lineNum,
  text,
  highlight,
  selectable = false,
  selected = false,
  testId,
  filePath,
  onSelect,
}: {
  prefix: " " | "-" | "+";
  lineNum: number | null;
  text: string;
  highlight: DiffLineHighlight;
  selectable?: boolean;
  selected?: boolean;
  testId?: string;
  filePath?: string | null;
  onSelect?: (shiftKey: boolean) => void;
}) {
  const changed = highlight !== "none";
  return (
    <div
      className={`nx-diff-hover-line relative flex min-h-[18px] ${highlightClass(highlight)} ${
        selectable && changed ? "cursor-pointer" : ""
      } ${selected ? "ring-1 ring-inset ring-[var(--vscode-focusBorder)]" : ""}`}
      data-testid={testId}
      onClick={
        selectable && changed && onSelect
          ? (event) => onSelect(event.shiftKey)
          : undefined
      }
      data-selected={selected ? "true" : undefined}
    >
      <span className="w-4 shrink-0 text-center text-[var(--vscode-descriptionForeground)] select-none">
        {prefix}
      </span>
      <span className="w-9 shrink-0 text-right pr-2 text-[var(--vscode-editorLineNumber-foreground,#6e7681)] select-none">
        {lineNum ?? ""}
      </span>
      <span className="flex-1 px-1 whitespace-pre overflow-x-auto">
        <HighlightedCodeLine text={text} filePath={filePath} />
      </span>
    </div>
  );
}
