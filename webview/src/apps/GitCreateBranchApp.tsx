import { useEffect, useMemo, useState } from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { createProtocolClient } from "../protocol/client";
import { CreateBranchDialog } from "../components/git/CreateBranchDialog";
import type { GitCreateBranchBootstrap } from "../types/gitviewBootstrap";

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
  const client = useMemo(() => createProtocolClient(api.postMessage), [api]);
  const bootstrap = isCreateBranchBootstrap(window.__GITVIEW_BOOTSTRAP__)
    ? window.__GITVIEW_BOOTSTRAP__
    : null;
  const repoId = bootstrap?.repoId ?? "";

  const [branches, setBranches] = useState<BranchEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      void client.handleHostMessage(event.data);
    };
    window.addEventListener("message", handler);
    void client.ready("gitCreateBranch").catch(() => {});
    return () => window.removeEventListener("message", handler);
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
          setLoadError(err instanceof Error ? err.message : String(err));
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
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!ready) {
    return null;
  }

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center">
        <div className="flex flex-col gap-2">
          <p
            className="m-0 text-[var(--vscode-errorForeground)]"
            data-testid="create-branch-error-banner"
          >
            Could not load branches: {loadError}
          </p>
          <button
            type="button"
            className="btn-vscode h-[var(--nx-row-h)] px-2.5"
            onClick={close}
            data-testid="create-branch-error-close"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <CreateBranchDialog
      open
      branches={branches}
      startPoint={bootstrap?.startPoint ?? ""}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={close}
    />
  );
}
