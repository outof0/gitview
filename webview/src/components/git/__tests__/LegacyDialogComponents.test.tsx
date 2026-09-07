// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BlameLoadingSkeleton } from "../BlameLoadingSkeleton";
import { CommitCheckWarningDialog } from "../CommitCheckWarningDialog";
import { CreateBranchFromCommitDialog } from "../CreateBranchFromCommitDialog";
import { DeleteBranchDialog } from "../DeleteBranchDialog";
import { EditCommitMessageDialog } from "../EditCommitMessageDialog";
import { RenameBranchDialog } from "../RenameBranchDialog";
import { CollapsedRegionBanner } from "../../merge/CollapsedRegionBanner";

afterEach(cleanup);

describe("Git dialog component contracts", () => {
  it("renders the requested number of blame loading rows", () => {
    render(<BlameLoadingSkeleton rows={5} />);

    const skeleton = screen.getByTestId("blame-loading-skeleton");
    expect(skeleton).toHaveProperty("ariaBusy", "true");
    expect(skeleton.children).toHaveLength(5);
  });

  it("lists commit check issues and exposes both decisions", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <CommitCheckWarningDialog
        open
        issues={[
          { kind: "todo", severity: "warning", message: "TODO remains" },
          { kind: "hooks", severity: "error", message: "Hook failed" },
        ]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("TODO remains")).toBeTruthy();
    expect(screen.getByText("Hook failed")).toBeTruthy();
    fireEvent.click(screen.getByTestId("commit-check-warning-cancel"));
    fireEvent.click(screen.getByTestId("commit-check-warning-confirm"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("requires and trims a branch name created from a commit", () => {
    const onConfirm = vi.fn();
    render(
      <CreateBranchFromCommitDialog
        open
        sha="abcdef123456"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirm = screen.getByTestId("create-branch-from-commit-confirm");
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByTestId("create-branch-from-commit-input"), {
      target: { value: "  feature/login  " },
    });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("feature/login");
  });

  it("passes normal and forced branch deletion decisions", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DeleteBranchDialog
        open
        branchName="feature/login"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("delete-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(false);

    rerender(
      <DeleteBranchDialog
        open
        branchName="feature/login"
        forceRequired
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("delete-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(true);
    expect(screen.getByText("Force delete")).toBeTruthy();
  });

  it("trims an edited commit message and resets it on re-entry", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <EditCommitMessageDialog
        open
        sha="abcdef123456"
        initialMessage="Old message"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByTestId("edit-commit-message-input");
    fireEvent.change(input, { target: { value: "  New message  " } });
    fireEvent.click(screen.getByTestId("edit-commit-message-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("New message");

    rerender(
      <EditCommitMessageDialog
        open
        sha="abcdef123456"
        initialMessage="Reopened message"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId("edit-commit-message-input")).toHaveProperty(
      "value",
      "Reopened message",
    );
  });

  it("enables rename only when the name changes and resets on re-entry", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <RenameBranchDialog
        open
        oldName="feature/login"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirm = screen.getByTestId("rename-branch-confirm");
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByTestId("rename-branch-input"), {
      target: { value: "feature/auth" },
    });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("feature/auth");

    rerender(
      <RenameBranchDialog
        open
        oldName="feature/settings"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rename-branch-input")).toHaveProperty(
      "value",
      "feature/settings",
    );
  });
});

describe("collapsed merge region banner", () => {
  it("uses singular/plural labels and stops the row click", () => {
    const onExpand = vi.fn();
    const { rerender } = render(
      <CollapsedRegionBanner hiddenLineCount={1} onExpand={onExpand} />,
    );

    expect(screen.getByText("… 1 line collapsed … (Expand)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "expand-collapsed" }));
    expect(onExpand).toHaveBeenCalledOnce();

    rerender(
      <CollapsedRegionBanner hiddenLineCount={2} onExpand={onExpand} />,
    );
    expect(screen.getByText("… 2 lines collapsed … (Expand)")).toBeTruthy();
  });
});
