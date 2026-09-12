import { describe, it, expect, vi, beforeEach } from "vitest";

const { createOrReveal } = vi.hoisted(() => ({
  createOrReveal: vi.fn(async () => undefined),
}));

vi.mock("../GitViewPanel", () => ({
  createOrReveal,
}));

import { openGitView } from "../openGitView";

const context = {
  extensionUri: { path: "/ext" },
  subscriptions: [],
} as unknown as import("vscode").ExtensionContext;

const gitView = {} as unknown as import("../../activation").GitViewContext;

const resource = {
  fsPath: "/ws/src/app.ts",
} as unknown as import("vscode").Uri;

describe("openGitView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the merge resolver panel with the resource and options", async () => {
    await openGitView(context, gitView, resource, { openConflictFile: true });

    expect(createOrReveal).toHaveBeenCalledWith(context, gitView, resource, {
      openConflictFile: true,
    });
  });

  it("passes the omitted arguments through untouched", async () => {
    await openGitView(context, gitView);

    expect(createOrReveal).toHaveBeenCalledWith(
      context,
      gitView,
      undefined,
      undefined,
    );
  });
});
