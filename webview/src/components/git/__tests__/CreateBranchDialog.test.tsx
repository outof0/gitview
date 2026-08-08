// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import { CreateBranchDialog } from "../CreateBranchDialog";

const BRANCHES: BranchEntry[] = [
  {
    repoId: "r",
    name: "main",
    fullName: "main",
    remote: false,
    current: true,
    upstream: null,
    headSha: null,
  },
  {
    repoId: "r",
    name: "develop",
    fullName: "origin/develop",
    remote: true,
    current: false,
    upstream: null,
    headSha: null,
  },
];

function renderDialog(onConfirm: () => void) {
  render(
    <CreateBranchDialog
      open
      branches={BRANCHES}
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
}

describe("CreateBranchDialog", () => {
  afterEach(() => cleanup());

  it("creates and checks out a branch from HEAD by default", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.change(screen.getByTestId("create-branch-name"), {
      target: { value: "feature/login" },
    });
    fireEvent.click(screen.getByTestId("create-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("feature/login", undefined, {
      checkout: true,
      force: undefined,
    });
  });

  it("creates from a chosen start point without checking out", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.change(screen.getByTestId("create-branch-name"), {
      target: { value: "hotfix" },
    });
    fireEvent.change(screen.getByTestId("create-branch-start-point"), {
      target: { value: "origin/develop" },
    });
    fireEvent.click(screen.getByTestId("create-branch-checkout"));
    fireEvent.click(screen.getByTestId("create-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("hotfix", "origin/develop", {
      checkout: false,
      force: undefined,
    });
  });

  it("blocks an invalid branch name", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.change(screen.getByTestId("create-branch-name"), {
      target: { value: "bad name" },
    });
    expect(screen.getByTestId("create-branch-error")).toBeTruthy();
    expect(screen.getByTestId("create-branch-confirm")).toHaveProperty("disabled", true);
  });

  it("requires an explicit overwrite when the branch already exists", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.change(screen.getByTestId("create-branch-name"), {
      target: { value: "main" },
    });
    expect(screen.getByTestId("create-branch-confirm")).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByTestId("create-branch-force"));
    fireEvent.click(screen.getByTestId("create-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("main", undefined, {
      checkout: true,
      force: true,
    });
  });
});
