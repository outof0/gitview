import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Settings, X } from "lucide-react";
import type { LogQueryFilters } from "@gitview/shared/types/log";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { LogMenuPortal } from "../../components/git/workspaceLogPanel/logMenuPortal";

type LogChromeTab = { id: string; title: string; filters: LogQueryFilters };

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

export function GitBottomPanelHeader({ ctx }: { ctx: GitWorkspaceController }) {
  const {
    setWorkspaceTab,
    logFilters,
    setLogFilters,
    clientRef,
    activeRepo,
    runMutation,
  } = ctx;
  const canAbort = Boolean(
    activeRepo?.operation &&
      activeRepo.operation.type !== "none" &&
      activeRepo.operation.canAbort,
  );
  const [logTabs, setLogTabs] = useState<LogChromeTab[]>(() => [
    { id: "log", title: "Log", filters: logFilters },
  ]);
  const [activeLogTabId, setActiveLogTabId] = useState("log");
  const activeRef = useRef(activeLogTabId);
  activeRef.current = activeLogTabId;
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

  const tabClass = (selected: boolean) =>
    `shrink-0 h-7 px-2.5 inline-flex items-center gap-1 text-[length:var(--vscode-font-size,13px)] rounded-sm ${
      selected
        ? "bg-[var(--vscode-tab-activeBackground,var(--nx-panel2,#27282E))] text-[var(--vscode-tab-activeForeground,var(--nx-text,#E8E8EA))] font-medium"
        : "text-[var(--vscode-tab-inactiveForeground,var(--nx-muted,#9B9CA3))] hover:bg-[var(--vscode-toolbar-hoverBackground,transparent)]"
    }`;

  const iconBtn =
    "h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-sm text-[var(--vscode-icon-foreground,var(--nx-muted,#9B9CA3))] hover:bg-[var(--vscode-toolbar-hoverBackground,transparent)]";

  const selectLogTab = (id: string) => {
    const tab = logTabs.find((t) => t.id === id);
    setActiveLogTabId(id);
    activeRef.current = id;
    setWorkspaceTab("log");
    if (tab && !filtersEqual(tab.filters, logFilters)) {
      setLogFilters(tab.filters);
    }
  };

  const addLogTab = () => {
    const title = "Log";
    const id = nextLogTabId();
    const newFilters: LogQueryFilters = { ...logFilters };
    setLogTabs((tabs) => [...tabs, { id, title, filters: newFilters }]);
    setActiveLogTabId(id);
    activeRef.current = id;
    setWorkspaceTab("log");
    if (!filtersEqual(newFilters, logFilters)) {
      setLogFilters(newFilters);
    }
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
      setWorkspaceTab("log");
      if (!filtersEqual(next.filters, logFilters)) {
        setLogFilters(next.filters);
      }
    }
  };

  return (
    <div
      className="relative shrink-0 flex h-8 min-h-8 w-full items-center gap-1 border-b border-border bg-[var(--vscode-panel-background,var(--nx-panel,#202126))] px-2"
      data-testid="workspace-tab-bar"
      data-git-bottom-header="true"
    >
      {logTabs.map((tab, index) => {
        const selected = activeLogTabId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={tabClass(selected)}
            onClick={() => selectLogTab(tab.id)}
            data-testid={
              index === 0 ? "workspace-tab-log" : `git-log-session-${tab.id}`
            }
            aria-current={selected ? "page" : undefined}
          >
            <span className="max-w-[140px] truncate">{tab.title}</span>
            {logTabs.length > 1 ? (
              <span
                role="button"
                tabIndex={0}
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-list-hover"
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
          </button>
        );
      })}

      <button
        type="button"
        className={iconBtn}
        aria-label="Add Log tab"
        data-testid="git-panel-add-tab"
        onClick={addLogTab}
      >
        <Plus size={16} aria-hidden />
      </button>

      <div className="min-w-0 flex-1" />

      {canAbort && activeRepo ? (
        <button
          type="button"
          className="h-6 shrink-0 px-2 text-[11px] text-[var(--vscode-errorForeground)] hover:bg-list-hover rounded-sm"
          data-testid="git-panel-abort-operation"
          onClick={() =>
            void runMutation(() =>
              clientRef.current.abortOperation(activeRepo.id),
            )
          }
        >
          Abort
        </button>
      ) : null}

      <button
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
      </button>
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
                className="flex h-7 items-center gap-2 px-2.5 text-[12px] text-foreground cursor-pointer select-none hover:bg-[var(--vscode-menu-selectionBackground,var(--vscode-list-hoverBackground))] hover:text-[var(--vscode-menu-selectionForeground,var(--vscode-editor-foreground))] rounded-sm"
              >
                <span
                  className={`w-[14px] h-[14px] rounded-[2px] border flex items-center justify-center shrink-0 ${
                    checked
                      ? "bg-[var(--vscode-checkbox-background,var(--vscode-input-background))] border-[var(--vscode-checkbox-border,var(--border))] text-[var(--vscode-checkbox-foreground,var(--vscode-button-foreground))]"
                      : "bg-[var(--vscode-checkbox-background,transparent)] border-[var(--vscode-checkbox-border,var(--border))]"
                  }`}
                >
                  {checked ? <Check size={10} aria-hidden /> : null}
                </span>
                <input
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

      <button
        type="button"
        className={iconBtn}
        aria-label="Collapse panel"
        data-testid="git-panel-collapse"
        onClick={() => void clientRef.current.collapsePanel()}
      >
        <ChevronDown size={16} aria-hidden />
      </button>
    </div>
  );
}
