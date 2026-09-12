// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isModDShortcut } from "../isModDShortcut";

function event(
  init: KeyboardEventInit & { target?: EventTarget | null },
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", init);
  if (init.target) {
    Object.defineProperty(event, "target", { value: init.target });
  }
  return event;
}

describe("isModDShortcut", () => {
  it("matches Ctrl/Cmd+D outside form fields", () => {
    expect(isModDShortcut(event({ key: "d", ctrlKey: true }))).toBe(true);
    expect(isModDShortcut(event({ key: "D", metaKey: true }))).toBe(true);
  });

  it("ignores other modifiers, keys, and typing targets", () => {
    expect(isModDShortcut(event({ key: "d" }))).toBe(false);
    expect(isModDShortcut(event({ key: "d", ctrlKey: true, shiftKey: true }))).toBe(
      false,
    );
    expect(
      isModDShortcut(
        event({ key: "d", ctrlKey: true, target: document.createElement("input") }),
      ),
    ).toBe(false);
    expect(
      isModDShortcut(
        event({
          key: "d",
          ctrlKey: true,
          target: document.createElement("textarea"),
        }),
      ),
    ).toBe(false);
  });
});
