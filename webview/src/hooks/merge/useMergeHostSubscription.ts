import { useEffect } from "react";
import { useGitViewStore } from "../../stores/gitViewStore";
import { useGitPanelStore } from "../../stores/gitPanelStore";
import { useBlameStore } from "../../stores/blameStore";
import { useDiffPreviewStore } from "../../stores/diffPreviewStore";
import type { createProtocolClient } from "../../protocol/client";
import {
  isBlameAnnotateRequest,
  isBlameSnapshot,
  isConflictSnapshot,
  isDiffPreview,
  isMergeDocument,
  isMergeInit,
  isMergeSettings,
  isMergeShowConflictList,
} from "./mergeHostMessageGuards";

type MergeClient = ReturnType<typeof createProtocolClient> & {
  repoId: string;
};

export function useMergeHostSubscription(client: MergeClient) {
  const store = useGitViewStore;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (isMergeInit(event.data)) {
        store.getState().applySettings(event.data.payload.settings);
        return;
      }
      if (isMergeSettings(event.data)) {
        store.getState().applySettings(event.data.payload);
        return;
      }
      if (isMergeShowConflictList(event.data)) {
        // Resolve conflict / re-open: always land on Conflicts dialog.
        store.getState().backToList();
        store.getState().setLoading(false);
        return;
      }
      if (isConflictSnapshot(event.data)) {
        const { repoRoot, files, branchInfo } = event.data.payload;
        store.getState().setRepoRoot(repoRoot);
        store.getState().setBranchInfo(branchInfo);
        store.getState().setConflictFiles(files);
        store.getState().setLoading(false);
        return;
      }
      if (isMergeDocument(event.data)) {
        store.getState().setActiveDocument(event.data.payload);
        store.getState().setScreen("mergeResolver");
        store.getState().setLoading(false);
        return;
      }
      if (isBlameAnnotateRequest(event.data)) {
        const side = event.data.payload.side ?? "ours";
        const ns = store.getState();
        if (
          ns.screen === "mergeResolver" &&
          ns.activeDocument?.relativePath === event.data.payload.relativePath
        ) {
          ns.setAnnotateOnOpen(side);
        } else {
          ns.setAnnotateOnOpen(side);
          ns.enterMergeResolver();
        }
        return;
      }
      if (isBlameSnapshot(event.data)) {
        const payload = event.data.payload;
        const bs = useBlameStore.getState();
        const side: "ours" | "theirs" = bs.ours.loading
          ? "ours"
          : bs.theirs.loading
            ? "theirs"
            : "ours";
        bs.setResult({
          relativePath: payload.filePath,
          side,
          lines: payload.lines.map((line) => ({
            lineNumber: line.lineNumber,
            sha: line.sha,
            shortSha: line.shortSha,
            author: line.author,
            authorEmail: line.authorEmail,
            authorTime: line.authorTime,
            summary: line.summary,
          })),
          truncated: payload.truncated,
        });
        return;
      }
      if (isDiffPreview(event.data)) {
        useDiffPreviewStore.getState().openDiffPreview(event.data.payload);
        return;
      }

      client.handleHostMessage(event.data);

      const msg = event.data as {
        type?: string;
        ok?: boolean;
        payload?: {
          path?: string;
          hint?: string;
          action?: unknown;
          side?: string;
          relativePath?: string;
          error?: { message: string };
          mergeBase?: string;
          revisionRange?: string;
          branchRef?: string;
          commits?: unknown[];
          allChangedPaths?: string[];
        };
        error?: { message: string; code?: string };
      };

      if (msg.type === "merge.saved" && msg.ok) {
        const path = msg.payload?.path;
        if (path) {
          store.getState().markDocumentSaved(path);
          store.getState().showToast(msg.payload?.hint ?? "Saved.", "info");
          store.getState().backToList();
        }
        return;
      }
      if (msg.type === "merge.resolved" && msg.ok) {
        const path = msg.payload?.path;
        if (path) {
          store.getState().removeConflictFile(path);
          store.getState().backToList();
        }
        return;
      }
      if (
        msg.type === "merge.confirmDiscard" &&
        msg.ok &&
        msg.payload &&
        typeof msg.payload.action === "string"
      ) {
        store.getState().applyDiscardConfirmed(
          msg.payload as Parameters<
            ReturnType<typeof useGitViewStore.getState>["applyDiscardConfirmed"]
          >[0],
        );
        return;
      }
      if (msg.type === "log.changesFromSide" && msg.ok) {
        const gp = useGitPanelStore.getState();
        const payload = msg.payload;
        if (payload?.error) {
          gp.setChangesFromSideResult({
            side: (payload.side as "ours" | "theirs") ?? "ours",
            relativePath: payload.relativePath,
            error: { message: payload.error.message },
          });
        } else if (payload) {
          gp.setChangesFromSideResult({
            side: (payload.side as "ours" | "theirs") ?? "ours",
            relativePath: payload.relativePath,
            mergeBase: payload.mergeBase,
            revisionRange: payload.revisionRange,
            branchRef: payload.branchRef,
            commits: payload.commits as import("@gitview/types").GitCommitEntry[],
            allChangedPaths: payload.allChangedPaths,
          });
        }
        return;
      }
      if (msg.ok === false && msg.error?.message) {
        store.getState().setError(msg.error.message);
        store.getState().setLoading(false);
        store.getState().showToast(msg.error.message, "error");
        const gp = useGitPanelStore.getState();
        if (gp.history.open && gp.history.loading) {
          gp.setGitHistoryResult({
            path: gp.history.path,
            error: { message: msg.error.message },
          });
        }
        if (gp.changesFromSide.open && gp.changesFromSide.loading) {
          gp.setChangesFromSideResult({
            side: gp.changesFromSide.side,
            relativePath: gp.changesFromSide.relativePath,
            error: { message: msg.error.message },
          });
        }
      }
    };

    window.addEventListener("message", onMessage);
    void client.ready("merge");
    return () => window.removeEventListener("message", onMessage);
  }, [client, store]);
}