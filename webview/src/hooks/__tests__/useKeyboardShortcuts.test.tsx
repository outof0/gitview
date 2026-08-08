// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMergeDocument } from "../../../../src/core/mergeDocument";
import type { MergeDocument } from "../../../../src/core/types";
import { useGitViewStore } from "../../stores/gitViewStore";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";
import { __resetVsCodeApiForTests } from "../useVsCodeApi";
import {
  findMergeTestMessage,
  installMergeTestClient,
  mergeTestOutbound,
} from "../merge/mergeClientContext";

function makeDoc(): MergeDocument {
  return buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "src/app.ts",
    absolutePath: "/repo/src/app.ts",
    base: "a\nb\nc\n",
    ours: "a\nours\nc\n",
    theirs: "a\ntheirs\nc\n",
    worktree: "a\nours\nc\n",
    now: 1,
  });
}

function makeMultiChangeDoc(): MergeDocument {
  return buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "src/multi.ts",
    absolutePath: "/repo/src/multi.ts",
    base: "a\nb\nc\nd\n",
    ours: "a\nours-b\nc\nours-d\n",
    theirs: "a\ntheirs-b\nc\ntheirs-d\n",
    worktree: "a\nours-b\nc\nours-d\n",
    now: 1,
  });
}

function press(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

beforeEach(() => {
  installMergeTestClient("test-repo");
  __resetVsCodeApiForTests();
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: () => {},
    getState: () => null,
    setState: () => {},
  });
  vi.stubGlobal("confirm", vi.fn(() => true));
  useGitViewStore.setState({
    activeDocument: null,
    activeBlockId: null,
    undoStack: [],
    redoStack: [],
    statusMessage: null,
    confirmBeforeMarkResolved: false,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  __resetVsCodeApiForTests();
});

describe("useKeyboardShortcuts", () => {
  it("Ctrl+Enter refuses to apply while conflicts are unresolved", () => {
    useGitViewStore.setState({ activeDocument: makeDoc() });
    renderHook(() => useKeyboardShortcuts());

    press("Enter", { ctrlKey: true });

    expect(
      mergeTestOutbound.some((m) => m.type === "merge.markResolved"),
    ).toBe(false);
    expect(useGitViewStore.getState().statusMessage).toBe(
      "Resolve all conflicts before applying.",
    );
  });

  it("Ctrl+Enter posts resolved content for host-side confirm", () => {
    const doc = makeDoc();
    useGitViewStore.setState({ activeDocument: doc });
    useGitViewStore.getState().acceptAllTheirs();
    renderHook(() => useKeyboardShortcuts());

    press("Enter", { ctrlKey: true });

    const resolved = findMergeTestMessage("merge.markResolved");
    expect(resolved).toBeDefined();
    expect(resolved?.payload).toMatchObject({
      path: "src/app.ts",
      content: "a\ntheirs\nc\n",
    });
  });

  it("Ctrl+S refuses to apply while conflicts are unresolved", () => {
    useGitViewStore.setState({ activeDocument: makeDoc() });
    renderHook(() => useKeyboardShortcuts());

    press("s", { ctrlKey: true });

    expect(
      mergeTestOutbound.some((m) => m.type === "merge.markResolved"),
    ).toBe(false);
    expect(useGitViewStore.getState().statusMessage).toBe(
      "Resolve all conflicts before applying.",
    );
  });

  it("Ctrl+S posts resolved content when conflicts are clean", () => {
    const doc = makeDoc();
    useGitViewStore.setState({
      activeDocument: doc,
    });
    useGitViewStore.getState().acceptAllTheirs();
    renderHook(() => useKeyboardShortcuts());

    press("s", { ctrlKey: true });

    const resolved = findMergeTestMessage("merge.markResolved");
    expect(resolved).toBeDefined();
    expect(resolved?.payload).toMatchObject({
      path: "src/app.ts",
      content: "a\ntheirs\nc\n",
    });
  });

  it("F7 moves to the next difference", () => {
    const doc = makeMultiChangeDoc();
    const navigable = doc.blocks.filter((b) => b.kind !== "unchanged");
    const first = navigable[0]?.id;
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: first });
    renderHook(() => useKeyboardShortcuts());

    press("F7");

    expect(useGitViewStore.getState().activeBlockId).not.toBe(first);
  });

  it("F7 invokes blockScrollIntoView for the new active block", () => {
    const doc = makeMultiChangeDoc();
    const navigable = doc.blocks.filter((b) => b.kind !== "unchanged");
    const first = navigable[0]?.id;
    const scrolled: string[] = [];
    useGitViewStore.setState({
      activeDocument: doc,
      activeBlockId: first,
      blockScrollIntoView: (id) => scrolled.push(id),
    });
    renderHook(() => useKeyboardShortcuts());

    press("F7");

    expect(scrolled).toEqual([useGitViewStore.getState().activeBlockId]);
  });

  it("Shift+F7 moves to the previous difference", () => {
    const doc = makeMultiChangeDoc();
    const navigable = doc.blocks.filter((b) => b.kind !== "unchanged");
    const last = navigable[navigable.length - 1]?.id;
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: last });
    renderHook(() => useKeyboardShortcuts());

    press("F7", { shiftKey: true });

    expect(useGitViewStore.getState().activeBlockId).not.toBe(last);
  });

  it("Alt+ArrowDown jumps to the next unresolved conflict", () => {
    const doc = makeDoc();
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: doc.conflictOrder[0] });
    renderHook(() => useKeyboardShortcuts());

    press("ArrowDown", { altKey: true });

    expect(useGitViewStore.getState().activeBlockId).toBeTruthy();
  });

  it("does not run merge undo when focus is inside Monaco", () => {
    const doc = makeDoc();
    const conflictId = doc.conflictOrder[0]!;
    useGitViewStore.getState().applyAcceptSide(conflictId, "ours");
    useGitViewStore.setState({ activeDocument: useGitViewStore.getState().activeDocument });
    const before = useGitViewStore.getState().activeDocument;
    useGitViewStore.setState({ activeBlockId: conflictId });
    renderHook(() => useKeyboardShortcuts());

    const monaco = document.createElement("div");
    monaco.className = "monaco-editor";
    const inner = document.createElement("div");
    inner.setAttribute("contenteditable", "true");
    monaco.appendChild(inner);
    document.body.appendChild(monaco);
    inner.focus();

    press("z", { ctrlKey: true });

    expect(useGitViewStore.getState().activeDocument).toBe(before);
    document.body.removeChild(monaco);
  });

  it("Alt+1 accepts only the local side of the active conflict", () => {
    const doc = makeDoc();
    const conflictId = doc.conflictOrder[0];
    useGitViewStore.setState({ activeDocument: doc, activeBlockId: conflictId });
    renderHook(() => useKeyboardShortcuts());

    press("1", { altKey: true });

    const block = useGitViewStore
      .getState()
      .activeDocument?.blocks.find((b) => b.id === conflictId);
    expect(block?.status).toBe("unresolved");
    expect(block?.resultText).toBe("ours");
    expect(block?.metadata.conflict).toEqual({
      ours: "accepted",
      theirs: "pending",
      acceptedOrder: ["ours"],
    });
  });

  it("Escape closes search before attempting to leave the resolver", () => {
    const doc = makeDoc();
    useGitViewStore.setState({
      activeDocument: { ...doc, dirty: true },
      searchOpen: true,
    });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    renderHook(() => useKeyboardShortcuts());

    press("Escape");

    expect(useGitViewStore.getState().searchOpen).toBe(false);
    expect(useGitViewStore.getState().activeDocument?.relativePath).toBe(
      "src/app.ts",
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it("Escape requests host confirm when the document is dirty", () => {
    const doc = makeDoc();
    const discardRequests: Array<{ action: string }> = [];
    useGitViewStore.setState({
      activeDocument: { ...doc, dirty: true },
      confirmDiscard: (action) => discardRequests.push(action),
    });
    renderHook(() => useKeyboardShortcuts());

    press("Escape");

    expect(discardRequests).toEqual([{ action: "backToList" }]);
    expect(useGitViewStore.getState().activeDocument?.relativePath).toBe(
      "src/app.ts",
    );
  });
});
