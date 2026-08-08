// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildMergeDocument } from "../../../../../src/core/mergeDocument";
import { useGitViewStore } from "../../../stores/gitViewStore";
import { MergeContextMenu } from "../MergeContextMenu";

function loadDoc() {
  const doc = buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "src/app.ts",
    absolutePath: "/repo/src/app.ts",
    base: "a\nb\nc\n",
    ours: "a\nours\nc\n",
    theirs: "a\ntheirs\nc\n",
    worktree: "a\nours\nc\n",
    now: 1,
  });
  useGitViewStore.setState({ activeDocument: doc });
  return doc;
}

describe("MergeContextMenu", () => {
  afterEach(() => {
    cleanup();
    useGitViewStore.setState({ activeDocument: null });
  });

  beforeEach(() => {
    useGitViewStore.setState({ activeDocument: null });
  });

  it("shows full resolve actions for an unresolved conflict", () => {
    const doc = loadDoc();
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;

    render(
      <MergeContextMenu
        menu={{
          visible: true,
          type: "editor",
          x: 10,
          y: 10,
          side: "center",
          blockId: conflict.id,
        }}
        showBlameLeft={false}
        showBlameRight={false}
        onClose={() => {}}
        onToggleAnnotateBlame={() => {}}
        onAnnotateFromMenu={() => {}}
        onShowHistory={() => {}}
        onGitAction={() => {}}
      />,
    );

    expect(screen.getByTestId("merge-context-accept-local")).toBeTruthy();
    expect(screen.getByTestId("merge-context-accept-repository")).toBeTruthy();
    expect(screen.getByText("Accept Left Side")).toBeTruthy();
    expect(screen.getByText("Accept Right Side")).toBeTruthy();
  });

  it("shows reset-only actions for a resolved conflict", () => {
    const doc = loadDoc();
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    useGitViewStore.getState().applyAcceptOurs(conflict.id);

    render(
      <MergeContextMenu
        menu={{
          visible: true,
          type: "editor",
          x: 10,
          y: 10,
          side: "center",
          blockId: conflict.id,
        }}
        showBlameLeft={false}
        showBlameRight={false}
        onClose={() => {}}
        onToggleAnnotateBlame={() => {}}
        onAnnotateFromMenu={() => {}}
        onShowHistory={() => {}}
        onGitAction={() => {}}
      />,
    );

    expect(screen.getByTestId("merge-context-reset")).toBeTruthy();
    expect(screen.queryByTestId("merge-context-accept-local")).toBeNull();
    expect(screen.queryByTestId("merge-context-resolve-local")).toBeNull();
  });
});
