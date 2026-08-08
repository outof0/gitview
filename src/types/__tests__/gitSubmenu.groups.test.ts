import { describe, expect, it } from "vitest";
import {
  GIT_SUBMENU_ITEMS,
  gitSubmenuGroupKey,
  gitSubmenuSectionLabel,
} from "../gitSubmenu";

describe("gitSubmenu groups", () => {
  it("keeps temporary work under 5_vcs and integrate under 6_integrate", () => {
    const byAction = Object.fromEntries(
      GIT_SUBMENU_ITEMS.map((item) => [item.action, item.group]),
    );
    expect(gitSubmenuGroupKey(byAction.stash!)).toBe("5_vcs");
    expect(gitSubmenuGroupKey(byAction.shelve!)).toBe("5_vcs");
    expect(gitSubmenuGroupKey(byAction.checkoutBranch!)).toBe("5_vcs");
    expect(gitSubmenuGroupKey(byAction.merge!)).toBe("6_integrate");
    expect(gitSubmenuGroupKey(byAction.rebase!)).toBe("6_integrate");
  });

  it("maps group keys to section labels for webview menus", () => {
    expect(gitSubmenuSectionLabel("1_history")).toBe("History");
    expect(gitSubmenuSectionLabel("5_vcs")).toBe("Branch & temporary work");
    expect(gitSubmenuSectionLabel("6_integrate")).toBe("Integrate");
    expect(gitSubmenuSectionLabel("unknown")).toBeNull();
  });
});
