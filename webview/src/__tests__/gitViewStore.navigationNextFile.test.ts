import { describe, it, expect, beforeEach } from "vitest";
import { useGitViewStore } from "../stores/gitViewStore";
import { makeTestDoc } from "./gitViewStore.testHelpers";

describe("gitViewStore navigation next file", () => {
  const opened: string[] = [];

  beforeEach(() => {
    opened.length = 0;
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      blockScrollIntoView: null,
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "UU" },
      ],
      goToNextFileAfterLastChange: true,
      openConflictFile: (path) => opened.push(path),
      pendingChangeNavigation: null,
    });
  });

  it("goToNextChange at the last change opens the next conflict file", () => {
    const doc = {
      ...makeTestDoc(
        "a\nb\nc\nd\n",
        "a\nours-b\nc\nours-d\n",
        "a\ntheirs-b\nc\ntheirs-d\n",
      ),
      relativePath: "src/a.ts",
    };
    const last = doc.changeOrder[doc.changeOrder.length - 1];
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: last });

    useGitViewStore.getState().goToNextChange();

    expect(opened).toEqual(["src/b.ts"]);
    expect(useGitViewStore.getState().pendingChangeNavigation).toBe("first");
  });

  it("goToPreviousChange at the first change opens the previous conflict file", () => {
    const doc = {
      ...makeTestDoc(
        "a\nb\nc\nd\n",
        "a\nours-b\nc\nours-d\n",
        "a\ntheirs-b\nc\ntheirs-d\n",
      ),
      relativePath: "src/b.ts",
    };
    const first = doc.changeOrder[0];
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: first });

    useGitViewStore.getState().goToPreviousChange();

    expect(opened).toEqual(["src/a.ts"]);
    expect(useGitViewStore.getState().pendingChangeNavigation).toBe("last");
  });

  it("goToNextChange does not request discard when the current file is dirty", () => {
    const discardRequests: Array<Record<string, unknown>> = [];
    const doc = {
      ...makeTestDoc(
        "a\nb\nc\nd\n",
        "a\nours-b\nc\nours-d\n",
        "a\ntheirs-b\nc\ntheirs-d\n",
      ),
      relativePath: "src/a.ts",
      dirty: true,
    };
    const last = doc.changeOrder[doc.changeOrder.length - 1];
    useGitViewStore.setState({
      activeDocument: doc,
      activeBlockId: last,
      confirmDiscard: (action) => discardRequests.push(action),
    });

    useGitViewStore.getState().goToNextChange();

    expect(discardRequests).toEqual([]);
    expect(opened).toEqual([]);
    expect(useGitViewStore.getState().activeBlockId).toBe(doc.changeOrder[0]);
  });

  it("setActiveDocument selects the first change after opening the next file", () => {
    const nextDoc = {
      ...makeTestDoc("x\ny\n", "x\nours-y\n", "x\ntheirs-y\n"),
      relativePath: "src/b.ts",
    };
    useGitViewStore.setState({ pendingChangeNavigation: "first" });

    useGitViewStore.getState().setActiveDocument(nextDoc);

    expect(useGitViewStore.getState().activeBlockId).toBe(nextDoc.changeOrder[0]);
    expect(useGitViewStore.getState().pendingChangeNavigation).toBeNull();
  });
});
