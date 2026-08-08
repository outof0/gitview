import { useCallback, useEffect, useState } from "react";
import type { GitViewSettings } from "@gitview/types";
import type { MockHost } from "./mockHost";
import type { PlaygroundScenario } from "./fixtures";
import { useGitViewStore } from "../stores/gitViewStore";

type DevToolbarProps = {
  host: MockHost;
};

const SCENARIOS: { id: PlaygroundScenario; label: string }[] = [
  { id: "conflictList", label: "Conflict list" },
  { id: "simpleMerge", label: "Merge (TS)" },
  { id: "tallMerge", label: "Merge (tall)" },
  { id: "markersMerge", label: "Merge (markers)" },
];

export function DevToolbar({ host }: DevToolbarProps) {
  const [posted, setPosted] = useState(host.getPosted());
  const [settings, setSettings] = useState(host.getSettings());
  const [expanded, setExpanded] = useState(true);
  const screen = useGitViewStore((s) => s.screen);

  const refresh = useCallback(() => {
    setPosted(host.getPosted());
    setSettings(host.getSettings());
  }, [host]);

  useEffect(() => {
    const id = window.setInterval(refresh, 400);
    return () => window.clearInterval(id);
  }, [refresh]);

  const loadScenario = (scenario: PlaygroundScenario) => {
    host.clearPosted();
    if (scenario === "conflictList") {
      useGitViewStore.setState({
        screen: "conflictList",
        activeDocument: null,
        activeBlockId: null,
      });
      host.loadScenario(scenario);
    } else {
      host.loadScenario(scenario);
    }
    refresh();
  };

  const toggleSetting = (key: keyof GitViewSettings, value: boolean) => {
    host.pushSettings({ [key]: value } as Partial<GitViewSettings>);
    refresh();
  };

  return (
    <div
      className="shrink-0 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background,#252526)] text-[11px] text-[var(--vscode-foreground)]"
      data-testid="playground-toolbar"
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="font-semibold text-[var(--vscode-textLink-foreground)]">
          Playground
        </span>
        <span className="opacity-60">|</span>
        <span className="opacity-80">
          screen: <code>{screen}</code>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="px-2 py-0.5 rounded hover:bg-[var(--toolbar-hover)]"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "Show"} panel
        </button>
      </div>
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--toolbar-hover)]"
              onClick={() => loadScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
          <span className="opacity-40">|</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.confirmBeforeMarkResolved}
              onChange={(e) =>
                toggleSetting("confirmBeforeMarkResolved", e.target.checked)
              }
            />
            confirm Apply
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showBasePanel}
              onChange={(e) => toggleSetting("showBasePanel", e.target.checked)}
            />
            base pane
          </label>
          <span className="opacity-40">|</span>
          <button
            type="button"
            className="px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--toolbar-hover)]"
            onClick={() => {
              host.clearPosted();
              refresh();
            }}
          >
            Clear log
          </button>
        </div>
      )}
      {expanded && posted.length > 0 && (
        <pre className="mx-3 mb-2 max-h-24 overflow-auto rounded bg-[var(--vscode-editor-background)] p-2 text-[10px] opacity-90">
          {posted
            .slice(-8)
            .map((m) => JSON.stringify(m))
            .join("\n")}
        </pre>
      )}
    </div>
  );
}
