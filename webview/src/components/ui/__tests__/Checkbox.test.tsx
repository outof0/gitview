// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  afterEach(() => cleanup());

  it("renders the label and reflects the checked state", () => {
    const { rerender } = render(
      <Checkbox checked={false} onChange={vi.fn()} testId="box">
        Enable thing
      </Checkbox>,
    );
    expect(screen.getByTestId("box")).toHaveProperty("checked", false);
    expect(screen.getByText("Enable thing")).toBeTruthy();

    rerender(
      <Checkbox checked={true} onChange={vi.fn()} testId="box">
        Enable thing
      </Checkbox>,
    );
    expect(screen.getByTestId("box")).toHaveProperty("checked", true);
  });

  it("reports toggles through onChange", () => {
    const onChange = vi.fn();
    render(
      <Checkbox checked={false} onChange={onChange} testId="box">
        Enable thing
      </Checkbox>,
    );
    fireEvent.click(screen.getByText("Enable thing"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when disabled", () => {
    const onChange = vi.fn();
    render(
      <Checkbox checked={false} disabled onChange={onChange} testId="box">
        Enable thing
      </Checkbox>,
    );
    expect(screen.getByTestId("box")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByText("Enable thing"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a hint under the label", () => {
    render(
      <Checkbox checked={false} onChange={vi.fn()} hint="--no-ff" testId="box">
        No fast-forward
      </Checkbox>,
    );
    expect(screen.getByText("--no-ff")).toBeTruthy();
  });
});
