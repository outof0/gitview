import { useEffect } from "react";
import { buildGitSubmenuEnablementContext } from "@gitview/types";
import { GitContextMenuItems } from "../components/git/GitContextMenuItems";
import { ContextMenu } from "../components/ui/ContextMenu";

/**
 * Deterministic fixture for Playwright visual baselines of the webview Git menu.
 * Open via /?app=gitMenu or playground.html?app=gitMenu&theme=dark
 */
export function GitMenuVisualFixture() {
  useEffect(() => {
    document.body.classList.add("vscode-dark");
    return () => {
      document.body.classList.remove("vscode-dark");
    };
  }, []);

  const enablement = buildGitSubmenuEnablementContext({
    repository: {
      upstream: "origin/main",
      ahead: 1,
      behind: 0,
      dirty: true,
      trusted: true,
      operation: { type: "none" },
      conflictCount: 0,
    },
    files: [
      {
        repoId: "playground-repo",
        path: "src/app.ts",
        kind: "modified",
        indexStatus: " ",
        workingTreeStatus: "M",
        staged: false,
        conflicted: false,
        binary: false,
      },
    ],
    relativePath: "src/app.ts",
    stashCount: 0,
    shelfCount: 1,
    hasRemote: true,
  });

  return (
    <div
      className="h-screen w-screen bg-[var(--vscode-editor-background,#1e1e1e)] text-foreground"
      data-testid="git-menu-visual-root"
    >
      <div className="absolute left-8 top-8 text-[11px] text-[var(--vscode-descriptionForeground)]">
        Visual fixture — Git context menu
      </div>
      <ContextMenu
        menu={{ visible: true, x: 48, y: 56 }}
        onClose={() => undefined}
        testId="git-menu-visual"
        ariaLabel="Git"
        minWidth={260}
      >
        <GitContextMenuItems
          isFolder={false}
          onShowHistory={() => undefined}
          onGitAction={() => undefined}
          onClose={() => undefined}
          enablement={enablement}
        />
      </ContextMenu>
    </div>
  );
}
