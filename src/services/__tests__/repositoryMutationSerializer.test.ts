import { describe, expect, it } from "vitest";
import { createRepositoryMutationSerializer } from "../repositoryMutationSerializer";

describe("repositoryMutationSerializer", () => {
  it("reports isBusy while an operation runs and false after it settles", async () => {
    const serializer = createRepositoryMutationSerializer();
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    let running = false;

    const operation = serializer.run("repo", async () => {
      running = true;
      await gate;
    });

    expect(serializer.isBusy("repo")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(running).toBe(true);
    expect(serializer.isBusy("repo")).toBe(true);
    release();
    await operation;
    // The queue entry is removed one microtask after the operation settles.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(serializer.isBusy("repo")).toBe(false);
  });

  it("keeps the key busy across a queued chain and independent per key", async () => {
    const serializer = createRepositoryMutationSerializer();
    const order: string[] = [];
    const first = serializer.run("repo", async () => {
      order.push("one");
    });
    const second = serializer.run("repo", async () => {
      order.push("two");
      expect(serializer.isBusy("repo")).toBe(true);
    });

    expect(serializer.isBusy("repo")).toBe(true);
    expect(serializer.isBusy("other")).toBe(false);
    await Promise.all([first, second]);
    expect(order).toEqual(["one", "two"]);
    expect(serializer.isBusy("repo")).toBe(false);
  });
});
