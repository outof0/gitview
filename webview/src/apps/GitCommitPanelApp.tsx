import { useEffect, useRef } from "react";
import { GitWorkspaceApp } from "./GitWorkspaceApp";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { useGitWorkspaceStore } from "../stores/gitWorkspaceStore";

/**
 * Editor-area Commit surface.
 *
 * Same component as the Git panel, mounted in a panel that has the full window
 * height. The bottom Git panel is ~258px tall, and a dialog that fills `80vh`
 * there gets ~206px — which leaves the Commit dialog's file/diff split at 2px,
 * so files cannot be seen or picked before committing.
 */
export function GitCommitPanelApp() {
  const api = useVsCodeApi();
  const commitOpen = useGitWorkspaceStore((state) => Boolean(state.dialogs.commit));
  const hasOpened = useRef(false);

  useEffect(() => {
    if (commitOpen) {
      hasOpened.current = true;
      return;
    }
    // The dialog mounts closed and opens on the next tick, so only a dismissal
    // *after* it has been open counts as the user being done.
    if (hasOpened.current) {
      api.postMessage({ type: "git.commit.close" });
    }
  }, [commitOpen, api]);

  return <GitWorkspaceApp surface="commit" />;
}
