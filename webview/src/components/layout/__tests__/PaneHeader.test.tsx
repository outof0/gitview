// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PaneHeader } from "../PaneHeader";
import { useGitViewStore } from "../../../stores/gitViewStore";

beforeEach(() => {
  useGitViewStore.setState({
    showDetails: false,
    showConflictsNavigation: false,
  });
});

afterEach(() => cleanup());

describe("PaneHeader", () => {
  it("left variant shows 'Changes from <branch>' and a Show Details link", () => {
    render(<PaneHeader variant="left" branch="feature/login" />);
    expect(screen.getByText("Changes from")).toBeTruthy();
    expect(screen.getByText("feature/login")).toBeTruthy();
    expect(screen.getByText("Show Details")).toBeTruthy();
  });

  it("right variant shows branch and Show Details link", () => {
    render(<PaneHeader variant="right" branch="main" />);
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("Show Details")).toBeTruthy();
  });

  it("center variant only shows Result", () => {
    render(<PaneHeader variant="center" />);
    expect(screen.getByText("Result")).toBeTruthy();
    expect(screen.queryByText("Conflicts Navigation")).toBeNull();
  });

  it("Show Details link toggles the store flag", () => {
    render(<PaneHeader variant="left" branch="b" />);
    fireEvent.click(screen.getByText("Show Details"));
    expect(useGitViewStore.getState().showDetails).toBe(true);
  });
});
