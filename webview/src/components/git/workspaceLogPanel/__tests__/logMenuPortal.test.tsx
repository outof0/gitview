// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogMenuPortal } from "../logMenuPortal";

describe("LogMenuPortal", () => {
  afterEach(() => cleanup());

  it("keeps the menu inside the viewport when the trigger is near the bottom", () => {
    Object.defineProperty(window, "innerHeight", { value: 200, configurable: true });
    const anchor = document.createElement("button");
    document.body.append(anchor);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      top: 170,
      bottom: 190,
      left: 8,
      right: 80,
      width: 72,
      height: 20,
      x: 8,
      y: 170,
      toJSON: () => ({}),
    });

    render(
      <LogMenuPortal open anchor={anchor} onClose={vi.fn()} label="Branch">
        <button type="button">All commits</button>
      </LogMenuPortal>,
    );

    const menu = screen.getByTestId("log-menu-portal");
    const top = Number.parseFloat(menu.style.top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(170);
    expect(Number.parseFloat(menu.style.maxHeight)).toBeGreaterThan(0);
    expect(Number.parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(280);
    anchor.remove();
  });

  it("does not grow to fill the rest of the panel", () => {
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
    const anchor = document.createElement("button");
    document.body.append(anchor);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      top: 40,
      bottom: 60,
      left: 8,
      right: 80,
      width: 72,
      height: 20,
      x: 8,
      y: 40,
      toJSON: () => ({}),
    });

    render(
      <LogMenuPortal open anchor={anchor} onClose={vi.fn()} label="Paths">
        <button type="button">README.md</button>
      </LogMenuPortal>,
    );

    const menu = screen.getByTestId("log-menu-portal");
    expect(Number.parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(280);
    anchor.remove();
  });

  it("does not close when pressing inside the menu", () => {
    const onClose = vi.fn();
    const anchor = document.createElement("button");
    document.body.append(anchor);
    render(
      <LogMenuPortal open anchor={anchor} onClose={onClose} label="Branch">
        <button type="button">All commits</button>
      </LogMenuPortal>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "All commits" }));
    expect(onClose).not.toHaveBeenCalled();
    anchor.remove();
  });
});
