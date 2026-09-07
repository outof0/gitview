// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommitOptionsDialog } from "../CommitOptionsDialog";

describe("CommitOptionsDialog", () => {
  afterEach(() => cleanup());

  it("updates supported commit options and closes", () => {
    const onAuthorChange = vi.fn();
    const onSignoffChange = vi.fn();
    const onRunHooksChange = vi.fn();
    const onRunChecksNow = vi.fn();
    const onClose = vi.fn();
    render(
      <CommitOptionsDialog
        open
        author=""
        signoff={false}
        gpgSign={false}
        runHooks
        runChecks
        busy={false}
        onAuthorChange={onAuthorChange}
        onSignoffChange={onSignoffChange}
        onGpgSignChange={vi.fn()}
        onRunHooksChange={onRunHooksChange}
        onRunChecksChange={vi.fn()}
        onRunChecksNow={onRunChecksNow}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByTestId("commit-options-author"), {
      target: { value: "Jane <jane@example.com>" },
    });
    fireEvent.click(screen.getByTestId("commit-options-signoff"));
    fireEvent.click(screen.getByTestId("commit-options-hooks"));
    fireEvent.click(screen.getByTestId("commit-options-run-checks"));
    fireEvent.click(screen.getByText("Close"));

    expect(onAuthorChange).toHaveBeenCalledWith("Jane <jane@example.com>");
    expect(onSignoffChange).toHaveBeenCalledWith(true);
    expect(onRunHooksChange).toHaveBeenCalledWith(false);
    expect(onRunChecksNow).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing while closed", () => {
    render(
      <CommitOptionsDialog
        open={false}
        author=""
        signoff={false}
        gpgSign={false}
        runHooks
        runChecks
        busy={false}
        onAuthorChange={vi.fn()}
        onSignoffChange={vi.fn()}
        onGpgSignChange={vi.fn()}
        onRunHooksChange={vi.fn()}
        onRunChecksChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("commit-options-dialog")).toBeNull();
  });
});
