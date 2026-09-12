// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollArea } from "../ScrollArea";
import { GitDialogShell } from "../GitDialogShell";

/**
 * Utilities the UI gate forbids outside `ScrollArea`. Anything matching these
 * on a rendered element is an ad-hoc scroll owner.
 */
const AD_HOC_OVERFLOW = ["overflow-auto", "overflow-x-auto", "overflow-x-scroll"];

function overflowClassNames(el: Element): string[] {
  const raw = el.getAttribute("class") ?? "";
  return raw.split(/\s+/).filter((name) => AD_HOC_OVERFLOW.includes(name));
}

describe("scroll owners", () => {
  afterEach(() => cleanup());

  it("names the axis it owns", () => {
    render(
      <>
        <ScrollArea axis="vertical" data-testid="v">
          rows
        </ScrollArea>
        <ScrollArea axis="horizontal" data-testid="h">
          chips
        </ScrollArea>
        <ScrollArea axis="both" data-testid="b">
          code
        </ScrollArea>
      </>,
    );

    expect(screen.getByTestId("v").getAttribute("data-scroll-owner")).toBe(
      "vertical",
    );
    expect(overflowClassNames(screen.getByTestId("v"))).toEqual([]);

    expect(screen.getByTestId("h").getAttribute("data-scroll-owner")).toBe(
      "horizontal",
    );
    expect(overflowClassNames(screen.getByTestId("h"))).toEqual([
      "overflow-x-auto",
    ]);

    expect(screen.getByTestId("b").getAttribute("data-scroll-owner")).toBe(
      "both",
    );
    expect(overflowClassNames(screen.getByTestId("b"))).toEqual([
      "overflow-auto",
    ]);
  });

  it('axis "none" declares a region with no scrollbar of its own', () => {
    render(
      <ScrollArea axis="none" data-testid="region">
        content
      </ScrollArea>,
    );

    const region = screen.getByTestId("region");
    expect(region.getAttribute("data-scroll-owner")).toBe("none");
    expect(overflowClassNames(region)).toEqual([]);
  });

  it("stays a plain div that forwards refs and DOM props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ScrollArea ref={ref} axis="vertical" aria-label="Rows" data-testid="rows">
        rows
      </ScrollArea>,
    );

    expect(ref.current?.tagName).toBe("DIV");
    expect(screen.getByLabelText("Rows")).toBe(ref.current);
  });

  it("scrolls the whole dialog at the compact sizes", () => {
    render(<GitDialogShell title="Compact">body</GitDialogShell>);

    const dialog = screen.getByRole("dialog", { name: "Compact" });
    expect(dialog.getAttribute("data-scroll-owner")).toBe("vertical");
    expect(dialog.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["overflow-y-auto", "overflow-x-hidden"]),
    );
  });

  it("hands scrolling to the inner pane at list and xl sizes", () => {
    for (const size of ["list", "xl"] as const) {
      render(
        <GitDialogShell title={size} size={size}>
          body
        </GitDialogShell>,
      );

      const dialog = screen.getByRole("dialog", { name: size });
      expect(dialog.getAttribute("data-scroll-owner")).toBe("none");
      expect(overflowClassNames(dialog)).toEqual([]);
      cleanup();
    }
  });

  it("keeps Escape handling on the element that owns the scroll", () => {
    const onCancel = vi.fn();
    render(
      <GitDialogShell title="Esc" onCancel={onCancel}>
        body
      </GitDialogShell>,
    );

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Esc" }), {
      key: "Escape",
    });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
