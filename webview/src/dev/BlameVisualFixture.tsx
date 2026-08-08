import { useEffect, useState } from "react";
import type { BlameSnapshot } from "@gitview/shared/types/blame";
import { WorkspaceBlamePanel } from "../components/git/WorkspaceBlamePanel";
import { ResizableSplit } from "../components/ui/ResizableSplit";
import { GitHistoryToolWindow } from "../screens/GitHistoryToolWindow";
import { useGitHistoryStore } from "../stores/gitHistoryStore";
import {
  VISUAL_HISTORY_PATH,
  VISUAL_REPO_ID,
  visualBlameLines,
  visualHistoryCommits,
} from "./historyBlameVisualFixtures";

/**
 * Seeded Annotate screen for visual baselines.
 * /?app=gitBlameVisual
 */
export function BlameVisualFixture() {
  const commits = visualHistoryCommits();
  const headSha = commits[0]!.sha;
  const [selectedSha, setSelectedSha] = useState(headSha);

  useEffect(() => {
    document.body.classList.add("vscode-dark");
    useGitHistoryStore.setState({
      path: VISUAL_HISTORY_PATH,
      isFolder: false,
      repoId: VISUAL_REPO_ID,
      loading: false,
      error: null,
      commits,
      branches: ["master", "feature"],
      branchFilter: "master",
      selectedSha: headSha,
      selectedChangedFilePath: VISUAL_HISTORY_PATH,
      showDiffPreview: false,
      showDetails: true,
      annotateMode: true,
      commitDetailLoading: false,
    });
  }, [commits, headSha]);

  const snapshot: BlameSnapshot = {
    repoId: VISUAL_REPO_ID,
    filePath: VISUAL_HISTORY_PATH,
    ref: "HEAD",
    lines: visualBlameLines(),
    truncated: false,
    refreshedAt: tFixed(),
  };

  return (
    <div
      className="h-full min-h-screen w-full flex flex-col text-foreground bg-vscode-editor-bg font-[family-name:var(--nx-font-ui)] vscode-dark"
      data-testid="git-blame-app"
    >
      <ResizableSplit
        direction="vertical"
        initialPercent={68}
        minFirstPercent={36}
        minSecondPercent={18}
        className="flex-1 min-h-0 h-full"
        first={
          <WorkspaceBlamePanel
            snapshot={snapshot}
            filePath={VISUAL_HISTORY_PATH}
            headSha={headSha}
            loading={false}
            selectedSha={selectedSha}
            onOpenCommit={setSelectedSha}
          />
        }
        second={
          <div
            className="h-full min-h-0 flex flex-col"
            data-testid="blame-git-log-pane"
          >
            <GitHistoryToolWindow
              embedded
              twoPaneLayout
              currentSha={headSha}
            />
          </div>
        }
      />
    </div>
  );
}

function tFixed(): number {
  return 1_704_067_200_000;
}
