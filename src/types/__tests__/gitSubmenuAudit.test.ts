import { describe, expect, it } from "vitest";
import { GIT_SUBMENU_ITEMS } from "../gitSubmenu";
import {
  GIT_SUBMENU_AUDIT,
  gitSubmenuAuditGaps,
  getGitSubmenuAuditEntry,
} from "../gitSubmenuAudit";

describe("gitSubmenuAudit", () => {
  it("covers every contributed submenu command", () => {
    expect(gitSubmenuAuditGaps()).toEqual([]);
    expect(GIT_SUBMENU_AUDIT).toHaveLength(GIT_SUBMENU_ITEMS.length);
  });

  it.each(GIT_SUBMENU_ITEMS.map((item) => [item.command, item.title] as const))(
    "%s (%s) has integration and native E2E owners",
    (command, title) => {
      const entry = getGitSubmenuAuditEntry(command);
      expect(entry, `${command} must have an audit row`).toBeDefined();
      expect(entry!.title).toBe(title);
      expect(entry!.integration.length).toBeGreaterThan(0);
      expect(entry!.nativeE2e?.length).toBeGreaterThan(0);
    },
  );
});