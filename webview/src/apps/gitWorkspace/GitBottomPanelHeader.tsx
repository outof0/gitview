import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  PanelLeftOpen,
  Plus,
  Settings,
  X,
} from "lucide-react";
import type { LogQueryFilters } from "@gitview/shared/types/log";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import type { GitWorkspaceHistoryScope } from "../../stores/gitWorkspaceStoreTypes";
import { createRootLogFilters } from "../../stores/gitWorkspaceLogDefaults";
import { LogMenuPortal } from "../../components/git/workspaceLogPanel/logMenuPortal";
import { Tooltip } from "../../components/ui/Tooltip";

type LogChromeTab = {
  id: string;
  title: string;
  filters: LogQueryFilters;
  kind?: "log" | "history";
  historyScope?: GitWorkspaceHistoryScope;
};

function nextLogTabId(): string {
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function filtersEqual(a: LogQueryFilters, b: LogQueryFilters): boolean {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    // treat undefined and missing as equal
    if (av !== bv) {
      if (av == null && bv == null) {
        continue;
      }
      return false;
    }
  }
  return true;
}

function historyFilters(
  current: LogQueryFilters,
  scope: GitWorkspaceHistoryScope,
): LogQueryFilters {
  // History is a new resource-scoped view. Carry over presentation settings,
  // but never carry query filters from the Log tab (branch/author/date/grep)
  // because they can make a file appear to have the wrong or empty history.
  return {
    range: "all",
    limit: Math.min(current.limit ?? 100, 100),
    path: scope.path,
    isFolder: scope.isFolder,
    collapseLinear: current.collapseLinear,
    graphSort: current.graphSort,
    highlightCurrentBranch: current.highlightCurrentBranch,
    compactRows: current.compactRows,
  };
}

