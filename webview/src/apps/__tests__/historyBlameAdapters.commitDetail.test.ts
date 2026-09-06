import { describe, expect, it, beforeEach, vi } from "vitest";
import { useGitHistoryStore } from "../../stores/gitHistoryStore";
import { requestCommitDetail } from "../historyBlameAdapters";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function commitEntry(sha: string, subject: string) {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    author: "A",
    authorEmail: "a@example.com",
    authorTime: 1,
    subject,
    changedFiles: [],
  };
}

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

describe("requestCommitDetail", () => {
  beforeEach(() => {
    useGitHistoryStore.setState({
      annotateMode: true,
      commits: [],
      selectedSha: null,
      commitDetailLoading: false,
      error: null,
    });
  });

  it("drops a late response for a deselected commit", async () => {
    const gate = deferred<{ commit?: ReturnType<typeof commitEntry> }>();
    const client = { commitDetail: vi.fn(() => gate.promise) };
    const store = useGitHistoryStore.getState();

    store.selectCommit(SHA_A);
    requestCommitDetail(client, "r1", SHA_A);
    store.selectCommit(SHA_B);

    gate.resolve({ commit: commitEntry(SHA_A, "stale detail") });
    await gate.promise.catch(() => {});
    await Promise.resolve();

    const state = useGitHistoryStore.getState();
    expect(state.selectedSha).toBe(SHA_B);
    expect(state.commits.some((c) => c.sha === SHA_A)).toBe(false);
  });

  it("applies the response for the current selection", async () => {
    const gate = deferred<{ commit?: ReturnType<typeof commitEntry> }>();
    const client = { commitDetail: vi.fn(() => gate.promise) };
    const store = useGitHistoryStore.getState();

    store.selectCommit(SHA_B);
    expect(useGitHistoryStore.getState().commitDetailLoading).toBe(true);
    requestCommitDetail(client, "r1", SHA_B);

    gate.resolve({ commit: commitEntry(SHA_B, "fresh detail") });
    await gate.promise.catch(() => {});
    await Promise.resolve();

    const state = useGitHistoryStore.getState();
    expect(state.selectedSha).toBe(SHA_B);
    expect(
      state.commits.find((c) => c.sha === SHA_B)?.subject,
    ).toBe("fresh detail");
    expect(state.commitDetailLoading).toBe(false);
  });

  it("ignores a stale rejection without sticking loading on", async () => {
    const gate = deferred<never>();
    const client = { commitDetail: vi.fn(() => gate.promise) };
    const store = useGitHistoryStore.getState();

    store.selectCommit(SHA_A);
    requestCommitDetail(client, "r1", SHA_A);
    store.selectCommit(SHA_B);

    gate.reject(new Error("timed out"));
    await gate.promise.catch(() => {});
    await Promise.resolve();

    const state = useGitHistoryStore.getState();
    expect(state.error).toBeNull();
    // B's own request is still in flight: loading stays on for B, not stuck
    // because of A.
    expect(state.commitDetailLoading).toBe(true);
  });

  it("reports a rejection for the current selection and clears loading", async () => {
    const gate = deferred<never>();
    const client = { commitDetail: vi.fn(() => gate.promise) };
    const store = useGitHistoryStore.getState();

    store.selectCommit(SHA_A);
    requestCommitDetail(client, "r1", SHA_A);

    gate.reject(new Error("timed out"));
    await gate.promise.catch(() => {});
    await Promise.resolve();

    const state = useGitHistoryStore.getState();
    expect(state.error).toBe("timed out");
    expect(state.commitDetailLoading).toBe(false);
  });
});
