import { useEffect, useState, type ReactNode } from "react";
import type { MergeDocument } from "../../../../src/core/types";
import { useGitViewStore } from "../../stores/gitViewStore";
import { useGitPanels } from "../../hooks/useGitPanels";
import { useScrollSync } from "../../hooks/useScrollSync";
import { useMergeBlame } from "../../hooks/merge/useMergeBlame";
import { useMergeSearch } from "../../hooks/merge/useMergeSearch";
import { useMergeResolverController } from "../../hooks/merge/useMergeResolverController";
import type { EditorContextMenuState } from "../../hooks/merge/useMergeResolverController";
import { OverviewRuler } from "./OverviewRuler";
import { SearchPanel } from "./SearchPanel";
import { MergePaneGrid } from "./MergePaneGrid";
import { ConflictsNavSidebar } from "./ConflictsNavSidebar";
import { MergeContextMenu } from "./MergeContextMenu";
import { loadMonaco } from "./monacoSetup";

/** Progress a surface needs to label its toolbar and gate its Apply button. */
export type MergeSurfaceState = {
  totalChanges: number;
  remaining: number;
  unresolvedNonConflicting: number;
  unresolvedSimpleConflicts: number;
  onApply: () => void;
};

type MergeResolverPanesProps = {
  activeDocument: MergeDocument | null;
  loadingLabel?: string;
  header?: (state: MergeSurfaceState) => ReactNode;
  footer?: (state: MergeSurfaceState) => ReactNode;
};

/**
 * Local / Result / Incoming panes plus their search, ruler and context menu.
 * Shared so the standalone resolver panel and the Git panel's inline conflict
 * preview cannot drift apart.
 */
