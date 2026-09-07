import { Button } from "../../components/ui/Button";
import { Tooltip } from "../../components/ui/Tooltip";
import { PanelLeftClose } from "lucide-react";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";

export function GitCommitSidebarHeader({
  ctx,
  onHideSidebar,
}: {
  ctx: GitWorkspaceController;
  onHideSidebar?: () => void;
}) {
  const {
    clientRef,
    workspaceTab,
    setWorkspaceTab,
    setTemporarySubTab,
  } = ctx;
  const commitSelected = workspaceTab !== "temporary";
  const stashSelected = workspaceTab === "temporary";

  const tabClass = (selected: boolean) =>
    `shrink-0 h-7 px-2.5 inline-flex items-center text-ui-base rounded-vscode ${
      selected
        ? "bg-tab-active-bg text-tab-active-fg font-medium"
        : "text-tab-inactive-fg hover:bg-toolbar-hover"
    }`;

  return (
    <div
      className="relative flex h-toolbar min-h-toolbar w-full shrink-0 items-center gap-0.5 border-b border-border bg-vscode-sidebar-bg px-pad-x"
      data-testid="commit-sidebar-header"
      >
      <Button
        variant="ghost"
        size="content"
        className={tabClass(commitSelected)}
        onClick={() => setWorkspaceTab("changes")}
        data-testid="commit-sidebar-tab-commit"
        aria-current={commitSelected ? "page" : undefined}
      >
        Commit
      </Button>
      <Button
        variant="ghost"
        size="content"
        className={tabClass(stashSelected)}
        onClick={() => {
          setTemporarySubTab("stash");
          setWorkspaceTab("temporary");
        }}
        data-testid="commit-sidebar-tab-stash"
        aria-current={stashSelected ? "page" : undefined}
      >
        Stash
      </Button>
      <div className="min-w-0 flex-1" />
      <Tooltip label="Hide Commit sidebar">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-icon-fg"
          type="button"
          onClick={() => {
            if (onHideSidebar) {
              onHideSidebar();
              return;
            }
            void clientRef.current.toggleSidebar();
          }}
          aria-label="Hide Commit sidebar"
          data-testid="commit-sidebar-hide"
        >
          <PanelLeftClose size={16} aria-hidden />
        </Button>
      </Tooltip>
    </div>
  );
}
