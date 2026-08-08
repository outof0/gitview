import { describe, it, expect, beforeEach } from "vitest";
import { useGitViewStore } from "../stores/gitViewStore";
import { makeTestDoc } from "./gitViewStore.testHelpers";

describe("gitViewStore navigation scroll", () => {
  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      blockScrollIntoView: null,
    });
  });

  it("goToNextChange invokes blockScrollIntoView with the new block id", () => {
    const doc = makeTestDoc(
      "a\nb\nc\nd\n",
      "a\nours-b\nc\nours-d\n",
      "a\ntheirs-b\nc\ntheirs-d\n",
    );
    const scrolled: string[] = [];
    useGitViewStore.setState({
      activeDocument: doc,
      activeBlockId: doc.changeOrder[0],
      blockScrollIntoView: (id) => scrolled.push(id),
    });

    useGitViewStore.getState().goToNextChange();

    expect(useGitViewStore.getState().activeBlockId).toBe(doc.changeOrder[1]);
    expect(scrolled).toEqual([doc.changeOrder[1]]);
  });
});
