import * as vscode from "vscode";

const GITHUB_SECRET_KEY = "gitView.github.reviewToken";
const GITLAB_SECRET_KEY = "gitView.gitlab.reviewToken";

export type ReviewProviderId = "github" | "gitlab";

export type ReviewAuthService = {
  getAccessToken: (providerId: string) => Promise<string | null>;
  storeAccessToken: (
    providerId: ReviewProviderId,
    token: string,
  ) => Promise<void>;
  clearAccessToken: (providerId: ReviewProviderId) => Promise<void>;
};

function secretKey(providerId: ReviewProviderId): string {
  return providerId === "github" ? GITHUB_SECRET_KEY : GITLAB_SECRET_KEY;
}

function settingsKey(providerId: ReviewProviderId): string {
  return providerId === "github" ? "githubReviewToken" : "gitlabReviewToken";
}

async function clearLegacySetting(
  configuration: vscode.WorkspaceConfiguration,
  key: string,
): Promise<void> {
  const inspected = configuration.inspect<string>(key);
  if (!inspected) {
    return;
  }
  const targets: Array<[unknown, vscode.ConfigurationTarget]> = [
    [inspected.globalValue, vscode.ConfigurationTarget.Global],
    [inspected.workspaceValue, vscode.ConfigurationTarget.Workspace],
    [
      inspected.workspaceFolderValue,
      vscode.ConfigurationTarget.WorkspaceFolder,
    ],
  ];
  await Promise.allSettled(
    targets
      .filter(([value]) => value !== undefined)
      .map(([, target]) => configuration.update(key, undefined, target)),
  );
}

export function createReviewAuthService(
  secretStorage: vscode.SecretStorage,
): ReviewAuthService {
  return {
    async getAccessToken(providerId: string): Promise<string | null> {
      if (providerId !== "github" && providerId !== "gitlab") {
        return null;
      }
      const fromSecret = await secretStorage.get(secretKey(providerId));
      if (fromSecret?.trim()) {
        return fromSecret.trim();
      }
      const configuration = vscode.workspace.getConfiguration("gitView");
      const key = settingsKey(providerId);
      const configured = configuration.get<string>(key);
      const fromSettings = configured?.trim() || null;
      if (fromSettings) {
        try {
          await secretStorage.store(secretKey(providerId), fromSettings);
          await clearLegacySetting(configuration, key);
        } catch {
          return fromSettings;
        }
      }
      return fromSettings;
    },

    async storeAccessToken(
      providerId: ReviewProviderId,
      token: string,
    ): Promise<void> {
      const trimmed = token.trim();
      if (!trimmed) {
        throw new Error("Token must not be empty.");
      }
      await secretStorage.store(secretKey(providerId), trimmed);
    },

    async clearAccessToken(providerId: ReviewProviderId): Promise<void> {
      await secretStorage.delete(secretKey(providerId));
    },
  };
}

export async function promptAndStoreReviewToken(
  secrets: vscode.SecretStorage,
  providerId: ReviewProviderId,
): Promise<boolean> {
  const label = providerId === "github" ? "GitHub" : "GitLab";
  const token = await vscode.window.showInputBox({
    title: `GitView: Set ${label} Review Token`,
    prompt: `Personal access token for ${label} review integration (stored in VS Code Secret Storage)`,
    password: true,
    ignoreFocusOut: true,
    placeHolder: providerId === "github" ? "ghp_… / github_pat_…" : "glpat-…",
  });
  if (token === undefined) {
    return false;
  }
  const trimmed = token.trim();
  if (!trimmed) {
    void vscode.window.showWarningMessage(`${label} review token was empty; nothing stored.`);
    return false;
  }
  const auth = createReviewAuthService(secrets);
  await auth.storeAccessToken(providerId, trimmed);
  void vscode.window.showInformationMessage(
    `${label} review token saved to Secret Storage.`,
  );
  return true;
}
