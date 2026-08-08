import { useMemo, useRef } from "react";
import { useVsCodeApi } from "../useVsCodeApi";
import { createProtocolClient } from "../../protocol/client";

function readBootstrapRepoId(): string | null {
  const bootstrap = (
    window as unknown as { __GITVIEW_BOOTSTRAP__?: { repoId?: string } }
  ).__GITVIEW_BOOTSTRAP__;
  return typeof bootstrap?.repoId === "string" ? bootstrap.repoId : null;
}

export function useMergeClient() {
  const { postMessage } = useVsCodeApi();
  const clientRef = useRef(createProtocolClient(postMessage));
  const repoId = useMemo(() => readBootstrapRepoId() ?? "", []);

  return useMemo(
    () => ({
      ...clientRef.current,
      repoId,
      clientRef,
    }),
    [repoId],
  );
}