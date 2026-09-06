import { describe, it, expect, vi } from "vitest";
import type * as vscodeType from "vscode";

// Minimal structural stand-ins for the VS Code types this unit touches. Keeps
// the test strict-lint clean (no `any`) while still exercising the real code.
type FakeUri = { __uri: true; path: string; toString(): string };

// Stub the 'vscode' module BEFORE importing the unit under test.
vi.mock("vscode", () => {
  const joinPath = (base: FakeUri, ...parts: string[]): FakeUri => ({
    __uri: true,
    path: [base.path, ...parts].join("/"),
    toString() {
      return `file://${this.path}`;
    },
  });
  return {
    Uri: { joinPath },
    workspace: {
      fs: {
        readFile: vi.fn((): Promise<Uint8Array> => {
          const html = `<!DOCTYPE html>
<html><head>
<title>GitView</title>
<script type="module" crossorigin src="/assets/index.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index.css">
</head><body><div id="root"></div></body></html>`;
          return Promise.resolve(new TextEncoder().encode(html));
        }),
      },
    },
  };
});

import { getWebviewHtml } from "../getWebviewHtml";

function makeWebview(): vscodeType.Webview {
  const webview = {
    cspSource: "vscode-webview://x",
    asWebviewUri: (uri: FakeUri) => ({
      toString: () =>
        `https://webview.test${uri.path.replace(/^.*\/webview\/dist/, "")}`,
    }),
  };
  return webview as unknown as vscodeType.Webview;
}

const extUri = { __uri: true, path: "/ext" } as unknown as vscodeType.Uri;

describe("getWebviewHtml", () => {
  it("includes BOTH the JS and the CSS asset (CSS was the bug)", async () => {
    const html = await getWebviewHtml(makeWebview(), extUri);
    expect(html).toMatch(/index\.js/);
    expect(html).toMatch(/index\.css/);
  });

  it("rewrites root-absolute asset paths to webview URIs", async () => {
    const html = await getWebviewHtml(makeWebview(), extUri);
    expect(html).not.toMatch(/="\/assets\//); // no leftover root-absolute
    expect(html).toMatch(/https:\/\/webview\.test\/assets\/index\.js/);
    expect(html).toMatch(/https:\/\/webview\.test\/assets\/index\.css/);
  });

  it("cache-busts every local asset and replaces a stuck loading placeholder", async () => {
    const html = await getWebviewHtml(makeWebview(), extUri);
    const jsVersion = html.match(/index\.js\?v=([^"&]+)/)?.[1];
    const cssVersion = html.match(/index\.css\?v=([^"&]+)/)?.[1];
    expect(jsVersion).toBeTruthy();
    expect(cssVersion).toBe(jsVersion);
    expect(html).toContain("JavaScript bundle did not start");
  });

  it("reports a clear build hint when webview dist is missing", async () => {
    const vscode = await import("vscode");
    vi.mocked(vscode.workspace.fs.readFile).mockRejectedValueOnce(
      new Error("ENOENT"),
    );
    await expect(getWebviewHtml(makeWebview(), extUri)).rejects.toThrow(
      /pnpm run build/i,
    );
  });

  it("strips crossorigin and modulepreload (VS Code webview cannot load them)", async () => {
    const html = await getWebviewHtml(makeWebview(), extUri);
    expect(html).not.toMatch(/crossorigin/);
    expect(html).not.toMatch(/modulepreload/);
  });

  it("adds a nonce to script tags and a matching CSP", async () => {
    const html = await getWebviewHtml(makeWebview(), extUri);
    const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];
    expect(scriptNonce).toBeTruthy();
    expect(html).toMatch(
      new RegExp(
        `script-src 'nonce-${scriptNonce ?? ""}' vscode-webview://x`,
      ),
    );
    expect(html).toMatch(/Content-Security-Policy/);
    expect(html).toMatch(
      new RegExp(
        `<meta property="csp-nonce" nonce="${scriptNonce ?? ""}"`,
      ),
    );
  });

  it("replaces an existing CSP meta tag instead of duplicating it", async () => {
    const vscode = await import("vscode");
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValueOnce(
      new TextEncoder().encode(
        `<!DOCTYPE html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'">
<script type="module" src="/assets/index.js"></script>
</head><body><div id="root"></div></body></html>`,
      ),
    );
    const html = await getWebviewHtml(makeWebview(), extUri);
    expect(html.match(/Content-Security-Policy/g)?.length).toBe(1);
    expect(html).toMatch(/script-src 'nonce-/);
  });

  it("boots the requested app instead of the merge default", async () => {
    const html = await getWebviewHtml(makeWebview(), extUri, {
      app: "gitHistory",
    });
    expect(html).toMatch(/window\.__GITVIEW_APP__="gitHistory"/);
  });
});
