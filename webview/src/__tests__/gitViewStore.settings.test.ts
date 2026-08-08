import { describe, it, expect, beforeEach } from "vitest";
import { useGitViewStore } from "../stores/gitViewStore";
import {
  DEFAULT_GITVIEW_SETTINGS,
  type GitViewSettings,
} from "@gitview/types";
import { makeTestDoc } from "./gitViewStore.testHelpers";

describe("gitViewStore resolution actions", () => {
  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      undoStack: [],
      redoStack: [],
      screen: "conflictList",
    });
  });

  describe("remainingConflicts", () => {
    it("counts unresolved conflicts", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const initial = useGitViewStore.getState().remainingConflicts();
      expect(initial).toBeGreaterThan(0);

      // Resolve all
      useGitViewStore.getState().acceptAllOurs();
      const after = useGitViewStore.getState().remainingConflicts();
      expect(after).toBe(0);
    });
  });

  describe("isFullyResolved", () => {
    it("returns false when conflicts exist", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });
      expect(useGitViewStore.getState().isFullyResolved()).toBe(false);
    });

    it("returns true after all resolved", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });
      useGitViewStore.getState().acceptAllOurs();
      expect(useGitViewStore.getState().isFullyResolved()).toBe(true);
    });
  });

  describe("applySettings", () => {
    const baseState = () => ({
      acceptBothOrder: "oursFirst" as const,
      showBase: false,
      whitespacePolicy: "doNotIgnore" as const,
      highlightingMode: "lines" as const,
      enableScrollSync: true,
      warnOnCrlf: true,
      confirmBeforeMarkResolved: false,
      goToNextFileAfterLastChange: true,
    });

    beforeEach(() => {
      useGitViewStore.setState(baseState());
    });

    it("maps host settings into store UI fields", () => {
      const settings: GitViewSettings = {
        ...DEFAULT_GITVIEW_SETTINGS,
        acceptBothOrder: "theirsFirst",
        showBasePanel: true,
        whitespacePolicy: "trimWhitespaces",
        highlightingMode: "words",
        enableScrollSync: false,
        warnOnCrlf: false,
        confirmBeforeMarkResolved: false,
        goToNextFileAfterLastChange: false,
      };

      useGitViewStore.getState().applySettings(settings);

      const state = useGitViewStore.getState();
      expect(state.acceptBothOrder).toBe("theirsFirst");
      expect(state.showBase).toBe(true);
      expect(state.whitespacePolicy).toBe("trimWhitespaces");
      expect(state.highlightingMode).toBe("words");
      expect(state.enableScrollSync).toBe(false);
      expect(state.warnOnCrlf).toBe(false);
      expect(state.confirmBeforeMarkResolved).toBe(false);
      expect(state.goToNextFileAfterLastChange).toBe(false);
    });

    it("downgrades words highlighting when showWordLevelDiff is disabled", () => {
      useGitViewStore.getState().applySettings({
        ...DEFAULT_GITVIEW_SETTINGS,
        showWordLevelDiff: false,
        highlightingMode: "words",
      });
      expect(useGitViewStore.getState().highlightingMode).toBe("lines");
    });
  });

  describe("toolbar option setters", () => {
    it("sets whitespace policy and highlighting mode", () => {
      useGitViewStore.getState().setWhitespacePolicy("trimWhitespaces");
      useGitViewStore.getState().setHighlightingMode("lines");
      expect(useGitViewStore.getState().whitespacePolicy).toBe("trimWhitespaces");
      expect(useGitViewStore.getState().highlightingMode).toBe("lines");
    });

    it("toggles showBase, conflicts navigation, and details", () => {
      const before = useGitViewStore.getState().showBase;
      useGitViewStore.getState().toggleShowBase();
      expect(useGitViewStore.getState().showBase).toBe(!before);
      useGitViewStore.getState().toggleConflictsNavigation();
      expect(useGitViewStore.getState().showConflictsNavigation).toBe(true);
      useGitViewStore.getState().toggleShowDetails();
      expect(useGitViewStore.getState().showDetails).toBe(true);
    });
  });
});