export function MergeResolverPanes({
  activeDocument,
  loadingLabel = "Loading merge resolver…",
  header,
  footer,
}: MergeResolverPanesProps) {
  const activeBlockId = useGitViewStore((s) => s.activeBlockId);
  const showBase = useGitViewStore((s) => s.showBase);
  const showConflictsNavigation = useGitViewStore(
    (s) => s.showConflictsNavigation,
  );
  const highlightingMode = useGitViewStore((s) => s.highlightingMode);
  const compareMode = useGitViewStore((s) => s.compareMode);
  const enableScrollSync = useGitViewStore((s) => s.enableScrollSync);

  const { requestChangesFromSide, requestGitHistory } = useGitPanels();
  const { registerContainer, handleScroll } = useScrollSync(
    showBase ? 4 : 3,
    enableScrollSync,
  );

  const {
    showBlameLeft,
    showBlameRight,
    blameOurs,
    blameTheirs,
    enableAnnotateBlame,
    toggleAnnotateBlame,
  } = useMergeBlame(activeDocument);

  const {
    rows,
    baseRows,
    collapsed,
    changeCounts,
    rowRef,
    scrollToBlock,
    selectBlock,
    jumpToBlock,
    editBlock,
    expand,
    dispatchGitAction,
    handleMarkResolved,
    parseEditorContextMenu,
  } = useMergeResolverController({
    activeDocument,
    showBlameLeft,
    showBlameRight,
    blameOursLines: blameOurs.lines ?? undefined,
    blameTheirsLines: blameTheirs.lines ?? undefined,
  });

  const {
    searchOpen,
    searchQuery,
    searchActiveIndex,
    matchIds,
    matchedSet,
    gotoMatch,
    replaceCurrent,
    replaceAll,
  } = useMergeSearch({ rows, scrollToBlock, editBlock });

  const [editorContextMenu, setEditorContextMenu] =
    useState<EditorContextMenuState | null>(null);

  useEffect(() => {
    // Prewarm only; the panes that need Monaco surface their own load errors.
    void loadMonaco().catch(() => {});
  }, []);

  useEffect(() => {
    useGitViewStore.getState().setBlockScrollIntoView(scrollToBlock);
    return () => useGitViewStore.getState().setBlockScrollIntoView(null);
  }, [scrollToBlock]);

  if (!activeDocument || !changeCounts) {
    return (
      <div
        className="flex flex-col h-full min-h-0 font-[family-name:var(--nx-font-ui)]"
        data-testid="merge-resolver-loading"
      >
        <div className="nx-tool-empty flex flex-col items-start justify-start gap-1 px-[var(--nx-pad-x)] py-2 text-left">
          <div className="text-[length:var(--nx-font-size-ui)] font-medium text-foreground">
            {loadingLabel}
          </div>
          <div className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description">
            Preparing left / result / right panes.
          </div>
        </div>
      </div>
    );
  }

  const surface: MergeSurfaceState = {
    ...changeCounts,
    onApply: handleMarkResolved,
  };

  const annotateFromContextMenu = () => {
    const side = editorContextMenu?.side;
    const pane: "left" | "right" = side === "right" ? "right" : "left";
    setEditorContextMenu(null);
    enableAnnotateBlame(pane);
  };

  return (
    <>
      {header?.(surface)}
      <div
        className="flex-1 flex overflow-hidden min-h-0 relative"
        data-compare-mode={compareMode}
        data-testid="merge-pane-grid-wrap"
        onContextMenu={(e) => {
          e.preventDefault();
          setEditorContextMenu(parseEditorContextMenu(e));
        }}
      >
        {searchOpen && (
          <SearchPanel
            query={searchQuery}
            matchCount={matchIds.length}
            activeIndex={matchIds.length > 0 ? searchActiveIndex : -1}
            onQueryChange={(q) => useGitViewStore.getState().setSearchQuery(q)}
            onPrev={() => gotoMatch(-1)}
            onNext={() => gotoMatch(1)}
            onClose={() => useGitViewStore.getState().closeSearch()}
            onReplace={replaceCurrent}
            onReplaceAll={replaceAll}
          />
        )}

        <MergePaneGrid
          activeDocument={activeDocument}
          activeBlockId={activeBlockId}
          showBase={showBase}
          highlightingMode={highlightingMode}
          rows={rows}
          baseRows={baseRows}
          matchedSet={matchedSet}
          showBlameLeft={showBlameLeft}
          showBlameRight={showBlameRight}
          blameLeftLoading={showBlameLeft && blameOurs.loading}
          blameRightLoading={showBlameRight && blameTheirs.loading}
          registerContainer={registerContainer}
          handleScroll={handleScroll}
          onSelectBlock={selectBlock}
          onEditBlock={editBlock}
          rowRef={rowRef}
          collapsedBlockIds={collapsed}
          onExpandBlock={expand}
          onShowOursDetails={() =>
            requestChangesFromSide({
              side: "ours",
              relativePath: activeDocument.relativePath,
              branchLabel: activeDocument.oursLabel,
              previewText: activeDocument.ours ?? "",
            })
          }
          onShowTheirsDetails={() =>
            requestChangesFromSide({
              side: "theirs",
              relativePath: activeDocument.relativePath,
              branchLabel: activeDocument.theirsLabel,
              previewText: activeDocument.theirs ?? "",
            })
          }
        />

        <OverviewRuler blocks={rows} onJump={jumpToBlock} />

        {showConflictsNavigation && (
          <ConflictsNavSidebar
            changes={rows.filter((r) => r.navigable)}
            activeBlockId={activeBlockId}
            onJump={jumpToBlock}
          />
        )}

        <MergeContextMenu
          menu={editorContextMenu}
          showBlameLeft={showBlameLeft}
          showBlameRight={showBlameRight}
          onClose={() => setEditorContextMenu(null)}
          onToggleAnnotateBlame={toggleAnnotateBlame}
          onAnnotateFromMenu={annotateFromContextMenu}
          onShowHistory={() => {
            setEditorContextMenu(null);
            requestGitHistory(activeDocument.relativePath, false);
          }}
          onGitAction={dispatchGitAction}
        />
      </div>
      {footer?.(surface)}
    </>
  );
}
