// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommitComposer } from "../CommitComposer";

describe("CommitComposer", () => {
  afterEach(() => cleanup());

  it("commits from a single message field with Amend and Commit and Push", () => {
    const onCommit = vi.fn();
    const onMessageChange = vi.fn();
    render(
      <CommitComposer
        message="Fix bug"
        amend={false}
        busy={false}
        canCommit
        onMessageChange={onMessageChange}
        onAmendChange={vi.fn()}
        onCommit={onCommit}
        onCommitAndPush={vi.fn()}
      />,
    );

    expect(screen.getByTestId("commit-message")).toHaveProperty(
      "placeholder",
      "Commit Message",
    );
    expect(screen.getByTestId("commit-message").className).not.toContain(
      "border-0",
    );
    expect(screen.getByTestId("commit-message").className).toContain(
      "bg-panel-bg",
    );
    expect(screen.getByText("Amend")).toBeTruthy();
    fireEvent.click(screen.getByTestId("commit-button"));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("disables commit actions when the form cannot commit", () => {
    render(
      <CommitComposer
        message=""
        amend={false}
        busy={false}
        canCommit={false}
        onMessageChange={vi.fn()}
        onAmendChange={vi.fn()}
        onCommit={vi.fn()}
        onCommitAndPush={vi.fn()}
      />,
    );

    expect(screen.getByTestId("commit-button")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("commit-and-push-button")).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("opens commit options from the settings button", () => {
    const onOptions = vi.fn();
    render(
      <CommitComposer
        message="Fix bug"
        amend={false}
        busy={false}
        canCommit
        onMessageChange={vi.fn()}
        onAmendChange={vi.fn()}
        onCommit={vi.fn()}
        onCommitAndPush={vi.fn()}
        onOptions={onOptions}
      />,
    );

    fireEvent.click(screen.getByTestId("commit-options"));
    expect(onOptions).toHaveBeenCalledOnce();
  });
});
