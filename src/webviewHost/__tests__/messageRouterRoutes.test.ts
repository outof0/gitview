import { describe, expect, it } from "vitest";
import { resolveDispatcher } from "../messageRouterRoutes";
import { HOST_EVENT_TYPES } from "../../shared/protocol";

describe("messageRouterRoutes", () => {
  it("routes a core request to its owning dispatcher", () => {
    expect(resolveDispatcher("repo.refresh")).toBeTypeOf("function");
    expect(resolveDispatcher("review.list")).toBeTypeOf("function");
    expect(resolveDispatcher("stash.push")).toBeTypeOf("function");
  });

  it("routes requests in the same domain to the same dispatcher", () => {
    expect(resolveDispatcher("branch.create")).toBe(
      resolveDispatcher("branch.delete"),
    );
    expect(resolveDispatcher("log.query")).toBe(
      resolveDispatcher("log.reset"),
    );
  });

  it("routes distinct domains to distinct dispatchers", () => {
    expect(resolveDispatcher("branch.create")).not.toBe(
      resolveDispatcher("log.query"),
    );
  });

  it("reports diff.annotate as panel-owned rather than router-owned", () => {
    // Served by the interceptor in webview/gitViewPresentation.ts. Declared in
    // the table so the exhaustiveness check cannot be satisfied by omission.
    expect(resolveDispatcher("diff.annotate")).toBeNull();
  });
});

describe("HOST_EVENT_TYPES", () => {
  it("contains no duplicates", () => {
    expect(new Set(HOST_EVENT_TYPES).size).toBe(HOST_EVENT_TYPES.length);
  });

  it("includes the events that the hand-written whitelist used to omit", () => {
    for (const type of [
      "git.settings",
      "review.snapshot",
      "review.details",
      "merge.showConflictList",
    ]) {
      expect(HOST_EVENT_TYPES).toContain(type);
    }
  });
});
