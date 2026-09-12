// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResizableSplit } from "../ResizableSplit";

describe("ResizableSplit", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => cleanup());

  it("renders horizontal split with resize handle", () => {
    render(
      <ResizableSplit
        direction="horizontal"
        first={<div data-testid="pane-a">A</div>}
        second={<div data-testid="pane-b">B</div>}
      />,
    );
    expect(screen.getByTestId("pane-a")).toBeTruthy();
    expect(screen.getByTestId("pane-b")).toBeTruthy();
    expect(
      screen.getByTestId("resizable-split-handle-horizontal"),
    ).toBeTruthy();
  });

  it("dragging the handle changes the first pane size", () => {
    const view = render(
      <ResizableSplit
        direction="horizontal"
        storageKey="test-split-drag"
        initialPercent={40}
        first={<div data-testid="pane-a">A</div>}
        second={<div data-testid="pane-b">B</div>}
      />,
    );

    const container = view.getByTestId("resizable-split-horizontal");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 800, height: 400, top: 0, left: 0 }),
    });

    const firstPane = container.firstElementChild as HTMLElement;
    const widthBefore = firstPane.style.width;

    const handle = view.getByTestId("resizable-split-handle-horizontal");
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(window, { clientX: 500, clientY: 10 });
    fireEvent.mouseUp(window);

    expect(firstPane.style.width).not.toBe(widthBefore);
    expect(localStorage.getItem("test-split-drag")).toBeTruthy();
  });

  it("clamps a stale stored ratio so both panes remain visible", () => {
    localStorage.setItem("test-split-stale", "95");
    const view = render(
      <ResizableSplit
        direction="vertical"
        storageKey="test-split-stale"
        minFirstPercent={20}
        minSecondPercent={25}
        first={<div>A</div>}
        second={<div>B</div>}
      />,
    );

    const container = view.getByTestId("resizable-split-vertical");
    const firstPane = container.firstElementChild as HTMLElement;
    expect(firstPane.style.height).toBe("75%");
  });
});
