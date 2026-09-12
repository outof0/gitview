import { describe, expect, it, vi } from "vitest";
import { createGitViewLauncherVisibilityHandler } from "../gitViewLauncher";

describe("createGitViewLauncherVisibilityHandler", () => {
  it("opens the log panel without closing the sidebar, then re-reveals if hidden", async () => {
    const visible = { value: true };
    const focusBottomPanel = vi.fn(async () => {
      visible.value = false;
    });
    const focusRoot = vi.fn(async () => undefined);
    const showSidebar = vi.fn((preserveFocus: boolean) => {
      expect(preserveFocus).toBe(true);
      visible.value = true;
    });

    const onVisible = createGitViewLauncherVisibilityHandler({
      isVisible: () => visible.value,
      focusBottomPanel,
      focusRoot,
      showSidebar,
    });

    await onVisible();

    expect(focusBottomPanel).toHaveBeenCalledWith({ keepSidebar: true });
    expect(focusRoot).toHaveBeenCalledTimes(1);
    expect(showSidebar).toHaveBeenCalledWith(true);

    await onVisible();
    expect(focusBottomPanel).toHaveBeenCalledTimes(1);
    expect(focusRoot).toHaveBeenCalledTimes(2);
  });

  it("does not close or re-show when the sidebar stayed visible", async () => {
    const focusBottomPanel = vi.fn(async () => undefined);
    const focusRoot = vi.fn(async () => undefined);
    const showSidebar = vi.fn();
    const onVisible = createGitViewLauncherVisibilityHandler({
      isVisible: () => true,
      focusBottomPanel,
      focusRoot,
      showSidebar,
    });

    await onVisible();

    expect(focusBottomPanel).toHaveBeenCalledWith({ keepSidebar: true });
    expect(focusRoot).toHaveBeenCalledTimes(1);
    expect(showSidebar).not.toHaveBeenCalled();
  });

  it("ignores a second reveal while the first is still opening the panel", async () => {
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const focusBottomPanel = vi.fn(async () => blocked);
    const focusRoot = vi.fn(async () => undefined);
    const showSidebar = vi.fn();
    const onVisible = createGitViewLauncherVisibilityHandler({
      isVisible: () => true,
      focusBottomPanel,
      focusRoot,
      showSidebar,
    });

    const first = onVisible();
    await onVisible();
    release();
    await first;

    expect(focusBottomPanel).toHaveBeenCalledTimes(1);
  });

  it("reopens the panel after it was closed", async () => {
    const panel = { visible: true };
    const focusBottomPanel = vi.fn(async () => undefined);
    const onVisible = createGitViewLauncherVisibilityHandler({
      isVisible: () => true,
      isPanelVisible: () => panel.visible,
      focusBottomPanel,
      focusRoot: vi.fn(async () => undefined),
      showSidebar: vi.fn(),
    });

    await onVisible();
    panel.visible = false;
    await onVisible();

    expect(focusBottomPanel).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the launcher is not visible", async () => {
    const focusBottomPanel = vi.fn(async () => undefined);
    const focusRoot = vi.fn(async () => undefined);
    const onVisible = createGitViewLauncherVisibilityHandler({
      isVisible: () => false,
      focusBottomPanel,
      focusRoot,
      showSidebar: vi.fn(),
    });

    await onVisible();

    expect(focusBottomPanel).not.toHaveBeenCalled();
  });
});
