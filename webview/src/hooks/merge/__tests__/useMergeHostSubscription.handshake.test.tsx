// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useGitViewStore } from "../../../stores/gitViewStore";
import type { createProtocolClient } from "../../../protocol/client";
import { useMergeHostSubscription } from "../useMergeHostSubscription";

type MergeClient = ReturnType<typeof createProtocolClient> & { repoId: string };

/**
 * Only `ready` is exercised. The rest of the client is unreachable from this
 * effect — no host message is dispatched, so no request is ever issued.
 */
function clientWithHandshake(ready: () => Promise<unknown>): MergeClient {
  return {
    ready,
    request: (() => Promise.reject(new Error("not used"))) as never,
    handleHostMessage: () => false,
    repoId: "repo-1",
  } as unknown as MergeClient;
}

function Probe({ client }: { client: MergeClient }) {
  useMergeHostSubscription(client);
  return null;
}

beforeEach(() => {
  useGitViewStore.setState({ loading: true, error: null });
});

afterEach(() => {
  cleanup();
  useGitViewStore.setState({ loading: false, error: null });
});

describe("useMergeHostSubscription handshake", () => {
  // Regression: this used to be `void client.ready("merge")`. A rejected
  // handshake was an unhandled rejection — the panel stayed on "Loading" with
  // no error, no toast, and nothing in the log. The host pushes the merge
  // bootstrap while answering the handshake, so there was no second chance.
  it("surfaces a rejected handshake instead of leaving it unhandled", async () => {
    const client = clientWithHandshake(() =>
      Promise.reject(new Error("host exploded")),
    );

    await act(async () => {
      render(<Probe client={client} />);
    });

    expect(useGitViewStore.getState().error).toBe("host exploded");
    expect(useGitViewStore.getState().loading).toBe(false);
  });

  it("leaves the error state alone when the handshake succeeds", async () => {
    const client = clientWithHandshake(() => Promise.resolve(undefined));

    await act(async () => {
      render(<Probe client={client} />);
    });

    expect(useGitViewStore.getState().error).toBeNull();
  });
});
