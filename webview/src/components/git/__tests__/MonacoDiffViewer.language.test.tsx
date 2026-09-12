// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createFakeMonaco } from "../../../test/fakeMonaco";
import { MonacoDiffViewer } from "../MonacoDiffViewer";

const monacoSetupMocks = vi.hoisted(() => ({
  getMonacoIfLoaded: vi.fn(),
  loadMonaco: vi.fn(),
}));

vi.mock("../../merge/monacoSetup", () => monacoSetupMocks);

afterEach(() => {
  cleanup();
  monacoSetupMocks.getMonacoIfLoaded.mockReset();
  monacoSetupMocks.loadMonaco.mockReset();
});

describe("MonacoDiffViewer language loading", () => {
  it("waits for a lazy language contribution when Monaco is already booted", async () => {
    const fakeMonaco = createFakeMonaco();
    (fakeMonaco as unknown as { languages: object }).languages = {};
    monacoSetupMocks.getMonacoIfLoaded.mockReturnValue(fakeMonaco);

    let resolveLanguage: ((api: typeof fakeMonaco) => void) | undefined;
    const languageReady = new Promise<typeof fakeMonaco>((resolve) => {
      resolveLanguage = resolve;
    });
    monacoSetupMocks.loadMonaco.mockReturnValue(languageReady);

    render(
      <MonacoDiffViewer
        leftText="const before = 1;"
        rightText="const after = 2;"
        filePath="src/example.ts"
      />,
    );

    expect(screen.getByTestId("monaco-diff-host").querySelector(".monaco-editor")).toBeNull();
    expect(monacoSetupMocks.loadMonaco).toHaveBeenCalledWith("typescript");

    resolveLanguage?.(fakeMonaco);
    await waitFor(() => {
      expect(
        screen.getByTestId("monaco-diff-host").querySelector(".monaco-editor"),
      ).not.toBeNull();
    });
  });
});
