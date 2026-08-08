import { createContext, useContext, type ReactNode } from "react";
import { createProtocolClient } from "../../protocol/client";
import { useMergeClient } from "./useMergeClient";

type MergeClientValue = ReturnType<typeof useMergeClient>;

const MergeClientContext = createContext<MergeClientValue | null>(null);

let testFallbackClient: MergeClientValue | null = null;

/** Captures outbound v1 messages from installMergeTestClient / test fallback client. */
export const mergeTestOutbound: Array<{
  type: string;
  payload?: unknown;
  protocolVersion?: number;
  requestId?: string;
}> = [];

export function findMergeTestMessage(type: string) {
  return mergeTestOutbound.find((m) => m.type === type);
}

export function installMergeTestClient(repoId = "test-repo"): MergeClientValue {
  window.__GITVIEW_BOOTSTRAP__ = { repoId };
  mergeTestOutbound.length = 0;
  testFallbackClient = {
    ...createProtocolClient((msg) =>
      mergeTestOutbound.push(
        msg as {
          type: string;
          payload?: unknown;
          protocolVersion?: number;
          requestId?: string;
        },
      ),
    ),
    repoId,
    clientRef: { current: null as never },
  };
  testFallbackClient.clientRef.current = testFallbackClient as never;
  return testFallbackClient;
}

export function MergeClientProvider({ children }: { children: ReactNode }) {
  const client = useMergeClient();
  return (
    <MergeClientContext.Provider value={client}>
      {children}
    </MergeClientContext.Provider>
  );
}

/**
 * For surfaces that already own a protocol client and a repo id — the Git
 * panel embeds the resolver, so it must not open a second request channel.
 */
export function MergeClientValueProvider({
  value,
  children,
}: {
  value: MergeClientValue;
  children: ReactNode;
}) {
  return (
    <MergeClientContext.Provider value={value}>
      {children}
    </MergeClientContext.Provider>
  );
}

export function useMergeClientContext(): MergeClientValue {
  const ctx = useContext(MergeClientContext);
  if (ctx) {
    return ctx;
  }
  if (import.meta.env.MODE === "test") {
    if (!testFallbackClient) {
      return installMergeTestClient();
    }
    return testFallbackClient;
  }
  throw new Error("useMergeClientContext requires MergeClientProvider");
}