export function GitBottomPanelHeader({ ctx }: { ctx: GitWorkspaceController }) {
  const {
    setWorkspaceTab,
    logFilters,
    setLogFilters,
    clientRef,
    activeRepo,
    runMutation,
    historyOpenRequest,
    setActiveHistoryScope,
    logRootRequest,
    resetLogView,
  } = ctx;
  const canAbort = Boolean(
    activeRepo?.operation &&
      activeRepo.operation.type !== "none" &&
      activeRepo.operation.canAbort,
  );
  const [logTabs, setLogTabs] = useState<LogChromeTab[]>(() => [
    { id: "log", title: "Log", kind: "log", filters: logFilters },
  ]);
  const [activeLogTabId, setActiveLogTabId] = useState("log");
  const activeRef = useRef(activeLogTabId);
  activeRef.current = activeLogTabId;
  const handledHistoryRequestRef = useRef<GitWorkspaceHistoryScope | null>(null);
  const handledRootRequestRef = useRef(logRootRequest);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] =
    useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    const activeId = activeRef.current;
    setLogTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeId) {
          return tab;
        }
        if (filtersEqual(tab.filters, logFilters)) {
          return tab;
        }
        return { ...tab, filters: logFilters };
      }),
    );
  }, [logFilters]);

  useEffect(() => {
    if (handledRootRequestRef.current === logRootRequest) {
      return;
    }
    handledRootRequestRef.current = logRootRequest;
    const rootFilters = createRootLogFilters();
    setLogTabs((tabs) =>
      tabs.map((tab, index) =>
        index === 0
          ? { ...tab, id: "log", title: "Log", kind: "log", filters: rootFilters }
          : tab,
      ),
    );
    setActiveLogTabId("log");
    activeRef.current = "log";
    setSettingsOpen(false);
    setWorkspaceTab("log");
    setActiveHistoryScope(null);
    if (!filtersEqual(rootFilters, logFilters)) {
      setLogFilters(rootFilters);
    }
  }, [
    logFilters,
    logRootRequest,
    setActiveHistoryScope,
    setLogFilters,
    setWorkspaceTab,
  ]);

  useEffect(() => {
    if (!historyOpenRequest) {
      return;
    }
    if (handledHistoryRequestRef.current === historyOpenRequest) {
      return;
    }
    handledHistoryRequestRef.current = historyOpenRequest;
    const existing = logTabs.find(
      (tab) =>
        tab.historyScope?.repoId === historyOpenRequest.repoId &&
        tab.historyScope.path === historyOpenRequest.path &&
        tab.historyScope.isFolder === historyOpenRequest.isFolder &&
        tab.historyScope.showDiff === historyOpenRequest.showDiff,
    );
    const filters = historyFilters(logFilters, historyOpenRequest);
    const id = existing?.id ?? nextLogTabId();
    if (!existing) {
      const name = historyOpenRequest.path.split("/").filter(Boolean).pop() ?? ".";
      setLogTabs((tabs) => [
        ...tabs,
        {
          id,
          title: `History · ${name}${historyOpenRequest.isFolder ? "/" : ""}`,
          kind: "history",
          filters,
          historyScope: historyOpenRequest,
        },
      ]);
    }
    setActiveLogTabId(id);
    activeRef.current = id;
    setWorkspaceTab("log");
    setActiveHistoryScope(historyOpenRequest);
    if (!filtersEqual(filters, logFilters)) {
      setLogFilters(filters);
    }
  }, [
    historyOpenRequest,
    logFilters,
    logTabs,
    setActiveHistoryScope,
    setLogFilters,
    setWorkspaceTab,
  ]);

  const tabClass = (selected: boolean) =>
    `shrink-0 h-7 px-2.5 inline-flex items-center gap-1 text-ui-base rounded-vscode ${
      selected
        ? "bg-tab-active-bg text-tab-active-fg font-medium"
        : "text-tab-inactive-fg hover:bg-toolbar-hover"
    }`;

  const iconBtn =
    "h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-vscode text-icon-fg hover:bg-toolbar-hover";

  const selectLogTab = (id: string) => {
    const tab = logTabs.find((t) => t.id === id);
    setActiveLogTabId(id);
    activeRef.current = id;
    if (tab?.kind === "history" || tab?.historyScope) {
      setWorkspaceTab("log");
      setActiveHistoryScope(tab.historyScope ?? null);
    } else {
      setWorkspaceTab("log");
      setActiveHistoryScope(null);
    }
    if (tab && !filtersEqual(tab.filters, logFilters)) {
      setLogFilters(tab.filters);
    }
  };

  const addLogTab = () => {
    const title = "Log";
    const id = nextLogTabId();
    const newFilters: LogQueryFilters = createRootLogFilters();
    setLogTabs((tabs) => [...tabs, { id, title, kind: "log", filters: newFilters }]);
    setActiveLogTabId(id);
    activeRef.current = id;
    setWorkspaceTab("log");
    setActiveHistoryScope(null);
    resetLogView();
  };

  const closeLogTab = (id: string) => {
    if (logTabs.length <= 1) {
      return;
    }
    const remaining = logTabs.filter((tab) => tab.id !== id);
    setLogTabs(remaining);
    if (activeRef.current === id) {
      const next = remaining[remaining.length - 1]!;
      setActiveLogTabId(next.id);
      activeRef.current = next.id;
      if (next.kind === "history" || next.historyScope) {
        setWorkspaceTab("log");
        setActiveHistoryScope(next.historyScope ?? null);
      } else {
        setWorkspaceTab("log");
        setActiveHistoryScope(null);
      }
      if (!filtersEqual(next.filters, logFilters)) {
        setLogFilters(next.filters);
      }
    }
  };

  return (
    <div
      className="relative shrink-0 flex h-8 min-h-8 w-full items-center gap-1 border-b border-border bg-panel-bg px-2"
      data-testid="workspace-tab-bar"
      data-git-bottom-header="true"
    >
      {logTabs.map((tab, index) => {
        const selected = activeLogTabId === tab.id;
        return (
          <Button variant="ghost" size="content"
            key={tab.id}
            type="button"
            className={tabClass(selected)}
            onClick={() => selectLogTab(tab.id)}
            data-testid={
              index === 0 ? "workspace-tab-log" : `git-log-session-${tab.id}`
            }
            aria-current={selected ? "page" : undefined}
          >
            <span className="max-w-tab-title truncate">{tab.title}</span>
            {logTabs.length > 1 ? (
              <span
                role="button"
                tabIndex={0}
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-vscode hover:bg-list-hover"
                aria-label={`Close ${tab.title}`}
                data-testid={`workspace-tab-log-close-${tab.id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeLogTab(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeLogTab(tab.id);
                  }
                }}
              >
                <X size={11} aria-hidden />
              </span>
            ) : null}
          </Button>
        );
      })}

      <Button variant="ghost" size="content"
        type="button"
        className={iconBtn}
        aria-label="Add Log tab"
        data-testid="git-panel-add-tab"
        onClick={addLogTab}
      >
        <Plus size={16} aria-hidden />
      </Button>

      <Tooltip label="Toggle Commit sidebar">
        <Button
          variant="ghost"
          size="content"
          type="button"
          className={iconBtn}
          aria-label="Toggle Commit sidebar"
          data-testid="git-panel-toggle-commit-sidebar"
          onClick={() => void clientRef.current.toggleSidebar()}
        >
          <PanelLeftOpen size={16} aria-hidden />
        </Button>
      </Tooltip>

      <div className="min-w-0 flex-1" />

      {canAbort && activeRepo ? (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 shrink-0 px-2 text-ui-sm text-danger-fg hover:bg-list-hover rounded-vscode"
          data-testid="git-panel-abort-operation"
          onClick={() =>
            void runMutation(() =>
              clientRef.current.abortOperation(activeRepo.id),
            )
          }
        >
          Abort
        </Button>
      ) : null}

      <Button variant="ghost" size="content"
        ref={setSettingsAnchor}
        type="button"
        className={iconBtn}
        aria-label="Panel settings"
        aria-expanded={settingsOpen}
        data-testid="git-panel-settings"
        onClick={(event) => {
          event.stopPropagation();
          setSettingsOpen((open) => !open);
        }}
      >
        <Settings size={16} aria-hidden />
      </Button>
      <LogMenuPortal
        open={settingsOpen}
        anchor={settingsAnchor}
        onClose={() => setSettingsOpen(false)}
        label="Panel settings"
        align="right"
      >
        <div data-testid="git-panel-settings-menu">
          {(
            [
              ["compactRows", "Compact rows"],
              ["highlightCurrentBranch", "Highlight current branch"],
              ["noMerges", "Hide merge commits"],
              ["firstParent", "First parent only"],
            ] as const
          ).map(([key, label]) => {
            const checked = Boolean(logFilters[key]);
            return (
              <label
                key={key}
                className="flex min-h-menu-item items-center gap-2 px-menu-pad-x py-menu-pad-y text-ui text-menu-fg cursor-pointer select-none hover:bg-menu-selection hover:text-menu-selectionForeground outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span
                  className={`w-icon-sm h-icon-sm rounded-vscode border flex items-center justify-center shrink-0 ${
                    checked
                      ? "bg-checkbox-bg border-checkbox-border text-checkbox-fg"
                      : "bg-checkbox-bg border-checkbox-border"
                  }`}
                >
                  {checked ? <Check size={10} aria-hidden /> : null}
                </span>
                <Input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    setLogFilters({ ...logFilters, [key]: event.target.checked })
                  }
                  className="sr-only"
                />
                {label}
              </label>
            );
          })}
        </div>
      </LogMenuPortal>

      <Button variant="ghost" size="content"
        type="button"
        className={iconBtn}
        aria-label="Collapse panel"
        data-testid="git-panel-collapse"
        onClick={() => void clientRef.current.collapsePanel()}
      >
        <ChevronDown size={16} aria-hidden />
      </Button>
    </div>
  );
}
