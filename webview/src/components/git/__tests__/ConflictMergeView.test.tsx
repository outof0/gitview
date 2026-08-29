// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProtocolClient } from "../../../protocol/client";
import { useGitViewStore } from "../../../stores/gitViewStore";
import { createFakeMonaco } from "../../../test/fakeMonaco";
import { installMergeTestClient } from "../../../hooks/merge/mergeClientContext";
import { makeTestDoc } from "../../../__tests__/gitViewStore.testHelpers";
import { ConflictMergeView } from "../ConflictMergeView";

const fakeMonaco = createFakeMonaco();

vi.mock("../../merge/monacoSetup", () => ({
  loadMonaco: vi.fn(() => Promise.resolve(fakeMonaco)),
  getMonacoIfLoaded: vi.fn(() => fakeMonaco),
}));

function makeClient(): ProtocolClient {
  return {
    openMergeFile: vi.fn().mockResolvedValue(undefined),
  } as unknown as ProtocolClient;
}

function makeMagicMergeDoc() {
  return makeTestDoc(
    "This is a simple conflict that can be resolved.\n",
    "Below is a simple conflict that can be resolved.\n",
    "This is a simple conflict that can be resolved automatically.\n",
  );
}

beforeEach(() => {
  installMergeTestClient("repo-1");
  HTMLElement.prototype.scrollTo =
    HTMLElement.prototype.scrollTo ??
    function () {
      /* jsdom */
    };
  useGitViewStore.setState({
    activeDocument: null,
    activeBlockId: null,
    undoStack: [],
    redoStack: [],
    showBase: false,
    showConflictsNavigation: false,
    annotateOnOpen: null,
    statusMessage: null,
  });
});

afterEach(() => cleanup());

describe("ConflictMergeView Magic Merge", () => {
  it("surfaces a compact action and resolves the eligible conflict", () => {
    const doc = makeMagicMergeDoc();
    render(
      <ConflictMergeView
        client={makeClient()}
        repoId="repo-1"
        filePath={doc.relativePath}
      />,
    );
    act(() => useGitViewStore.getState().setActiveDocument(doc));

    const button = screen.getByRole("button", {
      name: "Magic Merge: Resolve simple conflicts",
    });
    expect(button.getAttribute("title")).toBe(
      "Magic Merge — Resolve simple conflicts",
    );
    fireEvent.click(button);

    const conflict = useGitViewStore
      .getState()
      .activeDocument?.blocks.find((block) => block.kind === "conflict");
    expect(conflict?.status).toBe("resolved");
    expect(conflict?.resultText).toBe(
      "Below is a simple conflict that can be resolved automatically.",
    );
    expect(screen.queryByTestId("conflict-merge-magic")).toBeNull();
  });

  it("stays hidden when the conflict edits overlap", () => {
    const doc = makeTestDoc(
      "The color is blue.\n",
      "The color is red.\n",
      "The color is green.\n",
    );
    render(
      <ConflictMergeView
        client={makeClient()}
        repoId="repo-1"
        filePath={doc.relativePath}
      />,
    );
    act(() => useGitViewStore.getState().setActiveDocument(doc));

    expect(screen.queryByTestId("conflict-merge-magic")).toBeNull();
  });
});
