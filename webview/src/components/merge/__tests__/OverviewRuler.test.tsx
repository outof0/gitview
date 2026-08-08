// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMergeDocument } from "../../../../../src/core/mergeDocument";
import { buildBlockRows } from "../rows";
import { OverviewRuler } from "../OverviewRuler";

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
  return buildBlockRows(doc);
}

describe("OverviewRuler", () => {
  afterEach(() => cleanup());

  it("renders one tick per navigable block", () => {
    const rows = makeRows();
    const navigable = rows.filter((r) => r.navigable);
    render(<OverviewRuler blocks={rows} onJump={() => {}} />);

    expect(screen.getByTestId("overview-ruler")).toBeTruthy();
    expect(screen.getAllByTestId("overview-ruler-tick").length).toBe(
      navigable.length,
    );
  });

  it("calls onJump with the block id when a tick is clicked", () => {
    const rows = makeRows();
    const navigable = rows.filter((r) => r.navigable);
    const onJump = vi.fn();
    render(<OverviewRuler blocks={rows} onJump={onJump} />);

    const ticks = screen.getAllByTestId("overview-ruler-tick");
    fireEvent.click(ticks[1]!);
    expect(onJump).toHaveBeenCalledWith(navigable[1]!.blockId);
  });
});