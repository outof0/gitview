import { useGitViewStore } from "../stores/gitViewStore";
import { Toolbar } from "../components/layout/Toolbar";
import { BottomBar } from "../components/layout/BottomBar";
import { CrlfBanner } from "../components/ui/CrlfBanner";
import { ToolbarIconButton } from "../components/ui/ToolbarControls";
import { MergeResolverPanes } from "../components/merge/MergeResolverPanes";

export function MergeResolverScreen() {
  const activeDocument = useGitViewStore((s) => s.activeDocument);
  const requestBackToList = useGitViewStore((s) => s.requestBackToList);

  return (
    <div className="flex flex-col h-full">
      {activeDocument && (
        <div className="h-toolbar min-h-toolbar bg-tabs-bg border-b border-vscode-panel-border flex items-center px-pad-x text-ui text-vscode-description gap-2 font-ui">
          <span className="font-semibold text-foreground truncate">
            Resolve Conflicts — {activeDocument.relativePath}
          </span>
          {activeDocument.dirty && (
            <span
              className="text-vscode-link"
              title="unsaved"
            >
              ●
            </span>
          )}
          <div className="flex-1" />
          <ToolbarIconButton
            onClick={requestBackToList}
            title="Close dialog"
            data-testid="merge-title-close"
            aria-label="Close dialog"
          >
            ✕
          </ToolbarIconButton>
        </div>
      )}

      <MergeResolverPanes
        activeDocument={activeDocument}
        header={(surface) => (
          <>
            <Toolbar
              remainingConflicts={surface.remaining}
              totalChanges={surface.totalChanges}
              unresolvedNonConflicting={surface.unresolvedNonConflicting}
              unresolvedSimpleConflicts={surface.unresolvedSimpleConflicts}
              onPrev={() => useGitViewStore.getState().goToPreviousChange()}
              onNext={() => useGitViewStore.getState().goToNextChange()}
            />
            <CrlfBanner />
          </>
        )}
        footer={(surface) => (
          <BottomBar
            onCancel={requestBackToList}
            onApply={surface.onApply}
            applyDisabled={surface.remaining > 0}
          />
        )}
      />
    </div>
  );
}
