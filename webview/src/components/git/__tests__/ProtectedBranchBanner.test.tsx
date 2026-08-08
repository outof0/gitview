// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProtectedBranchBanner } from "../ProtectedBranchBanner";

describe("ProtectedBranchBanner", () => {
  afterEach(() => cleanup());

  it("shows protected branch warning", () => {
    render(<ProtectedBranchBanner branchName="main" />);
    expect(screen.getByTestId("protected-branch-banner")).toBeTruthy();
    expect(screen.getByText(/main/)).toBeTruthy();
  });
});