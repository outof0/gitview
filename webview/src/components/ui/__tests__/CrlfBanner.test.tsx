// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildMergeDocument } from "../../../../../src/core/mergeDocument";
import { useGitViewStore } from "../../../stores/gitViewStore";
import { CrlfBanner } from "../CrlfBanner";

describe("CrlfBanner", () => {
  afterEach(() => {
    cleanup();
    useGitViewStore.setState({
      activeDocument: null,
      warnOnCrlf: true,
      crlfBannerDismissed: false,
    });
  });

  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      warnOnCrlf: true,
      crlfBannerDismissed: false,
    });
  });

  it("shows when mixed line endings are present", () => {
    const doc = buildMergeDocument({
      repoRoot: "/repo",
      relativePath: "src/app.ts",
      absolutePath: "/repo/src/app.ts",
      base: "a\r\nb\nc\n",
      ours: "a\r\nb\nc\n",
      theirs: "a\r\nb\nc\n",
      worktree: "a\r\nb\nc\n",
    });
    useGitViewStore.setState({ activeDocument: doc });

    render(<CrlfBanner />);
    expect(screen.getByTestId("crlf-banner")).toBeTruthy();
  });

  it("dismisses on Ignore", () => {
    const doc = buildMergeDocument({
      repoRoot: "/repo",
      relativePath: "src/app.ts",
      absolutePath: "/repo/src/app.ts",
      base: "a\r\nb\nc\n",
      ours: "a\r\nb\nc\n",
      theirs: "a\r\nb\nc\n",
      worktree: "a\r\nb\nc\n",
    });
    useGitViewStore.setState({ activeDocument: doc });

    render(<CrlfBanner />);
    fireEvent.click(screen.getByTestId("crlf-ignore"));
    expect(screen.queryByTestId("crlf-banner")).toBeNull();
    expect(useGitViewStore.getState().crlfBannerDismissed).toBe(true);
  });
});