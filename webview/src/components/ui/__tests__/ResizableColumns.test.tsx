// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResizableColumns } from "../ResizableColumns";

describe("ResizableColumns", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => cleanup());

  it("renders panes with resize handles between them", () => {
    render(
      <ResizableColumns
        defaultPercents={[30, 40, 30]}
        panes={[
          <div key="a" data-testid="pane-a">
            A
          </div>,
          <div key="b" data-testid="pane-b">
            B
          </div>,
          <div key="c" data-testid="pane-c">
            C
          </div>,
        ]}
      />,
    );
    expect(screen.getByTestId("pane-a")).toBeTruthy();
    expect(screen.getByTestId("pane-b")).toBeTruthy();
    expect(screen.getByTestId("pane-c")).toBeTruthy();
    expect(screen.getByTestId("resizable-column-handle-0")).toBeTruthy();
    expect(screen.getByTestId("resizable-column-handle-1")).toBeTruthy();
  });

  it("dragging a handle resizes adjacent columns", () => {
    const view = render(
      <ResizableColumns
        defaultPercents={[30, 40, 30]}
        storageKey="test-resize-drag"
        panes={[
          <div key="a" data-testid="pane-a">
            A
          </div>,
          <div key="b" data-testid="pane-b">
            B
          </div>,
          <div key="c" data-testid="pane-c">
            C
          </div>,
        ]}
      />,
    );

    const container = view.getByTestId("resizable-columns");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 1000, height: 400, top: 0, left: 0 }),
    });

    const col0 = view.getByTestId("resizable-column-0");
    const widthBefore = col0.style.width;

    const handle = view.getByTestId("resizable-column-handle-0");
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(window, { movementX: 80, clientX: 380, clientY: 10 });
    fireEvent.mouseUp(window);

    expect(col0.style.width).not.toBe(widthBefore);
    expect(localStorage.getItem("test-resize-drag")).toBeTruthy();
  });

  it("never persists NaN when defaultPercents is shorter than panes", () => {
    const view = render(
      <ResizableColumns
        defaultPercents={[50, 50]}
        storageKey="test-resize-mismatch"
        panes={[
          <div key="a" data-testid="pane-a">
            A
          </div>,
          <div key="b" data-testid="pane-b">
            B
          </div>,
          <div key="c" data-testid="pane-c">
            C
          </div>,
        ]}
      />,
    );

    const container = view.getByTestId("resizable-columns");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 1000, height: 400, top: 0, left: 0 }),
    });

    fireEvent.mouseDown(view.getByTestId("resizable-column-handle-1"));
    fireEvent.mouseMove(window, { movementX: 60, clientX: 700, clientY: 10 });
    fireEvent.mouseUp(window);

    for (const i of [0, 1, 2]) {
      const width = view.getByTestId(`resizable-column-${i}`).style.width;
      expect(width).not.toContain("NaN");
      expect(Number.parseFloat(width)).toBeGreaterThan(0);
    }
    const stored = JSON.parse(
      localStorage.getItem("test-resize-mismatch") ?? "[]",
    ) as unknown[];
    expect(stored).toHaveLength(3);
    expect(stored.every((v) => Number.isFinite(v))).toBe(true);
  });
});
