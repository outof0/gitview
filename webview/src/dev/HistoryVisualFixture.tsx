import { useEffect } from "react";
import { GitHistoryToolWindow } from "../screens/GitHistoryToolWindow";
import { useGitHistoryStore } from "../stores/gitHistoryStore";
import {
  VISUAL_HISTORY_PATH,
  VISUAL_REPO_ID,
  visualHistoryCommits,
} from "./historyBlameVisualFixtures";

/**
 * Log layout fixture:
 * commits+graph | changed files + commit details
 * /?app=gitHistoryVisual
 */
export function HistoryVisualFixture() {
  useEffect(() => {
    document.body.classList.add("vscode-dark");
    const commits = visualHistoryCommits();
    const head = commits[0]!;
    useGitHistoryStore.setState({
      path: VISUAL_HISTORY_PATH,
      isFolder: false,
      repoId: VISUAL_REPO_ID,
      loading: false,
      error: null,
      commits,
      branches: ["master", "feature", "origin/master", "origin/feature"],
      branchFilter: "master",
      authorFilter: "",
      searchQuery: "",
      // Default closed — Show History must not open with a static branch tree.
      branchTreeOpen: false,
      selectedSha: head.sha,
      selectedChangedFilePath: VISUAL_HISTORY_PATH,
      fileDiff: null,
      patchLoading: false,
      patchError: null,
      showDiffPreview: false,
      showDetails: true,
      annotateMode: false,
      commitDetailLoading: false,
    });
  }, []);

  return (
    <div
      className="h-screen w-screen overflow-hidden font-[family-name:var(--nx-font-ui)] text-[length:var(--nx-font-size-ui)] bg-vscode-editor-bg text-vscode-editor-fg vscode-dark"
      data-testid="git-history-app"
    >
      <div
        className="h-full min-h-0 flex flex-col"
        data-testid="history-git-log-pane"
      >
        <GitHistoryToolWindow embedded />
      </div>
    </div>
  );
}
