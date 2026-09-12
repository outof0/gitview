/**
 * Activity-bar GitView click: keep the Commit sidebar and also open the Git
 * log panel. Closing the sidebar here is what made the Commit view flash and
 * disappear — focusing the panel view can hide the activity-bar container.
 */
export function createGitViewLauncherVisibilityHandler(deps: {
  isVisible: () => boolean;
  isPanelVisible?: () => boolean;
  focusBottomPanel: (options: { keepSidebar: boolean }) => Promise<void>;
  focusRoot: () => Promise<void>;
  showSidebar: (preserveFocus: boolean) => void;
}): () => Promise<void> {
  let opening = false;
  let openedPanel = false;
  return async () => {
    if (!deps.isVisible() || opening) {
      return;
    }
    opening = true;
    try {
      if (!openedPanel || !(deps.isPanelVisible?.() ?? true)) {
        openedPanel = true;
        await deps.focusBottomPanel({ keepSidebar: true });
      }
      await deps.focusRoot();
      if (!deps.isVisible()) {
        deps.showSidebar(true);
      }
    } finally {
      opening = false;
    }
  };
}
