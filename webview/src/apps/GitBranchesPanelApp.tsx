import { useEffect, useRef, useState } from "react";
import { BranchesPopup } from "../components/git/BranchesPopup";
import type { BranchListSnapshot } from "@gitview/shared/types/branch";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { createProtocolClient } from "../protocol/client";

type Bootstrap = { repoId: string; initialRef?: string };

function readBootstrap(): Bootstrap {
  const value = window.__GITVIEW_BOOTSTRAP__ as Bootstrap | null | undefined;
  if (!value || typeof value.repoId !== "string") {
    return { repoId: "" };
  }
  return { repoId: value.repoId, initialRef: value.initialRef };
}

/**
 * Editor-area Branches surface.
 *
 * Renders the branch popup on its own — no workspace, no other tabs, no
 * commit panel behind it. Data comes from the protocol client directly, not
 * the workspace store, so this panel is self-contained.
 *
 * Actions that need a name input (rename, delete with typing) are not wired
 * here: a dialog-only surface should not invent its own input UI when the
 * design system answer for "ask the user for a string" is a native
 * QuickPick/InputBox. Those actions are reached through the existing
 * workspace surface; adding them back here needs an explicit decision.
 */
export function GitBranchesPanelApp() {
  const api = useVsCodeApi();
  const { repoId } = readBootstrap();
  const client = useRef(
    createProtocolClient(api.postMessage),
  ).current;

  const [snapshot, setSnapshot] = useState<BranchListSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useRef(async () => {
    if (!repoId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await client.listBranches(repoId);
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  });

  const hasOpened = useRef(false);
  useEffect(() => {
    if (snapshot || loading || error) {
      hasOpened.current = true;
      return;
    }
    if (hasOpened.current) {
      api.postMessage({ type: "git.branches.close" });
    }
  }, [snapshot, loading, error, api]);

  useEffect(() => {
    void reload.current();
  }, [repoId]);

  return (
    <BranchesPopup
      open
      snapshot={snapshot}
      loading={loading}
      busy={busy}
      onClose={() => api.postMessage({ type: "git.branches.close" })}
      onRefresh={() => void reload.current()}
      onCreate={(name) => {
        setBusy(true);
        client
          .createBranch(repoId, name, undefined)
          .then(() => reload.current())
          .catch((err: unknown) =>
            setError(err instanceof Error ? err.message : String(err)),
          )
          .finally(() => setBusy(false));
      }}
      onCheckout={(ref, opts) => {
        setBusy(true);
        client
          .checkoutBranch(repoId, ref, {
            smart: opts?.smart,
            force: opts?.force,
          })
          .then(() => {
            // The host may close this panel on success; if not, refresh.
            reload.current();
          })
          .catch((err: unknown) =>
            setError(err instanceof Error ? err.message : String(err)),
          )
          .finally(() => setBusy(false));
      }}
      onRequestForceCheckout={(ref, opts) => {
        setBusy(true);
        client
          .checkoutBranch(repoId, ref, {
            smart: opts?.smart,
            force: true,
          })
          .then(() => reload.current())
          .catch((err: unknown) =>
            setError(err instanceof Error ? err.message : String(err)),
          )
          .finally(() => setBusy(false));
      }}
    />
  );
}
