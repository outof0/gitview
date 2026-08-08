// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../ContextMenu";

describe("ContextMenu", () => {
  afterEach(() => cleanup());

  it("renders with menu role and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        menu={{ visible: true, x: 10, y: 10 }}
        onClose={onClose}
        testId="test-menu"
        ariaLabel="Test menu"
      >
        <div role="menuitem">Action</div>
      </ContextMenu>,
    );

    expect(screen.getByTestId("test-menu").getAttribute("role")).toBe("menu");
    expect(screen.getByTestId("test-menu").getAttribute("aria-label")).toBe(
      "Test menu",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps a tall menu opened near the bottom edge inside the viewport", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 240,
      height: 600,
    } as DOMRect);
    window.innerWidth = 900;
    window.innerHeight = 700;

    render(
      <ContextMenu menu={{ visible: true, x: 880, y: 640 }} onClose={vi.fn()} testId="test-menu">
        <div role="menuitem">Action</div>
      </ContextMenu>,
    );

    const el = screen.getByTestId("test-menu");
    expect(el.style.top).toBe("92px");
    expect(el.style.left).toBe("652px");
  });
});