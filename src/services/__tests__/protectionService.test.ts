import { describe, expect, it } from "vitest";
import {
  checkDestructiveAction,
  createProtectionService,
  isProtectedBranch,
} from "../protectionService";

describe("ProtectionService", () => {
  const patterns = ["main", "release/*"];

  it("matches protected branch patterns", () => {
    expect(isProtectedBranch("main", patterns)).toBe(true);
    expect(isProtectedBranch("release/1.0", patterns)).toBe(true);
    expect(isProtectedBranch("feature/foo", patterns)).toBe(false);
  });

  it("blocks destructive actions on protected branches", () => {
    const result = checkDestructiveAction("main", patterns, "force_push");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.action).toBe("force_push");
    }
  });

  it("allows non-destructive actions on protected branches", () => {
    const result = checkDestructiveAction("main", patterns, "force_checkout");
    expect(result.allowed).toBe(true);
  });

  it("exposes service helpers", () => {
    const svc = createProtectionService(patterns);
    expect(svc.isProtectedBranch("release/hotfix")).toBe(true);
    expect(svc.checkDestructiveAction("main", "hard_reset").allowed).toBe(
      false,
    );
  });

  it("updatePatterns mutates the same service reference", () => {
    const svc = createProtectionService(["main"]);
    expect(svc.isProtectedBranch("develop")).toBe(false);
    svc.updatePatterns(["main", "develop"]);
    expect(svc.isProtectedBranch("develop")).toBe(true);
    expect(svc.checkDestructiveAction("develop", "hard_reset").allowed).toBe(
      false,
    );
    expect(svc.patterns).toEqual(["main", "develop"]);
  });
});