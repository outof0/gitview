// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GitFileStatus } from "@gitview/shared/types/status";
import { RollbackChangesDialog } from "../RollbackChangesDialog";

function file(path: string, kind: GitFileStatus["kind"]): GitFileStatus {
  return {
    repoId: "repo-1",
    path,
    kind,
    indexStatus: kind === "unversioned" ? "?" : kind === "added" ? "A" : "M",
    workingTreeStatus: kind === "unversioned" ? "?" : kind === "added" ? "A" : "M",
    staged: false,
    conflicted: false,
    binary: false,
  };
}

describe("RollbackChangesDialog", () => {
  afterEach(cleanup);

  it("shows a themed file tree and confirms only checked paths", () => {
    const onConfirm = vi.fn();
    render(
      <RollbackChangesDialog
        open
        paths={["src/app.ts", "src/notes.txt", "README.md"]}
        selectedPaths={["src/app.ts", "src/notes.txt", "README.md"]}
        files={[
          file("src/app.ts", "modified"),
          file("src/notes.txt", "unversioned"),
          file("README.md", "added"),
        ]}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByTestId("rollback-changes-dialog")).toBeTruthy();
    expect(screen.getByTestId("rollback-file-tree").textContent).toContain(
      "Changes3 files",
    );
    expect(screen.getByTestId("rollback-file-src/app.ts")).toBeTruthy();
    expect(screen.getByTestId("rollback-file-src/notes.txt")).toBeTruthy();
    expect(screen.getByTestId("rollback-changes-summary").textContent).toContain(
      "1 modified",
    );
    expect(screen.queryByTestId("rollback-delete-added-files")).toBeNull();

    fireEvent.click(screen.getByTestId("rollback-file-select-src/notes.txt"));
    expect(screen.queryByText(/Unversioned files selected here will be deleted/)).toBeNull();

    fireEvent.click(screen.getByTestId("rollback-changes-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(["src/app.ts", "README.md"]);
  });

  it("disables rollback when every file is unchecked", () => {
    render(
      <RollbackChangesDialog
        open
        paths={["src/app.ts"]}
        selectedPaths={["src/app.ts"]}
        files={[file("src/app.ts", "modified")]}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTestId("rollback-file-select-src/app.ts"));
    expect(screen.getByTestId("rollback-changes-confirm")).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("keeps a manual uncheck when the parent refreshes with equivalent data", () => {
    const renderDialog = () => (
      <RollbackChangesDialog
        open
        paths={["src/app.ts", "src/notes.txt"]}
        selectedPaths={["src/app.ts", "src/notes.txt"]}
        files={[file("src/app.ts", "modified"), file("src/notes.txt", "modified")]}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );
    const { rerender } = render(renderDialog());

    fireEvent.click(screen.getByTestId("rollback-file-select-src/app.ts"));
    expect(screen.getByTestId("rollback-file-select-src/app.ts")).toHaveProperty(
      "checked",
      false,
    );

    rerender(renderDialog());
    expect(screen.getByTestId("rollback-file-select-src/app.ts")).toHaveProperty(
      "checked",
      false,
    );
  });
});
