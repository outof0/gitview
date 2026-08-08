import { vi } from "vitest";

// Keep Git-backed tests byte-stable when Windows runners enable autocrlf globally.
process.env.GIT_CONFIG_COUNT = "1";
process.env.GIT_CONFIG_KEY_0 = "core.autocrlf";
process.env.GIT_CONFIG_VALUE_0 = "false";

// jsdom does not implement document.queryCommandSupported; Monaco's clipboard
// contrib loads at import time and throws without this polyfill.
if (
  typeof document !== "undefined" &&
  typeof document.queryCommandSupported !== "function"
) {
  document.queryCommandSupported = () => false;
}

// Host handler unit tests import modules that read VS Code workspace settings.
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string) => {
        const defaults: Record<string, unknown> = {
          updateStrategy: "merge",
          whitespacePolicy: "doNotIgnore",
          gitDiffViewMode: "side_by_side",
          synchronousBranchControl: true,
          graphSort: "date",
          highlightCurrentBranch: true,
          compactLogRows: false,
          issueTrackerBaseUrl: null,
        };
        return defaults[key];
      },
    }),
  },
}));
