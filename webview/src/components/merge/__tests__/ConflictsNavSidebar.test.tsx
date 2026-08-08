// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMergeDocument } from "../../../../../src/core/mergeDocument";
import { buildBlockRows } from "../rows";
import { ConflictsNavSidebar } from "../ConflictsNavSidebar";

function makeRows() {
  const doc = buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "src/app.ts",
    absolutePath: "/repo/src/app.ts",
    base: "a\nb\nc\nd\n",
    ours: "a\nours-b\nc\nours-d\n",
    theirs: "a\ntheirs-b\nc\ntheirs-d\n",
    worktree: "a\nours-b\nc\nours-d\n",
    now: 1,
  });
  return buildBlockRows(doc).filter((r) => r.navigable);
}

describe("ConflictsNavSidebar", () => {
  afterEach(() => cleanup());

  it("lists navigable changes with count in the header", () => {
    const changes = makeRows();
    render(
      <ConflictsNavSidebar
        changes={changes}
        activeBlockId={null}
        onJump={() => {}}
      />,
    );

    expect(screen.getByTestId("conflicts-nav")).toBeTruthy();
    expect(screen.getByText(`Conflicts Navigation (${changes.length})`)).toBeTruthy();
  });

  it("highlights the active block and jumps on click", () => {
    const changes = makeRows();
    const active = changes[1]!.blockId;
    const onJump = vi.fn();
    render(
      <ConflictsNavSidebar
        changes={changes}
        activeBlockId={active}
        onJump={onJump}
      />,
    );

    const activeBtn = screen.getByLabelText(`jump-${active}`);
    expect(activeBtn.className).toContain("bg-list-active");

    const target = changes[0]!.blockId;
    fireEvent.click(screen.getByLabelText(`jump-${target}`));
    expect(onJump).toHaveBeenCalledWith(target);
  });
});