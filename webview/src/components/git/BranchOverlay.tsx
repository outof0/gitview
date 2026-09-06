import { Button } from "../ui/Button";
import { useEffect, useState } from "react";
import type { BranchListSnapshot } from "@gitview/shared/types/branch";
import {
  isConfirmationEvidence,
  type ConfirmationSubmission,
  type ForceCheckoutConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { isErrorCode } from "../../lib/errorCode";
import { CreateBranchDialog } from "./CreateBranchDialog";
import { BranchesPopup } from "./BranchesPopup";
import { ForceCheckoutDialog } from "./ForceCheckoutDialog";
import type { BranchOverlayRequest } from "../../apps/branchOverlayGuards";

/** Protocol surface the overlay needs: branch list, create, checkout. */
export type BranchOverlayClient = {
  listBranches: (repoId: string) => Promise<BranchListSnapshot>;
  createBranch: (
    repoId: string,
    name: string,
    startPoint?: string,
    opts?: { checkout?: boolean; force?: boolean },
  ) => Promise<unknown>;
  checkoutBranch: (
    repoId: string,
    ref: string,
    opts?: {
      smart?: boolean;
      force?: boolean;
      confirmation?: ConfirmationSubmission;
    },
  ) => Promise<unknown>;
};

type BranchOverlayProps = {
  request: BranchOverlayRequest;
  client: BranchOverlayClient;
  onClose: () => void;
};

/**
 * New Branch / Branches rendered on top of the tab that is already open
 * (diff/compare or blame) instead of a new editor tab. Both popups paint
 * their own fullscreen backdrop, so this only owns data loading and close.
 */
export function BranchOverlay({ request, client, onClose }: BranchOverlayProps) {
  const [snapshot, setSnapshot] = useState<BranchListSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pending typed force-checkout confirmation, issued by the host as
  // CONFIRMATION_REQUIRED evidence on the failed force checkout.
  const [forceConfirm, setForceConfirm] = useState<{
    ref: string;
    smart?: boolean;
    confirmation: ForceCheckoutConfirmationEvidence;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setError(null);
    void client
      .listBranches(request.repoId)
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, request]);

  const confirmCreateBranch = async (
    name: string,
    startPoint: string | undefined,
    opts: { checkout?: boolean; force?: boolean },
  ) => {
    setBusy(true);
    try {
      await client.createBranch(request.repoId, name, startPoint, opts);
      onClose();
    } catch (err) {
      setBusy(false);
      setError(
        `Could not create the branch: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const checkout = async (
    ref: string,
    opts?: { smart?: boolean; force?: boolean },
    confirmation?: ConfirmationSubmission,
  ) => {
    setBusy(true);
    try {
      await client.checkoutBranch(request.repoId, ref, { ...opts, confirmation });
      setForceConfirm(null);
      onClose();
    } catch (err) {
      const details = (err as { details?: { confirmation?: unknown } }).details;
      const evidence = isConfirmationEvidence(details?.confirmation)
        ? details.confirmation
        : undefined;
      if (
        evidence?.action === "force_checkout" &&
        (isErrorCode(err, "CONFIRMATION_REQUIRED") ||
          isErrorCode(err, "CONFIRMATION_STALE"))
      ) {
        setBusy(false);
        setForceConfirm({ ref, smart: opts?.smart, confirmation: evidence });
        if (isErrorCode(err, "CONFIRMATION_STALE")) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return;
      }
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const reload = () => {
    setError(null);
    void client
      .listBranches(request.repoId)
      .then(setSnapshot)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  if (error && request.surface === "createBranch") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay-modal p-3">
        <div className="flex flex-col gap-2 text-center">
          <p
            className="m-0 text-danger-fg"
            data-testid="branch-overlay-error"
          >
            {error}
          </p>
          <Button variant="primary" size="content"
            type="button"
            className="btn-vscode h-row px-2.5"
            onClick={onClose}
            data-testid="branch-overlay-error-close"
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (request.surface === "createBranch") {
    return (
      <CreateBranchDialog
        open
        branches={snapshot?.branches ?? []}
        startPoint={request.startPoint ?? ""}
        busy={busy}
        onConfirm={(name, startPoint, opts) => {
          void confirmCreateBranch(name, startPoint, opts);
        }}
        onCancel={onClose}
      />
    );
  }

  return (
    <>
      <BranchesPopup
        open
        snapshot={snapshot}
        loading={!snapshot && !error}
        busy={busy}
        error={error}
        onClose={onClose}
        onRefresh={reload}
        onCheckout={(ref, opts) => {
          void checkout(ref, opts);
        }}
        onRequestForceCheckout={(ref, opts) => {
          void checkout(ref, { smart: opts?.smart, force: true });
        }}
        onCreate={(name) => {
          setBusy(true);
          client
            .createBranch(request.repoId, name, undefined)
            .then(() => reload())
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : String(err)),
            )
            .finally(() => setBusy(false));
        }}
      />
      {forceConfirm ? (
        <ForceCheckoutDialog
          open
          confirmation={forceConfirm.confirmation}
          repositoryNames={[forceConfirm.confirmation.repoId]}
          busy={busy}
          onCancel={() => setForceConfirm(null)}
          onConfirm={(submission) => {
            void checkout(
              forceConfirm.ref,
              { smart: forceConfirm.smart, force: true },
              submission,
            );
          }}
        />
      ) : null}
    </>
  );
}
