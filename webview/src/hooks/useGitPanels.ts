import { useCallback } from "react";
import { useGitPanelStore } from "../stores/gitPanelStore";
import { useMergeClientContext } from "./merge/mergeClientContext";
import type { BlameSide } from "@gitview/types";

export function useGitPanels() {
  const openChangesFromSide = useGitPanelStore((s) => s.openChangesFromSide);
  const client = useMergeClientContext();

  const requestGitHistory = useCallback(
    (path: string, isFolder: boolean) => {
      if (!client.repoId) {
        return;
      }
      void client.openHistoryPanel(client.repoId, path, isFolder);
    },
    [client],
  );

  const requestChangesFromSide = useCallback(
    (opts: {
      side: BlameSide;
      relativePath: string;
      branchLabel: string;
      previewText: string;
    }) => {
      openChangesFromSide(opts);
    },
    [openChangesFromSide],
  );

  return { requestGitHistory, requestChangesFromSide };
}