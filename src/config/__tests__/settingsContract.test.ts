import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_GIT_WORKSPACE_SETTINGS } from "../../shared/types/gitWorkspaceSettings";
import { MERGE_ENGINES } from "../../core/mergeEngines";
import { DEFAULT_GITVIEW_SETTINGS, MERGE_ENGINE_IDS } from "../../types/settings";

type ConfigurationProperty = {
  default?: unknown;
  enum?: unknown[];
  scope?: string;
};

function configurationProperties(): Record<string, ConfigurationProperty> {
  const manifestPath = path.join(process.cwd(), "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    contributes?: {
      configuration?: {
        properties?: Record<string, ConfigurationProperty>;
      };
    };
  };
  return manifest.contributes?.configuration?.properties ?? {};
}

describe("VS Code settings contract", () => {
  const properties = configurationProperties();

  it("keeps merge settings defaults aligned with the extension manifest", () => {
    for (const [key, value] of Object.entries(DEFAULT_GITVIEW_SETTINGS)) {
      expect(properties[`gitView.${key}`]?.default, key).toEqual(value);
    }
  });

  it("offers exactly the merge engines that are implemented", () => {
    expect(properties["gitView.mergeEngine"]?.enum).toEqual([
      ...MERGE_ENGINE_IDS,
    ]);
    expect(Object.keys(MERGE_ENGINES).sort()).toEqual([...MERGE_ENGINE_IDS].sort());
  });

  it("keeps Git workspace settings defaults aligned with the manifest", () => {
    const manifestKeys: Record<keyof typeof DEFAULT_GIT_WORKSPACE_SETTINGS, string> = {
      mode: "mode",
      updateStrategy: "updateStrategy",
      whitespacePolicy: "whitespacePolicy",
      diffViewMode: "gitDiffViewMode",
      synchronousBranchControl: "synchronousBranchControl",
      graphSort: "graphSort",
      highlightCurrentBranch: "highlightCurrentBranch",
      compactLogRows: "compactLogRows",
      issueTrackerBaseUrl: "issueTrackerBaseUrl",
    };

    for (const [key, manifestKey] of Object.entries(manifestKeys) as Array<
      [keyof typeof DEFAULT_GIT_WORKSPACE_SETTINGS, string]
    >) {
      expect(properties[`gitView.${manifestKey}`]?.default, manifestKey).toEqual(
        DEFAULT_GIT_WORKSPACE_SETTINGS[key],
      );
    }
  });

  it("declares every infrastructure setting read by host adapters", () => {
    const expectedDefaults: Record<string, unknown> = {
      gitExecutablePath: null,
      logLevel: "info",
      crlfWarnings: true,
      protectedBranchPatterns: [
        "main",
        "master",
        "release/*",
        "hotfix/*",
        "production",
      ],
      confirmDestructiveActions: true,
      gpgSigningDefault: false,
      githubReviewToken: "",
      githubApiBaseUrl: "https://api.github.com",
      gitlabReviewToken: "",
      gitlabApiBaseUrl: "https://gitlab.com/api/v4",
      commitCheckTodo: false,
      commitCheckAnalyze: false,
      commitCheckReformat: false,
      commitCheckOptimizeImports: false,
    };

    for (const [key, value] of Object.entries(expectedDefaults)) {
      expect(properties[`gitView.${key}`]?.default, key).toEqual(value);
    }
  });

  it("keeps review credentials and API destinations out of workspace settings", () => {
    for (const key of [
      "githubReviewToken",
      "githubApiBaseUrl",
      "gitlabReviewToken",
      "gitlabApiBaseUrl",
    ]) {
      expect(properties[`gitView.${key}`]?.scope, key).toBe("machine");
    }
  });
});
