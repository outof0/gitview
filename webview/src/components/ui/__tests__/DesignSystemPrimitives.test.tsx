// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button, type ButtonProps } from "../Button";
import { ScrollArea } from "../ScrollArea";
import { SelectField } from "../SelectField";
import { TextArea } from "../TextArea";
import { Input } from "../Input";

afterEach(cleanup);

function classSet(el: Element): Set<string> {
  return new Set((el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
}

const VARIANTS: NonNullable<ButtonProps["variant"]>[] = [
  "primary",
  "secondary",
  "danger",
  "ghost",
  "toolbar",
];

describe("design-system primitives", () => {
  it("keeps button behavior while applying a shared variant and size", () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" size="compact" onClick={onClick}>
        Apply
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Apply" }).className).toContain(
      "bg-primary",
    );
  });

  it("marks the single intended scroll axis", () => {
    render(<ScrollArea data-testid="list-scroll">rows</ScrollArea>);
    const area = screen.getByTestId("list-scroll");
    expect(area.getAttribute("data-scroll-owner")).toBe("vertical");
    expect(area.className).toContain("overflow-y-auto");
    expect(area.className).toContain("overflow-x-hidden");
  });

  it("forwards form attributes through shared fields", () => {
    render(
      <>
        <SelectField aria-label="Branch" defaultValue="main">
          <option value="main">main</option>
        </SelectField>
        <TextArea aria-label="Message" defaultValue="Commit message" />
      </>,
    );

    expect(
      (screen.getByRole("combobox", { name: "Branch" }) as HTMLSelectElement)
        .value,
    ).toBe("main");
    expect(
      (screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement)
        .value,
    ).toBe("Commit message");
  });

  it("keeps text and selection inputs native while applying shared states", () => {
    render(
      <>
        <Input aria-label="Query" placeholder="Search" />
        <Input aria-label="Include file" type="checkbox" defaultChecked />
      </>,
    );

    const query = screen.getByRole("textbox", { name: "Query" });
    const checkbox = screen.getByRole("checkbox", { name: "Include file" });
    expect(query.tagName).toBe("INPUT");
    expect(query.className).toContain("border-input-border");
    expect(checkbox.className).toContain("accent-ring");
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it("supports semantic content button composition without losing native semantics", () => {
    render(
      <Button variant="ghost" size="content" className="feature-specific">
        Toggle
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Toggle" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toContain("feature-specific");
    expect(button.className).toContain("disabled:cursor-not-allowed");
    expect(button.getAttribute("data-button-variant")).toBe("ghost");
  });
});

describe("Button border contract", () => {
  /**
   * `base.css` resets `button { border: none }` with an element selector, which
   * outranks Tailwind's `*{border-style:solid}` reset. A variant that only set
   * a border *colour* therefore rendered with `border-style: none`, collapsing
   * the width to a computed 0 — no utility could give a Button a visible
   * border. The primitive must declare width AND style itself.
   */
  it.each(VARIANTS)("owns border width and style in the %s variant", (variant) => {
    render(<Button variant={variant}>{variant} action</Button>);
    const classes = classSet(
      screen.getByRole("button", { name: `${variant} action` }),
    );
    expect(classes.has("border")).toBe(true);
    expect(classes.has("border-solid")).toBe(true);
  });

  it.each(VARIANTS)("lets the %s variant pick only the border colour", (variant) => {
    render(<Button variant={variant}>{variant} action</Button>);
    const classes = classSet(
      screen.getByRole("button", { name: `${variant} action` }),
    );
    const colours = [...classes].filter(
      (c) => c.startsWith("border-") && c !== "border-solid",
    );
    expect(colours).toHaveLength(1);
  });

  it("renders a real button so focus and keyboard activation are native", () => {
    render(<Button>Apply</Button>);
    const btn = screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement;
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.type).toBe("button");
    expect(btn.disabled).toBe(false);
  });

  it("can submit a form it does not contain", () => {
    render(
      <>
        <form id="danger-form" />
        <Button type="submit" form="danger-form" variant="danger">
          Delete
        </Button>
      </>,
    );
    const btn = screen.getByRole("button", {
      name: "Delete",
    }) as HTMLButtonElement;
    expect(btn.type).toBe("submit");
    expect(btn.form?.id).toBe("danger-form");
  });

  it("does not fire when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards aria and data attributes to the button element", () => {
    render(
      <Button aria-label="Close branches" aria-pressed={true} data-testid="close">
        X
      </Button>,
    );
    const btn = screen.getByTestId("close");
    expect(btn.getAttribute("aria-label")).toBe("Close branches");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });
});
