import { useEffect } from "react";
import { useGitViewStore } from "./stores/gitViewStore";
import { useWebviewContextMenuGuard } from "./hooks/useWebviewContextMenuGuard";
import { useTheme } from "./hooks/useTheme";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ConflictsDialog } from "./components/conflict-list/ConflictsDialog";
import { MergeResolverScreen } from "./screens/MergeResolverScreen";
import { ToastContainer } from "./components/ui/ToastContainer";
import { ChangesFromBranchPanel } from "./components/git/ChangesFromBranchPanel";
import { DiffPreviewOverlay } from "./components/git/DiffPreviewOverlay";
import {
  MergeClientProvider,
  useMergeClientContext,
} from "./hooks/merge/mergeClientContext";
import { useMergeHostSubscription } from "./hooks/merge/useMergeHostSubscription";

function MergeAppBody() {
  const screen = useGitViewStore((s) => s.screen);
  const theme = useTheme();
  const client = useMergeClientContext();
  const store = useGitViewStore;

  useWebviewContextMenuGuard();
  useKeyboardShortcuts();
  useMergeHostSubscription(client);

  useEffect(() => {
    const { repoId } = client;
    store.getState().setOpenConflictFile((relativePath) => {
      if (!repoId) {
        return;
      }
      store.getState().setLoading(true);
      void client.openMergeFile(repoId, relativePath);
    });
    store.getState().setConfirmDiscard((action) => {
      if (!repoId) {
        return;
      }
      void client.confirmDiscard(repoId, action);
    });
    return () => {
      store.getState().setOpenConflictFile(null);
      store.getState().setConfirmDiscard(null);
    };
  }, [client, store]);

  const themeClass =
    theme === "high-contrast-light"
      ? "vscode-high-contrast-light"
      : theme === "high-contrast"
        ? "vscode-high-contrast"
        : theme === "light"
          ? "vscode-light"
          : "vscode-dark";

  return (
    <div
      className={`relative h-full w-full min-h-0 overflow-hidden bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] font-[var(--vscode-font-family)] text-[var(--vscode-font-size)] ${themeClass}`}
    >
      {screen === "conflictList" ? (
        <ConflictsDialog />
      ) : (
        <MergeResolverScreen />
      )}
      <ChangesFromBranchPanel />
      <DiffPreviewOverlay />
      <ToastContainer />
    </div>
  );
}

export function App() {
  return (
    <MergeClientProvider>
      <MergeAppBody />
    </MergeClientProvider>
  );
}