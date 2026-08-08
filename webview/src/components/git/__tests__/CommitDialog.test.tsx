// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GitFileStatus } from "@gitview/shared/types/status";
import { CommitDialog, type CommitDialogProps } from "../CommitDialog";

afterEach(cleanup);

function file(path: string): GitFileStatus {
  return {
    repoId: "r",
    path,
    kind: "modified",
    indexStatus: "M",
    workingTreeStatus: " ",
    staged: true,
    conflicted: false,
    binary: false,
  };
}

const FILES = [file("src/a.ts"), file("src/b.ts")];

function renderDialog(overrides: Partial<CommitDialogProps> = {}) {
  const props: CommitDialogProps = {
    open: true,
    files: FILES,
    commitScope: new Set(FILES.map((f) => f.path)),
    onToggleFile: vi.fn(),
    onSetScope: vi.fn(),
    selectedFilePath: null,
    onSelectFile: vi.fn(),
    diffDocument: null,
    message: "Ship it",
    amend: false,
    signoff: false,
    gpgSign: false,
    author: "",
    runChecks: false,
    busy: false,
    currentBranch: "main",
    onMessageChange: vi.fn(),
    onAmendChange: vi.fn(),
    onSignoffChange: vi.fn(),
    onGpgSignChange: vi.fn(),
    onAuthorChange: vi.fn(),
    onRunChecksChange: vi.fn(),
    onCommit: vi.fn(),
    onCommitAndPush: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<CommitDialog {...props} />);
  return props;
}

describe("CommitDialog", () => {
  it("names the branch being committed to", () => {
    renderDialog();

    expect(screen.getByTestId("commit-dialog")).toBeTruthy();
    expect(screen.getByLabelText("Commit Changes to main")).toBeTruthy();
  });

  it("commits and pushes with the typed message", () => {
    const props = renderDialog();

    fireEvent.click(screen.getByTestId("commit-dialog-commit"));
    fireEvent.click(screen.getByTestId("commit-dialog-commit-and-push"));

    expect(props.onCommit).toHaveBeenCalled();
    expect(props.onCommitAndPush).toHaveBeenCalled();
  });

  it("blocks committing without a message", () => {
    renderDialog({ message: "   " });

    expect(screen.getByTestId("commit-dialog-commit")).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("blocks committing when no file is selected", () => {
    renderDialog({ commitScope: new Set<string>() });

    expect(screen.getByTestId("commit-dialog-commit")).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("toggles a single file in and out of the commit scope", () => {
    const props = renderDialog();

    fireEvent.click(screen.getByTestId("commit-dialog-check-src/a.ts"));

    expect(props.onToggleFile).toHaveBeenCalledWith("src/a.ts");
  });

  it("clears the scope when every file is already checked", () => {
    const props = renderDialog();

    fireEvent.click(screen.getByTestId("commit-dialog-select-all"));

    expect(props.onSetScope).toHaveBeenCalledWith([]);
  });

  it("selects every file when the scope is empty", () => {
    const props = renderDialog({ commitScope: new Set<string>() });

    fireEvent.click(screen.getByTestId("commit-dialog-select-all"));

    expect(props.onSetScope).toHaveBeenCalledWith(["src/a.ts", "src/b.ts"]);
  });

  it("previews the clicked file", () => {
    const props = renderDialog();

    fireEvent.click(screen.getByTestId("commit-dialog-file-src/b.ts"));

    expect(props.onSelectFile).toHaveBeenCalledWith("src/b.ts");
  });

  it("disables amend on a protected branch", () => {
    renderDialog({ protectedBranch: true });

    expect(screen.getByTestId("commit-dialog-amend")).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByTestId("commit-dialog-protected-warning")).toBeTruthy();
  });

  it("renders nothing while closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByTestId("commit-dialog")).toBeNull();
  });
});
