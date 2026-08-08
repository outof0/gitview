import { useEffect } from "react";
import { useGitViewStore } from "../stores/gitViewStore";
import { useMergeClientContext } from "./merge/mergeClientContext";

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    return true;
  }
  if (target.closest(".monaco-editor")) {
    return true;
  }
  return (
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
  );
}

export function useKeyboardShortcuts() {
  const client = useMergeClientContext();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const store = useGitViewStore.getState();
      const doc = store.activeDocument;
      if (!doc) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const editingText =
        isTextEditingTarget(e.target) ||
        isTextEditingTarget(document.activeElement);

      // Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z — merge-state undo / redo.
      // Let native text fields keep their own in-progress editing undo stack.
      if (!editingText && mod && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          store.redoMerge();
        } else {
          store.undoMerge();
        }
        return;
      }

      if (
        !editingText &&
        !e.shiftKey &&
        !e.altKey &&
        e.ctrlKey &&
        e.key.toLowerCase() === "y"
      ) {
        e.preventDefault();
        store.redoMerge();
        return;
      }

      // F7 — Next difference
      if (e.key === "F7" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        store.goToNextChange();
        return;
      }

      // Shift+F7 — Previous difference
      if (e.key === "F7" && e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        store.goToPreviousChange();
        return;
      }

      // Alt+ArrowDown — Next conflict
      if (e.key === "ArrowDown" && e.altKey && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        store.goToNextConflict();
        return;
      }

      // Alt+ArrowUp — Previous conflict
      if (e.key === "ArrowUp" && e.altKey && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        store.goToPreviousConflict();
        return;
      }

      // Alt+1 — Accept local (partial; keeps repository side pending)
      if (
        e.key === "1" &&
        e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        const activeId = store.activeBlockId;
        if (activeId) {
          store.applyAcceptSide(activeId, "ours");
        }
        return;
      }

      // Alt+2 — Accept repository (partial; keeps local side pending)
      if (
        e.key === "2" &&
        e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        const activeId = store.activeBlockId;
        if (activeId) {
          store.applyAcceptSide(activeId, "theirs");
        }
        return;
      }

      // Alt+3 — Accept both
      if (
        e.key === "3" &&
        e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        const activeId = store.activeBlockId;
        if (activeId) {
          store.applyAcceptBoth(activeId);
        }
        return;
      }

      // Alt+Shift+1 / Alt+Shift+2 — accept both, ordered by side.
      if (e.key === "1" && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const activeId = store.activeBlockId;
        if (activeId) {
          store.applyAppendSide(activeId, "ours");
        }
        return;
      }

      if (e.key === "2" && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const activeId = store.activeBlockId;
        if (activeId) {
          store.applyAppendSide(activeId, "theirs");
        }
        return;
      }

      // Alt+Backspace — reset active conflict/change.
      if (
        e.key === "Backspace" &&
        e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        const activeId = store.activeBlockId;
        if (activeId) {
          store.applyResetConflict(activeId);
        }
        return;
      }

      // Ctrl+Enter — Mark resolved
      if (e.key === "Enter" && mod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (!store.isFullyResolved()) {
          store.showToast("Resolve all conflicts before applying.", "warning");
          return;
        }
        if (client.repoId) {
          void client.markResolved(
            client.repoId,
            doc.relativePath,
            store.getResultText(),
          );
        }
        return;
      }

      // Ctrl+S — same as Apply when fully resolved (GitView merge flow has no separate Save).
      if (e.key.toLowerCase() === "s" && mod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!store.isFullyResolved()) {
          store.showToast("Resolve all conflicts before applying.", "warning");
          return;
        }
        if (client.repoId) {
          void client.markResolved(
            client.repoId,
            doc.relativePath,
            store.getResultText(),
          );
        }
        return;
      }

      // Ctrl+F — open find, Ctrl+H — open find+replace (mockup search panel).
      if ((e.key === "f" || e.key === "h") && mod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        store.openSearch();
        return;
      }

      // Escape — close the search panel if open, else back to list.
      if (e.key === "Escape") {
        e.preventDefault();
        if (store.searchOpen) {
          store.closeSearch();
        } else {
          store.requestBackToList();
        }
        return;
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [client]);
}
