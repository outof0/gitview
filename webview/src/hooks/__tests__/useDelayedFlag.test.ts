// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDelayedFlag } from "../useDelayedFlag";

describe("useDelayedFlag", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("stays false until the delay elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useDelayedFlag(active, 200),
      { initialProps: { active: false } },
    );

    expect(result.current).toBe(false);
    rerender({ active: true });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it("cancels when the flag clears before the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useDelayedFlag(active, 200),
      { initialProps: { active: true } },
    );

    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current).toBe(false);
  });
});
