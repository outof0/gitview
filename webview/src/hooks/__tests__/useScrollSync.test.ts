// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScrollSync } from "../useScrollSync";

function mockScrollContainer(scrollTop = 0, scrollHeight = 1000, clientHeight = 400) {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollTop", {
    value: scrollTop,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { value: clientHeight });
  return el;
}

describe("useScrollSync", () => {
  it("syncs scroll ratio across registered containers", async () => {
    const { result } = renderHook(() => useScrollSync(2, true));
    const left = mockScrollContainer(200);
    const right = mockScrollContainer(0);

    act(() => {
      result.current.registerContainer(0)(left);
      result.current.registerContainer(1)(right);
    });

    act(() => {
      result.current.handleScroll(0)();
    });

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(right.scrollTop).toBeGreaterThan(0);
  });

  it("does not sync when disabled", () => {
    const { result } = renderHook(() => useScrollSync(2, false));
    const left = mockScrollContainer(200);
    const right = mockScrollContainer(0);

    act(() => {
      result.current.registerContainer(0)(left);
      result.current.registerContainer(1)(right);
      result.current.handleScroll(0)();
    });

    expect(right.scrollTop).toBe(0);
  });

  it("keeps syncing repeated source scrolls within the same frame", () => {
    const { result } = renderHook(() => useScrollSync(2, true));
    const left = mockScrollContainer(100);
    const right = mockScrollContainer(0);

    act(() => {
      result.current.registerContainer(0)(left);
      result.current.registerContainer(1)(right);
      result.current.handleScroll(0)();
      left.scrollTop = 300;
      result.current.handleScroll(0)();
    });

    expect(right.scrollTop).toBe(300);
  });
});
