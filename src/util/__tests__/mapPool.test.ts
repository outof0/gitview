import { describe, expect, it } from "vitest";
import { mapPool } from "../mapPool";

describe("mapPool", () => {
  it("maps all items preserving order", async () => {
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("returns empty array for empty input", async () => {
    const out = await mapPool([], 4, async () => true);
    expect(out).toEqual([]);
  });

  it("rejects when a worker throws", async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (n) => {
        if (n === 2) {
          throw new Error("boom");
        }
        return n;
      }),
    ).rejects.toThrow("boom");
  });

  it("passes item index to worker", async () => {
    const indices: number[] = [];
    await mapPool(["a", "b", "c"], 2, async (_item, index) => {
      indices.push(index);
      return index;
    });
    expect(indices.sort()).toEqual([0, 1, 2]);
  });

  it("limits concurrent workers", async () => {
    let active = 0;
    let maxActive = 0;
    await mapPool([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return true;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});