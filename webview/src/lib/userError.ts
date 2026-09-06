import { useGitViewStore } from "../stores/gitViewStore";

/**
 * Prose for a caught `unknown`, never empty.
 *
 * `String(error)` on an Error with no message yields "Error", which tells the
 * user nothing. Fall back to the error's name in that case.
 */
export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  return String(error);
}

/**
 * Surfaces a failed "open in editor" request.
 *
 * `client.openDiffInEditor` rejections used to be swallowed at every call site,
 * so a click that did nothing looked like a slow editor instead of a failed
 * one. Errors become a blocking toast; routine feedback stays in the status
 * line, per `showToast`.
 */
export function reportDiffOpenError(error: unknown): void {
  useGitViewStore
    .getState()
    .showToast(
      `Could not open the diff in the editor: ${errorMessageOf(error)}`,
      "error",
    );
}

/**
 * Records a failed `webview.ready` handshake on a surface that already has its
 * own timeout and error state.
 *
 * Use this only when the user is *not* stranded — Diff and Blame both keep a
 * load timeout that renders "…did not load", so the failed handshake needs a
 * diagnostic, not another banner. On a surface where the handshake gates
 * rendering, surface the error instead: see `GitCreateBranchApp` and
 * `GitHistoryApp`.
 *
 * The host pushes the panel's data only after it answers the handshake, so a
 * failure here always means the surface is about to look empty. A silent
 * `.catch(() => {})` made that indistinguishable from a slow host.
 */
export function warnHandshakeFailure(surface: string, error: unknown): void {
  console.warn(
    `[gitview] "${surface}" handshake failed; the panel will not receive data:`,
    error,
  );
}
