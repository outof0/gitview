// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceDiffPanel } from "../WorkspaceDiffPanel";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import { useGitWorkspaceStore } from "../../../stores/gitWorkspaceStore";

const document: WorkspaceDiffDocument = {
  repoId: "repo-1",
  filePath: "src/app.ts",
  layout: "split",
  status: "M",
  left: { label: "HEAD", text: "alpha\nold\n" },
  right: { label: "Working Tree", text: "alpha\nnew\n" },
  binary: false,
  staged: false,
};

function mockScrollable(
  el: HTMLElement,
  scrollTop: number,
  scrollHeight = 1000,
  clientHeight = 400,
) {
  Object.defineProperty(el, "scrollTop", {
    value: scrollTop,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(el, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", {
    value: clientHeight,
    configurable: true,
  });
}

describe("WorkspaceDiffPanel unified view", () => {
  afterEach(() => {
    cleanup();
    useGitWorkspaceStore.setState({
      diffViewMode: "side_by_side",
      whitespacePolicy: "doNotIgnore",
    });
  });

  it("renders unified diff lines with +/- prefixes", () => {
    useGitWorkspaceStore.setState({ diffViewMode: "unified" });
    render(
      <WorkspaceDiffPanel
        document={document}
        filePath="src/app.ts"
      />,
    );
    expect(screen.getByTestId("git-diff-unified")).toBeTruthy();
    expect(screen.getByTestId("diff-file-identity").textContent).toContain("app.ts");
    expect(screen.getByTestId("diff-file-identity").textContent).toContain("src");
    expect(screen.getByText("old")).toBeTruthy();
    expect(screen.getByText("new")).toBeTruthy();
  });

  it("toggles between side-by-side and unified layouts", () => {
    render(
      <WorkspaceDiffPanel
        document={document}
        filePath="src/app.ts"
      />,
    );
    expect(screen.getByTestId("git-diff-split")).toBeTruthy();
    fireEvent.click(screen.getByTestId("diff-view-mode-toggle"));
    expect(screen.getByTestId("git-diff-unified")).toBeTruthy();
    expect(useGitWorkspaceStore.getState().diffViewMode).toBe("unified");
  });

  it("updates whitespace policy from the toolbar select", () => {
    render(
      <WorkspaceDiffPanel
        document={document}
        filePath="src/app.ts"
      />,
    );
    fireEvent.change(screen.getByTestId("diff-whitespace-policy"), {
      target: { value: "ignoreWhitespaces" },
    });
    expect(useGitWorkspaceStore.getState().whitespacePolicy).toBe(
      "ignoreWhitespaces",
    );
  });

  it("synchronizes side-by-side pane scrolling", () => {
    // The scroll-synced panes only exist in SplitWithHunks; without hunk/log
    // actions the panel renders Monaco, which syncs scrolling natively.
    render(
      <WorkspaceDiffPanel
        document={document}
        filePath="src/app.ts"
        showHunkActions
      />,
    );

    const left = screen.getByTestId("workspace-diff-left-scroll");
    const right = screen.getByTestId("workspace-diff-right-scroll");
    mockScrollable(left, 180);
    mockScrollable(right, 0);

    fireEvent.scroll(left);

    expect(right.scrollTop).toBe(180);
  });

  it("does not expose unsupported history hunk actions", () => {
    render(
      <WorkspaceDiffPanel
        document={document}
        filePath="src/app.ts"
        showLogActions
      />,
    );

    expect(screen.queryByText("Cherry-pick hunk")).toBeNull();
    expect(screen.queryByText("Revert hunk")).toBeNull();
    expect(screen.queryByTestId("hunk-actions-0")).toBeNull();
  });

  it("renders only the visible window for a large unified diff", () => {
    useGitWorkspaceStore.setState({ diffViewMode: "unified" });
    const text = Array.from(
      { length: 6_000 },
      (_, index) => `const value${index} = ${index};`,
    ).join("\n");
    const { container } = render(
      <WorkspaceDiffPanel
        document={{
          ...document,
          filePath: "large.ts",
          left: { label: "parent", text },
          right: { label: "commit", text },
        }}
        filePath="large.ts"
      />,
    );

    expect(container.querySelectorAll('[data-testid="code-line"]').length).toBeLessThan(200);
  });
});
