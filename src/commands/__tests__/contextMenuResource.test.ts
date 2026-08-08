import { describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { coerceContextMenuResourceUri } from "../contextMenuResource";

vi.mock("vscode", () => ({
  window: {
    activeTextEditor: undefined,
  },
  Uri: {
    file: (p: string) => ({ scheme: "file", fsPath: p, path: p }),
    parse: (s: string) => ({ scheme: "file", fsPath: s.replace("file://", ""), path: s }),
    revive: (components: { scheme?: string; path?: string; fsPath?: string; external?: string }) => {
      if (components.external?.startsWith("file://")) {
        const path = components.external.replace("file://", "");
        return { scheme: "file", fsPath: path, path };
      }
      const path = components.fsPath ?? components.path ?? "";
      return { scheme: components.scheme ?? "file", fsPath: path, path };
    },
  },
}));

describe("coerceContextMenuResourceUri", () => {
  it("accepts vscode.Uri instances", () => {
    const uri = vscode.Uri.file("/repo/src/app.ts");
    expect(coerceContextMenuResourceUri(uri)?.fsPath).toBe("/repo/src/app.ts");
  });

  it("accepts serialized submenu resource objects", () => {
    expect(
      coerceContextMenuResourceUri({
        scheme: "file",
        path: "/repo/src/app.ts",
      })?.fsPath,
    ).toBe("/repo/src/app.ts");
  });

  it("accepts resource strings from menu args", () => {
    expect(coerceContextMenuResourceUri("file:///repo/src/app.ts")?.fsPath).toBe(
      "/repo/src/app.ts",
    );
  });

  it("ignores unresolved menu placeholder strings", () => {
    expect(coerceContextMenuResourceUri("${resource}")).toBeUndefined();
  });

  it("accepts VS Code IPC UriComponents with $mid", () => {
    expect(
      coerceContextMenuResourceUri({
        $mid: 1,
        scheme: "file",
        path: "/repo/src/app.ts",
      })?.fsPath,
    ).toBe("/repo/src/app.ts");
  });

  it("accepts external file URIs from submenu serialization", () => {
    expect(
      coerceContextMenuResourceUri({
        $mid: 1,
        scheme: "file",
        external: "file:///repo/README.md",
        path: "/repo/README.md",
      })?.fsPath,
    ).toBe("/repo/README.md");
  });

  it("unwraps resourceUri wrapper objects", () => {
    expect(
      coerceContextMenuResourceUri({
        resourceUri: { scheme: "file", fsPath: "/repo/README.md" },
      })?.fsPath,
    ).toBe("/repo/README.md");
  });

  it("does not fall back to the active editor when submenu args lack a resource", () => {
    (
      vscode.window as unknown as {
        activeTextEditor?: { document: { uri: vscode.Uri } };
      }
    ).activeTextEditor = {
      document: { uri: vscode.Uri.file("/repo/decoy.ts") },
    };

    try {
      expect(coerceContextMenuResourceUri()).toBeUndefined();
    } finally {
      (
        vscode.window as unknown as {
          activeTextEditor?: { document: { uri: vscode.Uri } };
        }
      ).activeTextEditor = undefined;
    }
  });
});
