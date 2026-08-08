import { beforeEach, describe, expect, it, vi } from "vitest";
import * as path from "node:path";
import { createCommitCheckService } from "../commitCheckService";

const vscodeMock = vi.hoisted(() => {
  const workspaceEditSet = vi.fn();

  class WorkspaceEdit {
    set = workspaceEditSet;
  }

  const uriFor = (fsPath: string) => ({
    fsPath,
    toString: () => `file://${fsPath}`,
  });

  return {
    workspaceEditSet,
    Uri: {
      file: vi.fn(uriFor),
    },
    WorkspaceEdit,
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
    },
    commands: {
      executeCommand: vi.fn(),
    },
    languages: {
      getDiagnostics: vi.fn(),
    },
    window: {
      showTextDocument: vi.fn(),
    },
    workspace: {
      applyEdit: vi.fn(),
      asRelativePath: vi.fn((uri: { fsPath: string }) =>
        uri.fsPath.replace("/repo/", ""),
      ),
      fs: {
        readFile: vi.fn(),
      },
      getConfiguration: vi.fn(),
      openTextDocument: vi.fn(),
      textDocuments: [] as Array<{
        uri: { toString: () => string };
        isDirty: boolean;
        save: ReturnType<typeof vi.fn>;
      }>,
    },
  };
});

vi.mock("vscode", () => vscodeMock);

describe("createCommitCheckService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vscodeMock.workspace.textDocuments.length = 0;
    vscodeMock.workspace.getConfiguration.mockReturnValue({
      get: vi.fn(() => false),
    });
    vscodeMock.workspace.applyEdit.mockResolvedValue(true);
    vscodeMock.languages.getDiagnostics.mockReturnValue([]);
  });

  it("enables settings-backed checks and filters requested kinds", () => {
    const service = createCommitCheckService({
      getSettings: () => ({
        analyze: true,
        optimizeImports: true,
        reformat: false,
        todo: true,
      }),
    });

    expect(service.enabledKinds()).toEqual(["todo", "analyze", "optimizeImports"]);
    expect(service.enabledKinds(["analyze", "reformat"])).toEqual(["analyze"]);
  });

  it("reports TODO markers and only error diagnostics for selected paths", async () => {
    const service = createCommitCheckService({
      getSettings: () => ({
        analyze: true,
        optimizeImports: false,
        reformat: false,
        todo: true,
      }),
    });
    vscodeMock.workspace.fs.readFile.mockImplementation(
      async (uri: { fsPath: string }) => {
        if (uri.fsPath.endsWith("missing.ts")) {
          throw new Error("gone");
        }
        return Buffer.from(
          uri.fsPath.endsWith("a.ts")
            ? "const ok = true;\n// FIXME: tighten before commit\n"
            : "const ok = true;\n",
        );
      },
    );
    vscodeMock.languages.getDiagnostics.mockReturnValue([
      [
        { fsPath: "/repo/src/a.ts", toString: () => "file:///repo/src/a.ts" },
        [
          {
            message: "Type mismatch",
            range: { start: { line: 4 } },
            severity: vscodeMock.DiagnosticSeverity.Error,
          },
          {
            message: "Style warning",
            range: { start: { line: 5 } },
            severity: vscodeMock.DiagnosticSeverity.Warning,
          },
        ],
      ],
      [
        { fsPath: "/repo/src/other.ts", toString: () => "file:///repo/src/other.ts" },
        [
          {
            message: "Ignored error",
            range: { start: { line: 0 } },
            severity: vscodeMock.DiagnosticSeverity.Error,
          },
        ],
      ],
    ]);

    const result = await service.runChecks("/repo", [
      "src/a.ts",
      "src/b.ts",
      "src/missing.ts",
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        kind: "todo",
        severity: "warning",
        message: "src/a.ts:2 contains FIXME",
        paths: ["src/a.ts"],
      },
      {
        kind: "analyze",
        severity: "error",
        message: "src/a.ts:5 Type mismatch",
        paths: ["src/a.ts"],
      },
    ]);
  });

  it("applies format and import fixes when requested", async () => {
    const service = createCommitCheckService({
      getSettings: () => ({
        analyze: false,
        optimizeImports: true,
        reformat: true,
        todo: false,
      }),
    });
    const targetFsPath = path.join("/repo", "src/a.ts");
    const savedDocument = {
      isDirty: true,
      save: vi.fn().mockResolvedValue(true),
      uri: { toString: () => `file://${targetFsPath}` },
    };
    vscodeMock.workspace.openTextDocument.mockResolvedValue(savedDocument);
    vscodeMock.workspace.textDocuments.push(savedDocument);
    vscodeMock.commands.executeCommand
      .mockResolvedValueOnce([{ newText: "formatted" }])
      .mockResolvedValueOnce(true);

    const result = await service.runChecks(
      "/repo",
      ["src/a.ts"],
      { applyFixes: true },
    );

    expect(result).toEqual({ ok: true, issues: [] });
    expect(vscodeMock.workspaceEditSet).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: targetFsPath }),
      [{ newText: "formatted" }],
    );
    expect(vscodeMock.workspace.applyEdit).toHaveBeenCalledTimes(1);
    expect(savedDocument.save).toHaveBeenCalledTimes(2);
    expect(vscodeMock.window.showTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: targetFsPath }),
      { preview: false, preserveFocus: true },
    );
  });

  it("returns warnings when auto-fix providers fail or are unsupported", async () => {
    const service = createCommitCheckService({
      getSettings: () => ({
        analyze: false,
        optimizeImports: true,
        reformat: true,
        todo: false,
      }),
    });
    vscodeMock.workspace.openTextDocument.mockRejectedValueOnce(
      new Error("formatter unavailable"),
    );
    vscodeMock.window.showTextDocument.mockResolvedValue({});
    vscodeMock.commands.executeCommand.mockResolvedValueOnce(false);

    const result = await service.runChecks(
      "/repo",
      ["src/a.ts"],
      { applyFixes: true },
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      {
        kind: "reformat",
        severity: "warning",
        message: "Could not reformat src/a.ts: formatter unavailable",
        paths: ["src/a.ts"],
      },
      {
        kind: "optimizeImports",
        severity: "warning",
        message: "Optimize imports not supported for src/a.ts",
        paths: ["src/a.ts"],
      },
    ]);
  });
});
