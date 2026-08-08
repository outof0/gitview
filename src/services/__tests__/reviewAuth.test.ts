import type * as vscode from "vscode";
import { beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  get: vi.fn(),
  inspect: vi.fn(),
  update: vi.fn(),
}));

vi.mock("vscode", () => ({
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
  workspace: {
    getConfiguration: () => configuration,
  },
}));

import { createReviewAuthService } from "../review/reviewAuth";

function secretStorage(options: { existing?: string; storeError?: Error } = {}) {
  return {
    get: vi.fn().mockResolvedValue(options.existing),
    store: options.storeError
      ? vi.fn().mockRejectedValue(options.storeError)
      : vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    onDidChange: vi.fn(),
  } as unknown as vscode.SecretStorage;
}

describe("reviewAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configuration.get.mockReturnValue(undefined);
    configuration.inspect.mockReturnValue(undefined);
    configuration.update.mockResolvedValue(undefined);
  });

  it("prefers Secret Storage without reading plaintext settings", async () => {
    const secrets = secretStorage({ existing: " stored-token " });

    await expect(
      createReviewAuthService(secrets).getAccessToken("github"),
    ).resolves.toBe("stored-token");
    expect(configuration.get).not.toHaveBeenCalled();
  });

  it("moves a legacy token into Secret Storage and clears every settings target", async () => {
    const secrets = secretStorage();
    configuration.get.mockReturnValue(" legacy-token ");
    configuration.inspect.mockReturnValue({
      globalValue: "legacy-token",
      workspaceValue: "workspace-token",
      workspaceFolderValue: "folder-token",
    });

    await expect(
      createReviewAuthService(secrets).getAccessToken("github"),
    ).resolves.toBe("legacy-token");
    expect(secrets.store).toHaveBeenCalledWith(
      "gitView.github.reviewToken",
      "legacy-token",
    );
    expect(configuration.update.mock.calls).toEqual([
      ["githubReviewToken", undefined, 1],
      ["githubReviewToken", undefined, 2],
      ["githubReviewToken", undefined, 3],
    ]);
  });

  it("does not clear the legacy setting when Secret Storage rejects the token", async () => {
    const secrets = secretStorage({ storeError: new Error("unavailable") });
    configuration.get.mockReturnValue("legacy-token");
    configuration.inspect.mockReturnValue({ globalValue: "legacy-token" });

    await expect(
      createReviewAuthService(secrets).getAccessToken("gitlab"),
    ).resolves.toBe("legacy-token");
    expect(configuration.update).not.toHaveBeenCalled();
  });
});
