import { useMemo } from "react";
import { useGitViewStore, type HighlightingMode } from "../../stores/gitViewStore";
import type { BlockRows } from "./rows";
import { EditorPaneBlock } from "./EditorPaneBlock";
import type { EditorPaneSide } from "./EditorPaneHelpers";
import { cn } from "../../lib/cn";
import { editorPaneClass, editorRowClass } from "./editorPaneClasses";

type EditorPaneProps = {
  side: EditorPaneSide;
  blocks: BlockRows[];
  activeBlockId: string | null;
  highlightingMode?: HighlightingMode;
  editorRef?: (el: HTMLDivElement | null) => void;
  onScroll?: () => void;
  onSelectBlock: (blockId: string) => void;
  onAccept?: (blockId: string, append?: boolean) => void;
  onIgnore?: (blockId: string) => void;
  onEditBlock?: (blockId: string, text: string) => void;
  showDetails?: boolean;
  blameLoading?: boolean;
  matchedBlockIds?: Set<string>;
  rowRef?: (blockId: string, el: HTMLDivElement | null) => void;
  collapsedBlockIds?: Set<string>;
  onExpandBlock?: (blockId: string) => void;
};

export function EditorPane({
  side,
  blocks,
  activeBlockId,
  highlightingMode = "lines",
  editorRef,
  onScroll,
  onSelectBlock,
  onAccept,
  onIgnore,
  onEditBlock,
  showDetails,
  blameLoading,
  matchedBlockIds,
  rowRef,
  collapsedBlockIds,
  onExpandBlock,
}: EditorPaneProps) {
  const hasActionColumn = side !== "center" && (!!onAccept || !!onIgnore);
  const whitespacePolicy = useGitViewStore((s) => s.whitespacePolicy);
  const compareMode = useGitViewStore((s) => s.compareMode);
  const highlightCtx = useMemo(
    () => ({ whitespacePolicy, compareMode }),
    [whitespacePolicy, compareMode],
  );
  const rowGridClass = editorRowClass(side, showDetails);

  return (
    <div
      className={cn(
        editorPaneClass(side, showDetails),
        "h-full flex-1 min-h-0 min-w-0",
      )}
      ref={editorRef}
      onScroll={onScroll}
      data-testid={`pane-${side}`}
      data-highlighting={highlightingMode}
    >
      {blocks.map((block) => (
        <EditorPaneBlock
          key={block.blockId}
          side={side}
          block={block}
          isActive={activeBlockId === block.blockId}
          isCollapsed={!!collapsedBlockIds?.has(block.blockId)}
          isMatched={!!matchedBlockIds?.has(block.blockId)}
          highlightingMode={highlightingMode}
          highlightCtx={highlightCtx}
          rowGridClass={rowGridClass}
          hasActionColumn={hasActionColumn}
          showDetails={showDetails}
          blameLoading={blameLoading}
          onSelectBlock={onSelectBlock}
          onAccept={onAccept}
          onIgnore={onIgnore}
          onEditBlock={onEditBlock}
          onExpandBlock={onExpandBlock}
          rowRef={rowRef}
        />
      ))}
    </div>
  );
}
