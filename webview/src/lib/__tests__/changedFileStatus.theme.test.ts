import { describe, expect, it } from "vitest";
import {
  changedFileStatusBadgeClass,
  changedFileStatusTextClass,
} from "../../components/git/changedFileStatus";

describe("changedFileStatus theme classes", () => {
  it("uses token classes instead of dark-only hex", () => {
    for (const status of ["A", "M", "D", "R"] as const) {
      const text = changedFileStatusTextClass(status);
      const badge = changedFileStatusBadgeClass(status);
      expect(text).toMatch(/^nx-file-status-/);
      expect(badge).toMatch(/nx-file-status-/);
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(badge).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
