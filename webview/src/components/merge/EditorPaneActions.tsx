import { Button } from "../ui/Button";
import type { BlockRows } from "./rows";
import { AcceptIcon, AppendIcon, IgnoreIcon } from "./EditorPaneIcons";
import { actBtnClass } from "./editorPaneClasses";

type EditorPaneActionsProps = {
  side: "left" | "right";
  block: BlockRows;
  onAccept?: (blockId: string, append?: boolean) => void;
  onIgnore?: (blockId: string) => void;
};

export function EditorPaneActions({
  side,
  block,
  onAccept,
  onIgnore,
}: EditorPaneActionsProps) {
  const appendMode =
    side === "left"
      ? block.kind === "conflict" && block.conflictSideStatus?.theirs === "accepted"
      : block.kind === "conflict" && block.conflictSideStatus?.ours === "accepted";

  return (
    <>
      {onAccept && (
        <Button variant="ghost" size="content"
          className={actBtnClass}
          title={
            appendMode
              ? `Append ${side === "left" ? "Left" : "Right"} Side`
              : `Accept ${side === "left" ? "Left" : "Right"} Side`
          }
          aria-label={side === "left" ? "accept-left" : "accept-right"}
          onClick={(e) => {
            e.stopPropagation();
            onAccept(block.blockId, appendMode);
          }}
        >
          {appendMode ? <AppendIcon side={side} /> : <AcceptIcon side={side} />}
        </Button>
      )}
      {onIgnore && (
        <Button variant="ghost" size="content"
          className={actBtnClass}
          title={`Ignore ${side === "left" ? "Left" : "Right"} Side`}
          aria-label="ignore"
          onClick={(e) => {
            e.stopPropagation();
            onIgnore(block.blockId);
          }}
        >
          <IgnoreIcon />
        </Button>
      )}
    </>
  );
}