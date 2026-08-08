import { beforeEach, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { createFakeMonaco } from "../../test/fakeMonaco";
import { useGitViewStore } from "../../stores/gitViewStore";
import { buildMergeDocument } from "../../../../src/core/mergeDocument";
import type { MergeDocument } from "../../../../src/core/types";
import {
  installMergeTestClient,
  mergeTestOutbound,
} from "../../hooks/merge/mergeClientContext";

const fakeMonaco = createFakeMonaco();

vi.mock("../../components/merge/monacoSetup", () => ({
  loadMonaco: vi.fn(() => Promise.resolve(fakeMonaco)),
  getMonacoIfLoaded: vi.fn(() => fakeMonaco),
}));

export const posted = mergeTestOutbound;

beforeEach(() => {
  installMergeTestClient("test-repo");
  HTMLElement.prototype.scrollTo =
    HTMLElement.prototype.scrollTo ??
    function () {
      /* jsdom */
    };
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: () => {},
    getState: () => null,
    setState: () => {},
  });
  useGitViewStore.setState({
    activeDocument: null,
    activeBlockId: null,
    screen: "mergeResolver",
    showBase: false,
    confirmBeforeMarkResolved: false,
  });
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  useGitViewStore.getState().setConfirmDiscard((action) => {
    posted.push({
      type: "merge.confirmDiscard",
      payload: { repoId: "test-repo", action },
    });
  });
});

afterEach(() => {
  useGitViewStore.getState().setConfirmDiscard(null);
  cleanup();
});

export function loadDoc(base: string, ours: string, theirs: string): MergeDocument {
  const doc = buildMergeDocument({
    repoRoot: "/r",
    relativePath: "src/app.ts",
    absolutePath: "/r/src/app.ts",
    base,
    ours,
    theirs,
    worktree: ours,
  });
  useGitViewStore.setState({ activeDocument: doc });
  return doc;
}