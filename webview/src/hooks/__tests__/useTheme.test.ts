/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTheme } from "../useTheme";

describe("useTheme", () => {
  const classes = [
    "vscode-dark",
    "vscode-light",
    "vscode-high-contrast",
    "vscode-high-contrast-light",
  ];

  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("detects light theme from body class", () => {
    document.body.classList.add("vscode-light");
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("light");
  });

  it("reacts when VS Code switches theme class on body", async () => {
    document.body.classList.add("vscode-dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("dark");

    act(() => {
      for (const c of classes) {
        document.body.classList.remove(c);
      }
      document.body.classList.add("vscode-high-contrast-light");
    });

    await waitFor(() => {
      expect(result.current).toBe("high-contrast-light");
    });
  });
});