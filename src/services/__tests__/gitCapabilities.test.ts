import { describe, expect, it, vi } from "vitest";
import {
  createCapabilitiesApi,
  deriveCapabilities,
} from "../git/capabilities";

describe("git capabilities", () => {
  it("enables switch/restore for Git 2.23+", () => {
    const caps = deriveCapabilities("git version 2.43.0");
    expect(caps.supportsSwitch).toBe(true);
    expect(caps.supportsRestore).toBe(true);
    expect(caps.supportsWorktree).toBe(true);
    expect(caps.supportsPorcelainV1Z).toBe(true);
  });

  it("disables modern commands for old Git", () => {
    const caps = deriveCapabilities("git version 2.10.0");
    expect(caps.supportsSwitch).toBe(false);
    expect(caps.supportsRestore).toBe(false);
    expect(caps.supportsPorcelainV1Z).toBe(false);
  });

  it("keeps capability caches scoped to each Git service instance", async () => {
    const modernExec = vi.fn(async () => ({
      stdout: "git version 2.43.0\n",
      stderr: "",
    }));
    const legacyExec = vi.fn(async () => ({
      stdout: "git version 2.10.0\n",
      stderr: "",
    }));
    const modern = createCapabilitiesApi(modernExec);
    const legacy = createCapabilitiesApi(legacyExec);

    expect((await modern.detectCapabilities("/repo")).supportsSwitch).toBe(true);
    expect((await legacy.detectCapabilities("/repo")).supportsSwitch).toBe(false);
    expect(modernExec).toHaveBeenCalledTimes(1);
    expect(legacyExec).toHaveBeenCalledTimes(1);
  });
});
