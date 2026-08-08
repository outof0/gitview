// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  isGitDiffViewModeSetting,
  isGitWhitespacePolicy,
  normalizeGitWorkspaceSettings,
} from "@gitview/shared/types/gitWorkspaceSettings";
import { useGitWorkspaceStore } from "../../../stores/gitWorkspaceStore";

describe("settings diff/merge", () => {
  afterEach(() => cleanup());

  it("normalizes whitespace and diff view settings from host payload", () => {
    const settings = normalizeGitWorkspaceSettings({
      updateStrategy: "rebase",
      whitespacePolicy: "ignoreWhitespaces",
      diffViewMode: "unified",
    });
    expect(isGitWhitespacePolicy(settings.whitespacePolicy)).toBe(true);
    expect(isGitDiffViewModeSetting(settings.diffViewMode)).toBe(true);
    expect(settings.whitespacePolicy).toBe("ignoreWhitespaces");
    expect(settings.diffViewMode).toBe("unified");
  });

  it("applies host diff settings into git workspace store", () => {
    useGitWorkspaceStore.getState().setWhitespacePolicy("doNotIgnore");
    useGitWorkspaceStore.getState().setDiffViewMode("side_by_side");
    useGitWorkspaceStore.getState().setWhitespacePolicy("trimWhitespaces");
    useGitWorkspaceStore.getState().setDiffViewMode("unified");
    const state = useGitWorkspaceStore.getState();
    expect(state.whitespacePolicy).toBe("trimWhitespaces");
    expect(state.diffViewMode).toBe("unified");
  });
});