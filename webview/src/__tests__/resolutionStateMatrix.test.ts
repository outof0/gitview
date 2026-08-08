import { describe, it, expect, beforeEach } from "vitest";
import { useGitViewStore } from "../stores/gitViewStore";
import {
  applyManualToBlock,
  makeTestDoc,
  conflictId,
  blockOf,
  type MatrixExpect,
} from "./resolutionStateMatrix.helpers";

describe("resolution state matrix (GitView workflow coverage)", () => {
  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      undoStack: [],
      redoStack: [],
      screen: "conflictList",
    });
  });

  const cases: Array<{
    name: string;
    setup: (doc: ReturnType<typeof makeTestDoc>) => void;
    expect: MatrixExpect;
  }> = [
    {
      name: "unresolved (initial)",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
      },
      expect: {
        status: "unresolved",
        resultContains: "line2",
        remaining: 1,
        side: { ours: "pending", theirs: "pending", acceptedOrder: [] },
      },
    },
    {
      name: "accept local",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        useGitViewStore.getState().applyAcceptSide(conflictId(doc), "ours");
      },
      expect: {
        status: "unresolved",
        resultContains: "ours-changed",
        remaining: 1,
        side: { ours: "accepted", theirs: "pending", acceptedOrder: ["ours"] },
      },
    },
    {
      name: "accept repository",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        useGitViewStore.getState().applyAcceptSide(conflictId(doc), "theirs");
      },
      expect: {
        status: "unresolved",
        resultContains: "theirs-changed",
        remaining: 1,
        side: {
          ours: "pending",
          theirs: "accepted",
          acceptedOrder: ["theirs"],
        },
      },
    },
    {
      name: "append on fresh conflict is no-op",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        useGitViewStore.getState().applyAppendSide(conflictId(doc), "theirs");
      },
      expect: {
        status: "unresolved",
        resultContains: "line2",
        remaining: 1,
        side: { ours: "pending", theirs: "pending", acceptedOrder: [] },
      },
    },
    {
      name: "accept both via append after local",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        const id = conflictId(doc);
        useGitViewStore.getState().applyAcceptSide(id, "ours");
        useGitViewStore.getState().applyAppendSide(id, "theirs");
      },
      expect: {
        status: "accepted_both",
        resultContains: "ours-changed",
        remaining: 0,
        side: {
          ours: "accepted",
          theirs: "accepted",
          acceptedOrder: ["ours", "theirs"],
        },
      },
    },
    {
      name: "accept both via append after repository",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        const id = conflictId(doc);
        useGitViewStore.getState().applyAcceptSide(id, "theirs");
        useGitViewStore.getState().applyAppendSide(id, "ours");
      },
      expect: {
        status: "accepted_both",
        resultContains: "theirs-changed",
        remaining: 0,
        side: {
          ours: "accepted",
          theirs: "accepted",
          acceptedOrder: ["theirs", "ours"],
        },
      },
    },
    {
      name: "accept both via applyAcceptBoth",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        useGitViewStore.getState().applyAcceptBoth(conflictId(doc));
      },
      expect: {
        status: "accepted_both",
        resultContains: "ours-changed",
        remaining: 0,
        side: {
          ours: "accepted",
          theirs: "accepted",
          acceptedOrder: ["ours", "theirs"],
        },
      },
    },
    {
      name: "append local after accepting repository",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        const id = conflictId(doc);
        useGitViewStore.getState().applyAcceptSide(id, "theirs");
        useGitViewStore.getState().applyAppendSide(id, "ours");
      },
      expect: {
        status: "accepted_both",
        resultContains: "theirs-changed",
        remaining: 0,
        side: {
          ours: "accepted",
          theirs: "accepted",
          acceptedOrder: ["theirs", "ours"],
        },
      },
    },
    {
      name: "ignore local",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        useGitViewStore.getState().applyIgnore(conflictId(doc), "ours");
      },
      expect: {
        status: "unresolved",
        resultContains: "line2",
        remaining: 1,
        side: { ours: "ignored", theirs: "pending", acceptedOrder: [] },
      },
    },
    {
      name: "ignore repository",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        useGitViewStore.getState().applyIgnore(conflictId(doc), "theirs");
      },
      expect: {
        status: "unresolved",
        resultContains: "line2",
        remaining: 1,
        side: { ours: "pending", theirs: "ignored", acceptedOrder: [] },
      },
    },
    {
      name: "ignore both",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        const id = conflictId(doc);
        useGitViewStore.getState().applyIgnore(id, "ours");
        useGitViewStore.getState().applyIgnore(id, "theirs");
      },
      expect: {
        status: "resolved",
        resultContains: "line2",
        remaining: 0,
        side: { ours: "ignored", theirs: "ignored", acceptedOrder: [] },
      },
    },
    {
      name: "manual edit",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        applyManualToBlock(doc, conflictId(doc), "manual-line");
      },
      expect: {
        status: "manual",
        resultContains: "manual-line",
        remaining: 0,
        side: null,
      },
    },
    {
      name: "reset after accept local",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        const id = conflictId(doc);
        useGitViewStore.getState().applyAcceptSide(id, "ours");
        useGitViewStore.getState().applyResetConflict(id);
      },
      expect: {
        status: "unresolved",
        resultContains: "line2",
        remaining: 1,
        side: { ours: "pending", theirs: "pending", acceptedOrder: [] },
      },
    },
    {
      name: "reset after manual edit",
      setup: (doc) => {
        useGitViewStore.setState({ activeDocument: doc });
        const id = conflictId(doc);
        applyManualToBlock(doc, id, "manual-line");
        useGitViewStore.getState().applyResetConflict(id);
      },
      expect: {
        status: "unresolved",
        resultContains: "line2",
        remaining: 1,
        side: { ours: "pending", theirs: "pending", acceptedOrder: [] },
      },
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const doc = makeTestDoc(
        "line1\nline2\nline3\n",
        "line1\nours-changed\nline3\n",
        "line1\ntheirs-changed\nline3\n",
      );
      tc.setup(doc);

      const id = conflictId(useGitViewStore.getState().activeDocument!);
      const block = blockOf(useGitViewStore.getState().activeDocument!, id);

      expect(block.status).toBe(tc.expect.status);
      expect(block.resultText).toContain(tc.expect.resultContains);
      expect(useGitViewStore.getState().remainingConflicts()).toBe(
        tc.expect.remaining,
      );

      if (tc.expect.side) {
        expect(block.metadata.conflict).toEqual(tc.expect.side);
      }

      if (tc.expect.remaining === 0) {
        const serialized = useGitViewStore.getState().getResultText();
        expect(serialized).not.toMatch(/<<<<<<<|=======|>>>>>>>/);
      }
    });
  }
});