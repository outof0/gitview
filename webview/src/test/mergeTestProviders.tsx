import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import {
  MergeClientProvider,
  installMergeTestClient,
  mergeTestOutbound,
} from "../hooks/merge/mergeClientContext";
import { __resetVsCodeApiForTests } from "../hooks/useVsCodeApi";

export function setupMergeTestBootstrap(repoId = "test-repo"): void {
  installMergeTestClient(repoId);
  __resetVsCodeApiForTests();
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: (msg: unknown) =>
      mergeTestOutbound.push(
        msg as {
          type: string;
          payload?: unknown;
          protocolVersion?: number;
          requestId?: string;
        },
      ),
    getState: () => null,
    setState: () => {},
  });
}

export function MergeTestProviders({ children }: { children: ReactNode }) {
  return <MergeClientProvider>{children}</MergeClientProvider>;
}

export function renderWithMerge(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
  repoId = "test-repo",
) {
  setupMergeTestBootstrap(repoId);
  return render(ui, {
    wrapper: ({ children }) => (
      <MergeClientProvider>{children}</MergeClientProvider>
    ),
    ...options,
  });
}