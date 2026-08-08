import { useGitViewStore } from "../stores/gitViewStore";
import { Toolbar } from "../components/layout/Toolbar";
import { BottomBar } from "../components/layout/BottomBar";
import { CrlfBanner } from "../components/ui/CrlfBanner";
import { MergeResolverPanes } from "../components/merge/MergeResolverPanes";

export function MergeResolverScreen() {
  const activeDocument = useGitViewStore((s) => s.activeDocument);
  const requestBackToList = useGitViewStore((s) => s.requestBackToList);

  return (
    <div className="flex flex-col h-full">
      {activeDocument && (
        <div className="h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] bg-[var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background))] border-b border-[var(--vscode-panel-border)] flex items-center px-[var(--nx-pad-x)] text-[length:var(--nx-font-size-ui)] text-vscode-description gap-2 font-[family-name:var(--nx-font-ui)]">
          <span className="font-semibold text-foreground truncate">
            Resolve Conflicts — {activeDocument.relativePath}
          </span>
          {activeDocument.dirty && (
            <span
              className="text-[var(--vscode-textLink-foreground,#3574f0)]"
              title="unsaved"
            >
              ●
            </span>
          )}
          <div className="flex-1" />
          <span
            onClick={requestBackToList}
            className="cursor-pointer px-1.5 py-0.5 rounded-vscode hover:bg-toolbar-hover"
            title="Close dialog"
            data-testid="merge-title-close"
            role="button"
            aria-label="Close dialog"
          >
            ✕
          </span>
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
