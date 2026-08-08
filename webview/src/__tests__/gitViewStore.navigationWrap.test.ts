import { describe, it, expect, beforeEach } from "vitest";
import { useGitViewStore } from "../stores/gitViewStore";
import { makeTestDoc } from "./gitViewStore.testHelpers";

describe("gitViewStore navigation wrap", () => {
  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      blockScrollIntoView: null,
      conflictFiles: [],
      goToNextFileAfterLastChange: false,
      openConflictFile: null,
      pendingChangeNavigation: null,
    });
  });

  it("goToNextChange wraps from the last change to the first when next-file setting is off", () => {
    const doc = makeTestDoc(
      "a\nb\nc\nd\n",
      "a\nours-b\nc\nours-d\n",
      "a\ntheirs-b\nc\ntheirs-d\n",
    );
    const last = doc.changeOrder[doc.changeOrder.length - 1];
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: last });

    useGitViewStore.getState().goToNextChange();

    expect(useGitViewStore.getState().activeBlockId).toBe(doc.changeOrder[0]);
  });

  it("goToPreviousChange wraps from the first change to the last when next-file setting is off", () => {
    const doc = makeTestDoc(
      "a\nb\nc\nd\n",
      "a\nours-b\nc\nours-d\n",
      "a\ntheirs-b\nc\ntheirs-d\n",
    );
    const first = doc.changeOrder[0];
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: first });

    useGitViewStore.getState().goToPreviousChange();

    expect(useGitViewStore.getState().activeBlockId).toBe(
      doc.changeOrder[doc.changeOrder.length - 1],
    );
  });
});
