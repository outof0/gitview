// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceLogPanel } from "../WorkspaceLogPanel";
import type { LogSnapshot } from "@gitview/shared/types/log";

const snapshot: LogSnapshot = {
  repoId: "repo-1",
  branch: "main",
  refreshedAt: Date.now(),
  commits: [],
};

describe("WorkspaceLogPanel filters", () => {
  afterEach(() => cleanup());

  it("updates branch, author, grep, date, path, and range filters", () => {
    const onFiltersChange = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={onFiltersChange}
        hasUpstream
      />,
    );

    fireEvent.change(screen.getByTestId("log-filter-branch"), {
      target: { value: "feature" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "feature" }),
    );

    fireEvent.change(screen.getByTestId("log-filter-author"), {
      target: { value: "Alice" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ author: "Alice" }),
    );

    fireEvent.change(screen.getByTestId("log-filter-grep"), {
      target: { value: "fix" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ grep: "fix" }),
    );

    fireEvent.change(screen.getByTestId("log-filter-since"), {
      target: { value: "2024-01-01" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ since: "2024-01-01" }),
    );

    fireEvent.change(screen.getByTestId("log-filter-path"), {
      target: { value: "src/app.ts" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: "src/app.ts" }),
    );

    fireEvent.change(screen.getByTestId("log-filter-range"), {
      target: { value: "incoming" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ range: "incoming" }),
    );
  });
});