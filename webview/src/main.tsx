import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GitBlameApp } from "./apps/GitBlameApp";
import { GitCreateBranchApp } from "./apps/GitCreateBranchApp";
import { GitCommitPanelApp } from "./apps/GitCommitPanelApp";
import { GitBranchesPanelApp } from "./apps/GitBranchesPanelApp";
import { GitDiffApp } from "./apps/GitDiffApp";
import { GitWorkspaceApp } from "./apps/GitWorkspaceApp";
import { BlameVisualFixture } from "./dev/BlameVisualFixture";
import { GitDiffVisualFixture } from "./dev/GitDiffVisualFixture";
import { GitMenuVisualFixture } from "./dev/GitMenuVisualFixture";
import { HistoryVisualFixture } from "./dev/HistoryVisualFixture";
import {
  installGitWorkspaceVisualHost,
  isGitWorkspaceVisualStateId,
} from "./dev/gitWorkspaceVisualFixtures";
import { GitHistoryApp } from "./GitHistoryApp";
import "./styles/globals.css";
import "./types/gitviewBootstrap";
import { applyWebviewTheme, detectWebviewThemeKind } from "./lib/webviewTheme";
import type { ThemeKind } from "./hooks/useTheme";

declare global {
  interface Window {
    __GITVIEW_APP__?:
      | "merge"
      | "gitHistory"
      | "gitWorkspace"
      | "gitDiff"
      | "gitBlame"
      | "gitMenu"
      | "gitCreateBranch"
      | "gitCommit"
      | "gitBranches"
      | "gitWorkspaceVisual"
      | "gitHistoryVisual"
      | "gitBlameVisual"
      | "gitDiffVisual";
  }
}

const searchParams = new URLSearchParams(window.location.search);
const appMode = window.__GITVIEW_APP__ ?? searchParams.get("app") ?? "merge";
const requestedTheme = searchParams.get("theme");
const playgroundTheme: ThemeKind =
  requestedTheme === "light"
    ? "light"
    : requestedTheme === "high-contrast-light"
      ? "high-contrast-light"
      : requestedTheme === "high-contrast"
        ? "high-contrast"
        : detectWebviewThemeKind();
const isPlaygroundSurface =
  appMode.endsWith("Visual") || Boolean(searchParams.get("theme"));
applyWebviewTheme(playgroundTheme, { playgroundVars: isPlaygroundSurface });

if (appMode === "gitWorkspaceVisual") {
  const requestedState = searchParams.get("state");
  installGitWorkspaceVisualHost(
    isGitWorkspaceVisualStateId(requestedState) ? requestedState : "clean",
  );
}

const RootApp =
  appMode === "gitWorkspace" || appMode === "gitWorkspaceVisual"
    ? GitWorkspaceApp
    : appMode === "gitHistory"
      ? GitHistoryApp
      : appMode === "gitHistoryVisual"
        ? HistoryVisualFixture
        : appMode === "gitDiff"
          ? GitDiffApp
          : appMode === "gitDiffVisual"
            ? GitDiffVisualFixture
            : appMode === "gitBlame"
              ? GitBlameApp
              : appMode === "gitCreateBranch"
                ? GitCreateBranchApp
              : appMode === "gitCommit"
                ? GitCommitPanelApp
              : appMode === "gitBranches"
                ? GitBranchesPanelApp
              : appMode === "gitBlameVisual"
                ? BlameVisualFixture
                : appMode === "gitMenu"
                  ? GitMenuVisualFixture
                  : App;

const maybeRoot = document.getElementById("root");
if (!maybeRoot) {
  throw new Error("GitView webview root element is missing.");
}
const rootEl: HTMLElement = maybeRoot;

function renderBootError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const errorEl = document.createElement("div");
  errorEl.style.cssText =
    "padding:16px;font:13px/1.5 var(--nx-font-app);color:var(--nx-danger-fg)";
  errorEl.textContent = `GitView failed to start: ${message}`;
  rootEl.replaceChildren(errorEl);
}

try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <RootApp />
    </React.StrictMode>,
  );
} catch (err) {
  renderBootError(err);
}
