import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMocks = vi.hoisted(() => ({
  showErrorMessage: vi.fn(async () => undefined),
}));

vi.mock("vscode", () => ({
  window: {
    showErrorMessage: vscodeMocks.showErrorMessage,
  },
  workspace: {
    getWorkspaceFolder: vi.fn(() => undefined),
    workspaceFolders: [],
  },
  Uri: {
    revive: vi.fn(() => undefined),
    file: vi.fn(),
    parse: vi.fn(),
  },
}));

import { registerGitMenuCommand } from "../registerGitMenuCommands";

describe("registerGitMenuCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the VS Code command pending until its handler completes", async () => {
    let complete: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const handler = vi.fn(() => pending);
    let command: ((...args: unknown[]) => unknown) | undefined;

    registerGitMenuCommand(
      (_id, registered) => {
        command = registered;
        return { dispose: vi.fn() };
      },
      "gitView.test",
      handler,
    );

    const result = Promise.resolve(command?.());
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith(undefined, undefined);
    expect(settled).toBe(false);

    complete?.();
    await result;
    expect(settled).toBe(true);
  });

  it("reports handler failures after awaiting them", async () => {
    let command: ((...args: unknown[]) => unknown) | undefined;
    registerGitMenuCommand(
      (_id, registered) => {
        command = registered;
        return { dispose: vi.fn() };
      },
      "gitView.test",
      async () => {
        throw new Error("command failed");
      },
    );

    await command?.();

    expect(vscodeMocks.showErrorMessage).toHaveBeenCalledWith("command failed");
  });
});
