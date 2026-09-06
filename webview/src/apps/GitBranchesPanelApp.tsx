import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BranchesPopup } from "../components/git/BranchesPopup";
import { ForceCheckoutDialog } from "../components/git/ForceCheckoutDialog";
import type { BranchListSnapshot } from "@gitview/shared/types/branch";
import {
  isConfirmationEvidence,
  type ConfirmationSubmission,
  type ForceCheckoutConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { isErrorCode } from "../lib/errorCode";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { createProtocolClient } from "../protocol/client";

type Bootstrap = { repoId: string; initialRef?: string };

/**
 * Pull the host-issued force-checkout evidence out of a checkout rejection.
 * The host builds the evidence from live repository state, so a surface that
 * cannot fingerprint the repo itself can still complete the typed
 * confirmation flow instead of dead-ending on CONFIRMATION_REQUIRED.
 */
function extractForceCheckoutConfirmation(
  err: unknown,
): ForceCheckoutConfirmationEvidence | undefined {
  if (
    !isErrorCode(err, "CONFIRMATION_REQUIRED") &&
    !isErrorCode(err, "CONFIRMATION_STALE")
  ) {
    return undefined;
  }
  const details = (err as { details?: { confirmation?: unknown } }).details;
  const confirmation = isConfirmationEvidence(details?.confirmation)
    ? details.confirmation
    : undefined;
  return confirmation?.action === "force_checkout" ? confirmation : undefined;
}

/**
 * Wall-clock budget for the initial branches load. The protocol client has its
 * own 60 s per-request timeout, but that only fires if the host *responds* with
 * a non-matching shape or never posts a message at all. A misrouted postMessage,
 * a destroyed webview, or a host crash can leave the response unhandled and
 * the request sitting in the pending map. This timer is the user-visible
 * backstop that clears `loading` and surfaces a real error.
 */
export const BRANCHES_LOAD_TIMEOUT_MS = 12_000;

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
  const client = useMemo(
    () => createProtocolClient(api.postMessage),
    [api.postMessage],
  );

  const [snapshot, setSnapshot] = useState<BranchListSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pending typed force-checkout confirmation: set when the host answers a
  // force checkout with CONFIRMATION_REQUIRED plus evidence.
  const [forceConfirm, setForceConfirm] = useState<{
    ref: string;
    smart?: boolean;
    confirmation: ForceCheckoutConfirmationEvidence;
  } | null>(null);

  const describeError = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

  const reload = useCallback(async () => {
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
  }, [client, repoId]);

  const runCheckout = useCallback(
    (
      ref: string,
      opts: { smart?: boolean; force?: boolean },
      confirmation?: ConfirmationSubmission,
    ) => {
      setBusy(true);
      client
        .checkoutBranch(repoId, ref, { ...opts, confirmation })
        .then(() => {
          setForceConfirm(null);
          // The host may close this panel on success; if not, refresh.
          void reload();
        })
        .catch((err: unknown) => {
          const nextConfirmation = extractForceCheckoutConfirmation(err);
          if (nextConfirmation) {
            setForceConfirm({ ref, smart: opts.smart, confirmation: nextConfirmation });
            if (isErrorCode(err, "CONFIRMATION_STALE")) {
              setError(describeError(err));
            }
            return;
          }
          setError(describeError(err));
        })
        .finally(() => setBusy(false));
    },
    [client, repoId, reload],
  );

  // Safety net: if the protocol response never lands (host crash, webview
  // disposed in flight, response shape mismatch that the guard ignores),
  // the `finally` above will not run. This timer keeps the UI honest.
  useEffect(() => {
    if (!loading) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(false);
      setError(
        "Branches list did not load. Reload the window, then open Branches again.",
      );
    }, BRANCHES_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

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

  // Wire up the inbound side of the protocol. The host responds to `branch.list`
  // with a matching request/response envelope; the protocol client resolves the
  // pending promise when `handleHostMessage` processes it. Without this listener
  // the host's `postMessage` lands on `window` but no one ever calls
  // `handleHostMessage`, the promise never settles, and the popup stays at
  // "Loading branches…" until the safety timer above fires.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      client.handleHostMessage(event.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload, repoId]);

  return (
    <>
      <BranchesPopup
        open
        embedded
        snapshot={snapshot}
        loading={loading}
        busy={busy}
        error={error}
        onClose={() => api.postMessage({ type: "git.branches.close" })}
        onRefresh={() => void reload()}
        onCreate={(name) => {
          setBusy(true);
          client
            .createBranch(repoId, name, undefined)
            .then(() => reload())
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : String(err)),
            )
            .finally(() => setBusy(false));
        }}
        onCheckout={(ref, opts) => {
          runCheckout(ref, { smart: opts?.smart, force: opts?.force });
        }}
        onRequestForceCheckout={(ref, opts) => {
          runCheckout(ref, { smart: opts?.smart, force: true });
        }}
      />
      {forceConfirm ? (
        <ForceCheckoutDialog
          open
          confirmation={forceConfirm.confirmation}
          repositoryNames={[forceConfirm.confirmation.repoId]}
          busy={busy}
          onCancel={() => setForceConfirm(null)}
          onConfirm={(submission) =>
            runCheckout(
              forceConfirm.ref,
              { smart: forceConfirm.smart, force: true },
              submission,
            )
          }
        />
      ) : null}
    </>
  );
}
