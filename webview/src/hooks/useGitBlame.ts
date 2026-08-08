import { useCallback } from "react";
import type { BlameSide } from "@gitview/types";
import { useBlameStore } from "../stores/blameStore";
import { useMergeClientContext } from "./merge/mergeClientContext";

export function useGitBlame() {
  const client = useMergeClientContext();
  const setLoading = useBlameStore((s) => s.setLoading);

  const requestBlame = useCallback(
    (relativePath: string, side: BlameSide) => {
      if (!client.repoId) {
        return;
      }
      setLoading(side, relativePath);
      // Host resolves ours→HEAD / theirs→MERGE_HEAD (see resolveBlameRef).
      const ref = side === "theirs" ? "MERGE_HEAD" : "HEAD";
      void client.queryBlame(client.repoId, relativePath, ref);
    },
    [client, setLoading],
  );

  return { requestBlame };
}