import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GitBlameApp } from "./apps/GitBlameApp";
import { GitDiffApp } from "./apps/GitDiffApp";
import { GitWorkspaceApp } from "./apps/GitWorkspaceApp";
import { BlameVisualFixture } from "./dev/BlameVisualFixture";
import { GitDiffVisualFixture } from "./dev/GitDiffVisualFixture";
import { GitMenuVisualFixture } from "./dev/GitMenuVisualFixture";
import { HistoryVisualFixture } from "./dev/HistoryVisualFixture";
import { GitHistoryApp } from "./GitHistoryApp";
import "./styles/globals.css";
import "./types/gitviewBootstrap";

declare global {
  interface Window {
    __GITVIEW_APP__?:
      | "merge"
      | "gitHistory"
      | "gitWorkspace"
      | "gitDiff"
      | "gitBlame"
      | "gitMenu"
      | "gitHistoryVisual"
      | "gitBlameVisual"
      | "gitDiffVisual";
  }
}

const appMode =
  window.__GITVIEW_APP__ ??
  new URLSearchParams(window.location.search).get("app") ??
  "merge";

const RootApp =
  appMode === "gitWorkspace" ? GitWorkspaceApp
  : appMode === "gitHistory" ? GitHistoryApp
  : appMode === "gitHistoryVisual" ? HistoryVisualFixture
  : appMode === "gitDiff" ? GitDiffApp
  : appMode === "gitDiffVisual" ? GitDiffVisualFixture
  : appMode === "gitBlame" ? GitBlameApp
  : appMode === "gitBlameVisual" ? BlameVisualFixture
  : appMode === "gitMenu" ? GitMenuVisualFixture
  : App;

const maybeRoot = document.getElementById("root");
if (!maybeRoot) {
  throw new Error("GitView webview root element is missing.");
}
const rootEl: HTMLElement = maybeRoot;

function renderBootError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  rootEl.innerHTML = `<div style="padding:16px;font:13px/1.5 var(--vscode-font-family,system-ui,sans-serif);color:var(--vscode-errorForeground,#f48771)">GitView failed to start: ${message}</div>`;
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
