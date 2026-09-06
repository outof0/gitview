import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { createProtocolClient } from "../protocol/client";
import { CreateBranchDialog } from "../components/git/CreateBranchDialog";
import {
  GitDialogShell,
} from "../components/ui/GitDialogShell";
import { Button } from "../components/ui/Button";
import type { GitCreateBranchBootstrap } from "../types/gitviewBootstrap";

const HANDSHAKE_TIMEOUT_MS = 8_000;
const HANDSHAKE_FAILED_MESSAGE =
  "Could not start the Create Branch dialog: the editor did not respond. Close and reopen it.";

function isCreateBranchBootstrap(
  value: Window["__GITVIEW_BOOTSTRAP__"],
): value is GitCreateBranchBootstrap {
  return (
    value != null &&
    "repoId" in value &&
    typeof (value as { repoId: unknown }).repoId === "string"
  );
}

/**
 * Editor-area modal that reuses the workspace CreateBranchDialog. It is opened
 * by the native Git submenu and by the panel's own New Branch action, instead of
 * the bottom GitView panel, so the branch picker stays centered in the editor.
 */
export function GitCreateBranchApp() {
  const api = useVsCodeApi();
  const client = useMemo(() => createProtocolClient(api.postMessage), [api.postMessage]);
  const bootstrap = isCreateBranchBootstrap(window.__GITVIEW_BOOTSTRAP__)
    ? window.__GITVIEW_BOOTSTRAP__
    : null;
  const repoId = bootstrap?.repoId ?? "";

  const [branches, setBranches] = useState<BranchEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handler = (event: MessageEvent) => {
      void client.handleHostMessage(event.data);
    };
    window.addEventListener("message", handler);

    // The handshake gates every later request. If it fails — or simply never
    // settles — the panel would sit empty with no error and no way out, so both
    // outcomes are surfaced and the dialog is released to render its error
    // state instead of staying on `ready === false` forever.
    const timeout = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      setLoadError(HANDSHAKE_FAILED_MESSAGE);
      setReady(true);
    }, HANDSHAKE_TIMEOUT_MS);

    void client
      .ready("gitCreateBranch")
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const detail = error instanceof Error ? error.message : String(error);
        setLoadError(
          detail
            ? `${HANDSHAKE_FAILED_MESSAGE} (${detail})`
            : HANDSHAKE_FAILED_MESSAGE,
        );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("message", handler);
    };
  }, [client]);

  useEffect(() => {
    if (!repoId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await client.listBranches(repoId);
        if (!cancelled) {
          setBranches(snapshot.branches);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            `Could not load branches: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, repoId]);

  const close = () => {
    api.postMessage({ type: "git.createBranch.close" });
  };

  const onConfirm = async (
    name: string,
    startPoint: string | undefined,
    opts: { checkout?: boolean; force?: boolean },
  ) => {
    if (!repoId) {
      return;
    }
    setBusy(true);
    try {
      await client.createBranch(repoId, name, startPoint, opts);
      close();
    } catch (err) {
      setBusy(false);
      setLoadError(
        `Could not create the branch: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  if (!ready) {
    return null;
  }

  if (loadError) {
    return (
      <GitDialogShell
        open
        variant="embedded"
        title="Create New Branch"
        testId="create-branch-error-dialog"
        onCancel={close}
        footer={
          <Button
            type="button"
            variant="primary" size="compact"
            onClick={close}
            data-testid="create-branch-error-close"
          >
            Close
          </Button>
        }
      >
        <p
          className="m-0 text-danger-fg"
          data-testid="create-branch-error-banner"
        >
          {loadError}
        </p>
      </GitDialogShell>
    );
  }

  return (
    <CreateBranchDialog
      open
      embedded
      branches={branches}
      startPoint={bootstrap?.startPoint ?? ""}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={close}
    />
  );
}
