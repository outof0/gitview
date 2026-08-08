import { memo } from "react";
import type { HighlightingMode } from "../../stores/gitViewStore";
import type { BlockRows } from "./rows";
import {
  type RowHighlightContext,
  rowTypeClass,
  shouldWordHighlight,
  stripeTypeClass,
  wordDiffReferenceText,
} from "./rowHighlight";
import { CollapsedRegionBanner } from "./CollapsedRegionBanner";
import { EditorPaneActions } from "./EditorPaneActions";
import { canResolveFromSide, type EditorPaneSide } from "./EditorPaneHelpers";
import { HighlightedText } from "./EditorPaneHighlightedText";
import type { CharRange } from "./wordDiff";
import { wordDiffRanges } from "./wordDiff";
import { cn } from "../../lib/cn";
import {
  editorActClass,
  editorBlameClass,
  editorLnClass,
  editorStripeClass,
  editorTxtClass,
} from "./editorPaneClasses";

type EditorPaneBlockProps = {
  side: EditorPaneSide;
  block: BlockRows;
  isActive: boolean;
  isCollapsed: boolean;
  isMatched: boolean;
  highlightingMode: HighlightingMode;
  highlightCtx: RowHighlightContext;
  rowGridClass: string;
  hasActionColumn: boolean;
  showDetails?: boolean;
  blameLoading?: boolean;
  onSelectBlock: (blockId: string) => void;
  onAccept?: (blockId: string, append?: boolean) => void;
  onIgnore?: (blockId: string) => void;
  onEditBlock?: (blockId: string, text: string) => void;
  onExpandBlock?: (blockId: string) => void;
  rowRef?: (blockId: string, el: HTMLDivElement | null) => void;
};

function EditorPaneBlockImpl({
  side,
  block,
  isActive,
  isCollapsed,
  isMatched,
  highlightingMode,
  highlightCtx,
  rowGridClass,
  hasActionColumn,
  showDetails,
  blameLoading,
  onSelectBlock,
  onAccept,
  onIgnore,
  onEditBlock,
  onExpandBlock,
  rowRef,
}: EditorPaneBlockProps) {
  if (isCollapsed) {
    return (
      <div
        className={cn("nx-block", isActive && "nx-active")}
        data-block={block.blockId}
        data-type={block.changeType}
        ref={(el) => rowRef?.(block.blockId, el)}
      >
        <CollapsedRegionBanner
          hiddenLineCount={block.center.length}
          onExpand={() => onExpandBlock?.(block.blockId)}
        />
      </div>
    );
  }

  const blameCell = (filler: boolean) => {
    if (!showDetails || side === "center") {
      return null;
    }
    const text = blameLoading
      ? "Loading blame…"
      : side === "left"
        ? block.blameLeft
        : block.blameRight;
    return (
      <span className={editorBlameClass} key="blame">
        {filler ? "" : text}
      </span>
    );
  };

  const cells = block[side];
  const canActOnSide = canResolveFromSide(side, block);
  const showActions =
    side !== "center" &&
    block.navigable &&
    !block.resolved &&
    canActOnSide &&
    (!!onAccept || !!onIgnore);

  return (
    <div
      className={cn("nx-block", isActive && "nx-active")}
      data-block={block.blockId}
      data-type={block.changeType}
      ref={(el) => rowRef?.(block.blockId, el)}
      onMouseDown={() => block.navigable && onSelectBlock(block.blockId)}
    >
      {cells.map((cell, idx) => {
        const filler = cell.text === null;
        const typeClass = rowTypeClass(
          side,
          block,
          cell,
          highlightingMode,
          idx,
          highlightCtx,
        );
        const stripeClass = stripeTypeClass(
          side,
          block,
          cell,
          highlightingMode,
          idx,
          highlightCtx,
        );
        const rowClass = cn(rowGridClass, typeClass, isMatched && "nx-match");

        const lineText = cell.text ?? "";
        const wordRanges: CharRange[] | undefined = shouldWordHighlight(
          side,
          block,
          cell,
          highlightingMode,
          idx,
          highlightCtx,
        )
          ? wordDiffRanges(
              lineText,
              wordDiffReferenceText(side, block, idx, highlightCtx),
            )
          : undefined;

        const actionBtns =
          showActions && idx === 0 ? (
            <EditorPaneActions
              side={side}
              block={block}
              onAccept={onAccept}
              onIgnore={onIgnore}
            />
          ) : null;

        const lnEl = (
          <span className={editorLnClass} key="ln">
            {cell.lineNo ?? ""}
          </span>
        );
        const actEl = hasActionColumn ? (
          <span className={editorActClass} key="act">
            {actionBtns}
          </span>
        ) : null;
        const editable = side === "center" && !filler && block.navigable;
        const txtEl =
          side === "center" ? (
            <span
              className={editorTxtClass}
              key="txt"
              contentEditable={editable}
              suppressContentEditableWarning
              data-block={block.blockId}
              data-editable={editable ? "true" : undefined}
              onBlur={(e) => {
                if (!editable) {
                  return;
                }
                const blockEl = e.currentTarget.closest("[data-block]");
                if (!blockEl) {
                  return;
                }
                const next = [
                  ...blockEl.querySelectorAll('[data-editable="true"]'),
                ]
                  .map((n) => n.textContent ?? "")
                  .join("\n");
                if (next === block.centerText) {
                  return;
                }
                onEditBlock?.(block.blockId, next);
              }}
            >
              {cell.text ?? ""}
            </span>
          ) : (
            <span className={editorTxtClass} key="txt">
              <HighlightedText text={lineText} wordRanges={wordRanges} />
            </span>
          );

        const blameEl = blameCell(filler);

        return (
          <div className={rowClass} key={idx}>
            {stripeClass && (
              <span className={cn(editorStripeClass, stripeClass)} />
            )}
            {side === "right" ? (
              <>
                {blameEl}
                {lnEl}
                {actEl}
                {txtEl}
              </>
            ) : side === "left" ? (
              <>
                {txtEl}
                {actEl}
                {lnEl}
                {blameEl}
              </>
            ) : (
              <>
                {blameEl}
                {lnEl}
                {txtEl}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Memoized so selecting a block re-renders two rows instead of the whole file:
 * every prop is a primitive or a stable identity, never the active-id/match Sets.
 */
export const EditorPaneBlock = memo(EditorPaneBlockImpl);
