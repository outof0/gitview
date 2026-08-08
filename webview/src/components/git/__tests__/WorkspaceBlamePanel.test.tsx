// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { WorkspaceBlamePanel } from "../WorkspaceBlamePanel";
import type { BlameSnapshot } from "@gitview/shared/types/blame";
import { formatBlameAnnotationDate } from "../../../lib/blameFormat";
import { createFakeMonaco } from "../../../test/fakeMonaco";

const fakeMonaco = createFakeMonaco();

vi.mock("../../merge/monacoSetup", () => ({
  loadMonaco: vi.fn(() => Promise.resolve(fakeMonaco)),
  getMonacoIfLoaded: vi.fn(() => fakeMonaco),
}));

const snapshot: BlameSnapshot = {
  repoId: "repo-1",
  filePath: "src/app.ts",
  ref: "HEAD",
  refreshedAt: Date.now(),
  lines: [
    {
      lineNumber: 1,
      sha: "abc1234567890abcdef1234567890abcdef1234",
      shortSha: "abc1234",
      author: "Jane",
      authorEmail: "j@example.com",
      authorTime: 1_700_000_000,
      summary: "Initial commit",
      text: "const app = 1;",
    },
    {
      lineNumber: 2,
      sha: "abc1234567890abcdef1234567890abcdef1234",
      shortSha: "abc1234",
      author: "Jane",
      authorEmail: "j@example.com",
      authorTime: 1_700_000_000,
      summary: "Initial commit",
      text: "export default app;",
    },
  ],
};

async function flushMonaco() {
  // loadMonaco resolves on microtask; re-render after create
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("WorkspaceBlamePanel", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("prompts to select a file when none is selected", () => {
    render(<WorkspaceBlamePanel snapshot={null} filePath={null} />);
    expect(screen.getByTestId("workspace-blame-panel")).toBeTruthy();
    expect(screen.getByText(/No file open for annotate/i)).toBeTruthy();
  });

  it("mounts Monaco code editor and annotate gutter", async () => {
    render(
      <WorkspaceBlamePanel
        snapshot={snapshot}
        filePath="src/app.ts"
        headSha={snapshot.lines[0]!.sha}
      />,
    );
    await flushMonaco();
    expect(screen.getByTestId("blame-monaco").getAttribute("data-language")).toBe(
      "typescript",
    );
    expect(screen.getByTestId("blame-editor").getAttribute("data-monaco")).toBe(
      "ready",
    );
    const date = formatBlameAnnotationDate(snapshot.lines[0]!.authorTime);
    expect(screen.getByTestId("blame-sha-1").textContent).toContain("Jane");
    expect(screen.getByTestId("blame-sha-1").textContent).toContain(date);
    expect(screen.getByTestId("blame-sha-1").textContent).toContain(
      "Initial commit",
    );
  });

  it("delegates commit clicks to onOpenCommit when provided", async () => {
    let openedSha: string | null = null;
    render(
      <WorkspaceBlamePanel
        snapshot={snapshot}
        filePath="src/app.ts"
        onOpenCommit={(sha) => {
          openedSha = sha;
        }}
      />,
    );
    await flushMonaco();
    fireEvent.click(screen.getByTestId("blame-sha-1"));
    expect(openedSha).toBe(snapshot.lines[0]!.sha);
  });

  it("shows a commit hover card after hovering the left message column", async () => {
    render(
      <WorkspaceBlamePanel
        snapshot={snapshot}
        filePath="src/app.ts"
        onOpenCommit={() => {}}
      />,
    );
    await flushMonaco();
    expect(screen.queryByTestId("blame-commit-hover-card")).toBeNull();

    vi.useFakeTimers();
    fireEvent.mouseEnter(screen.getByTestId("blame-sha-1"));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const card = screen.getByTestId("blame-commit-hover-card");
    expect(card.textContent).toContain("Initial commit");
    expect(card.textContent).toContain("Jane");
    vi.useRealTimers();
  });

  it("clears annotation when Monaco content for a line is edited", async () => {
    render(<WorkspaceBlamePanel snapshot={snapshot} filePath="src/app.ts" />);
    await flushMonaco();
    expect(screen.getByTestId("blame-editor").getAttribute("data-monaco")).toBe(
      "ready",
    );

    const uri = fakeMonaco.Uri.parse(
      `inmemory://gitview-blame/${encodeURIComponent("src/app.ts")}`,
    );
    const model = fakeMonaco.editor.getModel(uri);
    expect(model).toBeTruthy();
    act(() => {
      model!.setValue("const app = 99;\nexport default app;", {
        isFlush: false,
      });
    });

    expect(screen.getByTestId("blame-line-1").getAttribute("data-annotated")).toBe(
      "false",
    );
    expect(screen.getByTestId("blame-line-2").getAttribute("data-annotated")).toBe(
      "true",
    );
  });

  it("keeps annotate anchors when lines are inserted in the middle", async () => {
    render(<WorkspaceBlamePanel snapshot={snapshot} filePath="src/app.ts" />);
    await flushMonaco();
    const uri = fakeMonaco.Uri.parse(
      `inmemory://gitview-blame/${encodeURIComponent("src/app.ts")}`,
    );
    const model = fakeMonaco.editor.getModel(uri)!;
    act(() => {
      // Insert two lines between the original two
      model.setValue(
        "const app = 1;\n// inserted\nconst mid = 0;\nexport default app;",
        { isFlush: false },
      );
    });
    // Original line1 still at top — keeps Jane
    expect(screen.getByTestId("blame-line-1").getAttribute("data-annotated")).toBe(
      "true",
    );
    expect(screen.getByTestId("blame-sha-1").textContent).toContain("Jane");
    // Inserted lines blank
    expect(screen.getByTestId("blame-line-2").getAttribute("data-annotated")).toBe(
      "false",
    );
    expect(screen.getByTestId("blame-line-3").getAttribute("data-annotated")).toBe(
      "false",
    );
    // Original line2 shifted down — still annotated
    expect(screen.getByTestId("blame-line-4").getAttribute("data-annotated")).toBe(
      "true",
    );
    expect(screen.getByTestId("blame-sha-4").textContent).toContain("Jane");
  });

  it("marks dirty and saves via Save button", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDirty = vi.fn();
    render(
      <WorkspaceBlamePanel
        snapshot={snapshot}
        filePath="src/app.ts"
        onSaveContent={onSave}
        onDirtyChange={onDirty}
      />,
    );
    await flushMonaco();

    const uri = fakeMonaco.Uri.parse(
      `inmemory://gitview-blame/${encodeURIComponent("src/app.ts")}`,
    );
    const model = fakeMonaco.editor.getModel(uri)!;
    act(() => {
      model.setValue("const app = 1;\nexport default app;\n// x", {
        isFlush: false,
      });
    });

    expect(screen.getByTestId("workspace-blame-panel").getAttribute("data-dirty")).toBe(
      "true",
    );
    expect(screen.getByTestId("blame-dirty-dot")).toBeTruthy();
    expect(screen.getByTestId("blame-save-status").textContent).toContain(
      "Modified",
    );
    expect(onDirty).toHaveBeenCalledWith(true);
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("blame-save-button"));
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledWith(
      "const app = 1;\nexport default app;\n// x",
    );
  });
});
