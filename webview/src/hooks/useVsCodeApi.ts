import { useCallback } from "react";

type VSCodeApi = {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

declare function acquireVsCodeApi(): VSCodeApi;

// Global cached instance of the VS Code API
let vscodeApi: VSCodeApi | null = null;

/** Test-only: clear cached API so acquireVsCodeApi can be re-stubbed. */
export function __resetVsCodeApiForTests(): void {
  vscodeApi = null;
}

export function useVsCodeApi() {
  if (!vscodeApi) {
    try {
      vscodeApi = acquireVsCodeApi();
    } catch {
      // Outside VS Code (e.g. tests). Browser dev uses playground.html which
      // installs acquireVsCodeApi before React mounts — see src/dev/bootstrap.tsx.
      vscodeApi = {
        postMessage: (msg: unknown) => {
          console.warn("[gitview] postMessage dropped — no VS Code API:", msg);
        },
        getState: () => null,
        setState: () => {},
      };
    }
  }

  const postMessage = useCallback(
    (msg: unknown) => vscodeApi?.postMessage(msg),
    [],
  );

  const getState = useCallback(() => vscodeApi?.getState() ?? null, []);

  const setState = useCallback(
    (state: unknown) => vscodeApi?.setState(state),
    [],
  );

  return { postMessage, getState, setState };
}
