// @vitest-environment jsdom
/**
 * Cross-surface accessibility audit for GitView Git / merge UI.
 * Guards role, aria-label, and live-region semantics on high-traffic panels.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildMergeDocument } from "../../../src/core/mergeDocument";
import { useGitViewStore } from "../stores/gitViewStore";
import { Toolbar } from "../components/layout/Toolbar";
import { BottomBar } from "../components/layout/BottomBar";
import { CrlfBanner } from "../components/ui/CrlfBanner";
import { SearchPanel } from "../components/merge/SearchPanel";
import { ContextMenu } from "../components/ui/ContextMenu";
import { ConflictsDialog } from "../components/conflict-list/ConflictsDialog";

afterEach(() => {
  cleanup();
  useGitViewStore.setState({
    activeDocument: null,
    conflictFiles: [],
    branchInfo: null,
    warnOnCrlf: true,
    crlfBannerDismissed: false,
    statusMessage: null,
  });
});

describe("Git / merge accessibility surfaces", () => {
  it("Toolbar conflict counter exposes status semantics", () => {
    render(
      <Toolbar
        remainingConflicts={2}
        totalChanges={5}
        unresolvedNonConflicting={0}
        unresolvedSimpleConflicts={0}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    const counter = screen.getByTestId("conflict-counter");
    expect(counter.getAttribute("role")).toBe("status");
    expect(counter.getAttribute("aria-live")).toBe("polite");
    expect(counter.getAttribute("aria-label")).toBe("5 changes, 2 conflicts");
  });

  it("BottomBar status message is a live status region", () => {
    useGitViewStore.setState({ statusMessage: "Ready to apply." });
    render(
      <BottomBar onCancel={() => {}} onApply={() => {}} applyDisabled={false} />,
    );
    const status = screen.getByTestId("merge-status-message");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("CrlfBanner warns with alert semantics and labeled actions", () => {
    const doc = buildMergeDocument({
      repoRoot: "/repo",
      relativePath: "src/app.ts",
      absolutePath: "/repo/src/app.ts",
      base: "a\r\nb\nc\n",
      ours: "a\r\nb\nc\n",
      theirs: "a\r\nb\nc\n",
      worktree: "a\r\nb\nc\n",
    });
    useGitViewStore.setState({ activeDocument: doc });
    render(<CrlfBanner />);
    expect(screen.getByTestId("crlf-banner").getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("crlf-fix").getAttribute("aria-label")).toBe(
      "Normalize line endings",
    );
    expect(screen.getByTestId("crlf-ignore").getAttribute("aria-label")).toBe(
      "Dismiss line ending warning",
    );
  });

  it("SearchPanel dialog is labeled for screen readers", () => {
    render(
      <SearchPanel
        query="findme"
        matchCount={2}
        activeIndex={0}
        onQueryChange={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        onClose={() => {}}
        onReplace={() => {}}
        onReplaceAll={() => {}}
      />,
    );
    const panel = screen.getByTestId("search-panel");
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-label")).toBe("Find and replace");
  });

  it("ContextMenu exposes menu role and label", () => {
    render(
      <ContextMenu
        menu={{ visible: true, x: 10, y: 20 }}
        onClose={() => {}}
        testId="test-context-menu"
        ariaLabel="Merge actions"
      >
        <div role="menuitem">Action</div>
      </ContextMenu>,
    );
    const menu = screen.getByTestId("test-context-menu");
    expect(menu.getAttribute("role")).toBe("menu");
    expect(menu.getAttribute("aria-label")).toBe("Merge actions");
  });

  it("ConflictsDialog exposes modal dialog semantics", () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => unknown }
    ).acquireVsCodeApi = () => ({
      postMessage: vi.fn(),
      getState: () => null,
      setState: () => {},
    });
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "file.txt", stageCode: "UU" }],
      branchInfo: {
        currentBranch: "master",
        mergeHead: "feature",
      },
    });
    render(<ConflictsDialog />);
    const dialog = screen.getByTestId("conflicts-dialog");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Conflicts");
    expect(screen.getByLabelText("Close conflicts dialog")).toBeTruthy();
  });
});