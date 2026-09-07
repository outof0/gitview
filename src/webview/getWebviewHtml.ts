import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

// Build the webview HTML by reading the Vite-generated index.html and rewriting
// it for the webview sandbox: rewrite asset URLs via asWebviewUri, inject a
// strict CSP with a per-load nonce, and add that nonce to every script tag.
// Reading the generated HTML (instead of hardcoding asset filenames) keeps this
// correct when Vite adds CSS, vendor chunks, or hashes — agent does not have to
// keep filenames in sync.
export type WebviewAppMode =
  | "merge"
  | "gitHistory"
  | "gitWorkspace"
  | "gitSidebar"
  | "gitDiff"
  | "gitBlame"
  | "gitCreateBranch"
  | "gitCommit"
  | "gitBranches";

export async function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  opts?: { app?: WebviewAppMode },
): Promise<string> {
  const distUri = vscode.Uri.joinPath(extensionUri, "webview", "dist");
  const indexUri = vscode.Uri.joinPath(distUri, "index.html");

  let bytes: Uint8Array;
  try {
    bytes = await vscode.workspace.fs.readFile(indexUri);
  } catch {
    throw new Error(
      'GitView UI assets are missing. Run "pnpm run build" in the extension folder, then reload the window.',
    );
  }
  let html = new TextDecoder("utf-8").decode(bytes);
  const nonce = makeNonce();

  // Vite emits crossorigin + modulepreload; VS Code webviews load assets from
  // vscode-resource:// URIs and treat crossorigin module scripts as CORS requests
  // that never execute — React never mounts and the panel stays blank.
  html = html.replace(/\s+crossorigin(?:="[^"]*")?/g, "");
  html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, "");

  // Rewrite asset refs ("/assets/..." or "./assets/...") to webview URIs.
  html = html.replace(
    /(href|src)="(\.?\/[^"]+)"/g,
    (_m, attr: string, p: string) => {
      const assetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(distUri, p.replace(/^\.?\//, "")),
      );
      return `${attr}="${assetUri.toString()}?v=${nonce}"`;
    },
  );

  // Add nonce to all script tags (Vite emits modules; keep type as-is).
  html = html.replace(/<script\b/g, `<script nonce="${nonce}"`);

  // img-src: extension assets only (no remote images in the webview UI).
  // style-src: 'unsafe-inline' required for Tailwind utility classes and Monaco
  // editor theming injected at runtime.
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    // Vite code-splits Monaco into lazy chunks; they load without a nonce but
    // from vscode-resource:// URIs that match webview.cspSource.
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    `worker-src ${webview.cspSource} blob:`,
  ].join("; ");
  const cspTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

  // Insert (or replace) the CSP meta tag inside <head>.
  if (/http-equiv="Content-Security-Policy"/.test(html)) {
    html = html.replace(
      /<meta http-equiv="Content-Security-Policy"[^>]*>/,
      cspTag,
    );
  } else {
    html = html.replace(/<head>/, `<head>\n  ${cspTag}`);
  }

  // Vite runtime preloads read this meta when injecting link/script tags.
  const nonceMeta = `<meta property="csp-nonce" nonce="${nonce}" content="${nonce}">`;

  const app = opts?.app ?? "merge";
  const bootstrap = `<script nonce="${nonce}">window.__GITVIEW_APP__="${app}";(function(){function fail(message){var root=document.getElementById("root");if(root&&root.textContent&&root.textContent.indexOf("Loading GitView")!==-1){root.textContent="GitView failed to start: "+message;}}window.addEventListener("error",function(event){fail(event.message||"JavaScript bundle could not be loaded.");});window.addEventListener("unhandledrejection",function(event){var reason=event.reason;fail(reason&&reason.message?reason.message:String(reason||"Unknown startup error."));});setTimeout(function(){fail("JavaScript bundle did not start. Reload the VS Code window and reopen GitView.");},8000);}());</script>`;
  html = html.replace("</head>", `  ${nonceMeta}\n  ${bootstrap}\n</head>`);

  return html;
}

function makeNonce(): string {
  return randomBytes(24).toString("base64url");
}
