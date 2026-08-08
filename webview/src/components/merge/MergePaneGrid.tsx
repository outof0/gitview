import type { MergeDocument } from "../../../../src/core/types";
import { useGitViewStore, type HighlightingMode } from "../../stores/gitViewStore";
import type { BlockRows } from "./rows";
import { ResizableColumns } from "../ui/ResizableColumns";
import { MergePaneFrame } from "./MergePaneFrame";
import { PaneHeader } from "../layout/PaneHeader";
import { EditorPane } from "./EditorPane";
import { MonacoCenterPane } from "./MonacoCenterPane";
import { detectLanguage } from "./syntax";

// Module scope: these only reach the store, so they carry no render state and
// must stay referentially stable for the memoized rows in EditorPane.
function acceptFrom(side: "ours" | "theirs") {
  return (id: string, append?: boolean) => {
    const store = useGitViewStore.getState();
    if (append) {
      store.applyAppendSide(id, side);
    } else {
      store.applyAcceptSide(id, side);
    }
  };
}

const acceptOurs = acceptFrom("ours");
const acceptTheirs = acceptFrom("theirs");
const ignoreOurs = (id: string) =>
  useGitViewStore.getState().applyIgnore(id, "ours");
const ignoreTheirs = (id: string) =>
  useGitViewStore.getState().applyIgnore(id, "theirs");

function PaneHeaderBase() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 h-[26px] text-[11.5px] border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background))] text-[var(--vscode-descriptionForeground)]">
      <span>Base Revision</span>
      <span className="flex-1" />
    </div>
  );
}

type MergePaneGridProps = {
  activeDocument: MergeDocument;
  activeBlockId: string | null;
  showBase: boolean;
  highlightingMode: HighlightingMode;
  rows: BlockRows[];
  baseRows: BlockRows[];
  matchedSet: Set<string>;
  showBlameLeft: boolean;
  showBlameRight: boolean;
  blameLeftLoading: boolean;
  blameRightLoading: boolean;
  registerContainer: (index: number) => (el: HTMLDivElement | null) => void;
  handleScroll: (index: number) => () => void;
  onSelectBlock: (id: string) => void;
  onEditBlock: (blockId: string, text: string) => void;
  rowRef: (blockId: string, el: HTMLDivElement | null) => void;
  collapsedBlockIds: Set<string>;
  onExpandBlock: (blockId: string) => void;
  onShowOursDetails: () => void;
  onShowTheirsDetails: () => void;
};

export function MergePaneGrid({
  activeDocument,
  activeBlockId,
  showBase,
  highlightingMode,
  rows,
  baseRows,
  matchedSet,
  showBlameLeft,
  showBlameRight,
  blameLeftLoading,
  blameRightLoading,
  registerContainer,
  handleScroll,
  onSelectBlock,
  onEditBlock,
  rowRef,
  collapsedBlockIds,
  onExpandBlock,
  onShowOursDetails,
  onShowTheirsDetails,
}: MergePaneGridProps) {
  return (
    <ResizableColumns
      className="flex-1 min-h-0"
      storageKey={showBase ? "gitview-merge-panes-4" : "gitview-merge-panes-3"}
      defaultPercents={showBase ? [20, 20, 40, 20] : [28, 44, 28]}
      panes={[
        <MergePaneFrame
          key="left"
          data-testid="pane-left-wrap"
          header={
            <PaneHeader
              variant="left"
              branch={activeDocument.oursLabel}
              onToggleShowDetails={onShowOursDetails}
            />
          }
        >
          <EditorPane
            side="left"
            blocks={rows}
            activeBlockId={activeBlockId}
            highlightingMode={highlightingMode}
            editorRef={registerContainer(0)}
            onScroll={handleScroll(0)}
            onSelectBlock={onSelectBlock}
            onAccept={acceptOurs}
            onIgnore={ignoreOurs}
            showDetails={showBlameLeft}
            blameLoading={blameLeftLoading}
            matchedBlockIds={matchedSet}
            collapsedBlockIds={collapsedBlockIds}
            onExpandBlock={onExpandBlock}
          />
        </MergePaneFrame>,
        ...(showBase
          ? [
              <MergePaneFrame
                key="base"
                data-testid="pane-base-wrap"
                header={<PaneHeaderBase />}
              >
                <EditorPane
                  side="left"
                  blocks={baseRows}
                  activeBlockId={activeBlockId}
                  highlightingMode={highlightingMode}
                  editorRef={registerContainer(3)}
                  onScroll={handleScroll(3)}
                  onSelectBlock={onSelectBlock}
                />
              </MergePaneFrame>,
            ]
          : []),
        <MergePaneFrame
          key="center"
          data-testid="pane-center-wrap"
          header={<PaneHeader variant="center" />}
        >
          <MonacoCenterPane
            blocks={rows}
            activeBlockId={activeBlockId}
            highlightingMode={highlightingMode}
            language={detectLanguage(activeDocument.relativePath)}
            editorRef={registerContainer(1)}
            onScroll={handleScroll(1)}
            onSelectBlock={onSelectBlock}
            onEditBlock={onEditBlock}
            onRevertBlock={(id) =>
              useGitViewStore.getState().applyRevertCenterBlock(id)
            }
            matchedBlockIds={matchedSet}
            rowRef={rowRef}
            collapsedBlockIds={collapsedBlockIds}
            onExpandBlock={onExpandBlock}
          />
        </MergePaneFrame>,
        <MergePaneFrame
          key="right"
          data-testid="pane-right-wrap"
          header={
            <PaneHeader
              variant="right"
              branch={activeDocument.theirsLabel}
              onToggleShowDetails={onShowTheirsDetails}
            />
          }
        >
          <EditorPane
            side="right"
            blocks={rows}
            activeBlockId={activeBlockId}
            highlightingMode={highlightingMode}
            editorRef={registerContainer(2)}
            onScroll={handleScroll(2)}
            onSelectBlock={onSelectBlock}
            onAccept={acceptTheirs}
            onIgnore={ignoreTheirs}
            showDetails={showBlameRight}
            blameLoading={blameRightLoading}
            matchedBlockIds={matchedSet}
            collapsedBlockIds={collapsedBlockIds}
            onExpandBlock={onExpandBlock}
          />
        </MergePaneFrame>,
      ]}
    />
  );
}
