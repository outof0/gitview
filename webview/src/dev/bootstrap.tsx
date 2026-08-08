import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/globals.css";
import { GitMenuVisualFixture } from "./GitMenuVisualFixture";
import { PlaygroundShell } from "./PlaygroundShell";
import {
  createMockHost,
  installPlaygroundVsCodeApi,
} from "./mockHost";

function applyThemeClass(theme: "dark" | "light" | "high-contrast"): void {
  document.body.classList.remove(
    "vscode-dark",
    "vscode-light",
    "vscode-high-contrast",
  );
  document.body.classList.add(
    theme === "light"
      ? "vscode-light"
      : theme === "high-contrast"
        ? "vscode-high-contrast"
        : "vscode-dark",
  );
}

const params = new URLSearchParams(window.location.search);
const appParam = params.get("app");
const app =
  appParam === "gitHistory"
    ? ("gitHistory" as const)
    : appParam === "gitMenu"
      ? ("gitMenu" as const)
      : ("merge" as const);
const theme = (params.get("theme") as "dark" | "light" | null) ?? "dark";

applyThemeClass(theme);

const host = createMockHost();
installPlaygroundVsCodeApi(host);
window.__gitviewPlayground = host;
window.__GITVIEW_BOOTSTRAP__ = { repoId: "playground-repo" };

const root = (
  app === "gitMenu" ? (
    <GitMenuVisualFixture />
  ) : (
    <PlaygroundShell host={host} app={app} />
  )
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{root}</React.StrictMode>,
);