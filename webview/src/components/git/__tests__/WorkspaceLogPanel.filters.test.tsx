// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceLogPanel } from "../WorkspaceLogPanel";
import { isoDaysAgo } from "../workspaceLogPanel/localIsoDate";
import type { LogQueryFilters, LogSnapshot } from "@gitview/shared/types/log";

const snapshot: LogSnapshot = {
  repoId: "repo-1",
  branch: "main",
  refreshedAt: Date.now(),
  commits: [],
};

type PanelOverrides = {
  filters?: Partial<LogQueryFilters>;
  onFiltersChange?: () => void;
  hasUpstream?: boolean;
};

function renderPanel({
  filters,
  onFiltersChange = vi.fn(),
  hasUpstream = true,
}: PanelOverrides = {}) {
  render(
    <WorkspaceLogPanel
      snapshot={snapshot}
      selectedSha={null}
      selectedFilePath={null}
      diffDocument={null}
      onSelectCommit={vi.fn()}
      onSelectFile={vi.fn()}
      onRefresh={vi.fn()}
      filters={{ range: "all", limit: 200, ...filters }}
      onFiltersChange={onFiltersChange}
      hasUpstream={hasUpstream}
    />,
  );
  return { onFiltersChange };
}

function openDateMenu() {
  fireEvent.click(screen.getByTestId("log-filter-date-trigger"));
}

function openCustomDatePicker() {
  openDateMenu();
  fireEvent.click(screen.getByRole("button", { name: "Select..." }));
}

describe("WorkspaceLogPanel filters", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reports the text search term", () => {
    const { onFiltersChange } = renderPanel();

    fireEvent.change(screen.getByTestId("log-filter-grep"), {
      target: { value: "fix" },
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ grep: "fix" }),
    );
  });

  it("reports a branch filter typed into the branch menu", () => {
    const { onFiltersChange } = renderPanel();

    fireEvent.click(screen.getByTestId("log-filter-branch-trigger"));
    fireEvent.change(screen.getByTestId("log-filter-branch"), {
      target: { value: "feature" },
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ branch: "feature", range: "all" }),
    );
  });

  it("reports an incoming range and closes the branch menu", () => {
    const { onFiltersChange } = renderPanel();

    fireEvent.click(screen.getByTestId("log-filter-branch-trigger"));
    fireEvent.click(screen.getByTestId("log-filter-range-incoming"));

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ range: "incoming", branch: undefined }),
    );
    expect(screen.queryByTestId("log-filter-branch")).toBeNull();
  });

  it("reports an author filter typed into the user menu", () => {
    const { onFiltersChange } = renderPanel();

    fireEvent.click(screen.getByTestId("log-filter-author-trigger"));
    fireEvent.change(screen.getByTestId("log-filter-author"), {
      target: { value: "Alice" },
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ author: "Alice" }),
    );
  });

  it("applies a relative date preset and closes the date menu", () => {
    const { onFiltersChange } = renderPanel();

    openDateMenu();
    fireEvent.click(screen.getByRole("button", { name: "Last 24 hours" }));

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ since: isoDaysAgo(1), until: undefined }),
    );
    expect(screen.queryByRole("button", { name: "Last 24 hours" })).toBeNull();
  });

  it("clears both date bounds when choosing Any date", () => {
    const { onFiltersChange } = renderPanel({
      filters: { since: "2024-01-01", until: "2024-02-01" },
    });

    openDateMenu();
    fireEvent.click(screen.getByRole("button", { name: "Any date" }));

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ since: undefined, until: undefined }),
    );
  });

  it("keeps the calendar picker closed until Select... is chosen", () => {
    renderPanel();

    openDateMenu();

    expect(screen.queryByTestId("log-date-picker")).toBeNull();
    expect(screen.getByRole("button", { name: "Select..." })).toBeTruthy();
  });

  it("reveals the calendar picker after choosing Select...", () => {
    renderPanel();

    openCustomDatePicker();

    expect(screen.getByTestId("log-date-picker")).toBeTruthy();
  });

  it("returns to the preset list when the date menu is reopened", () => {
    renderPanel();

    openCustomDatePicker();
    fireEvent.click(screen.getByTestId("log-filter-date-trigger"));
    openDateMenu();

    expect(screen.queryByTestId("log-date-picker")).toBeNull();
    expect(screen.getByRole("button", { name: "Select..." })).toBeTruthy();
  });

  it("reports a since date typed into the calendar picker", () => {
    const { onFiltersChange } = renderPanel();

    openCustomDatePicker();
    fireEvent.change(screen.getByTestId("log-filter-since"), {
      target: { value: "2024-01-01" },
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ since: "2024-01-01", until: undefined }),
    );
  });

  it("keeps the since bound when an until date is typed", () => {
    const { onFiltersChange } = renderPanel({
      filters: { since: "2024-01-01" },
    });

    openCustomDatePicker();
    fireEvent.change(screen.getByTestId("log-filter-until"), {
      target: { value: "2024-02-01" },
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ since: "2024-01-01", until: "2024-02-01" }),
    );
  });

  it("reports a day clicked in the calendar grid", () => {
    const { onFiltersChange } = renderPanel();
    const now = new Date();
    const fifteenth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;

    openCustomDatePicker();
    fireEvent.click(screen.getByRole("button", { name: "15" }));

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ since: fifteenth }),
    );
  });

  it("reports a path filter typed into the paths menu", () => {
    const { onFiltersChange } = renderPanel();

    fireEvent.click(screen.getByTestId("log-filter-path-trigger"));
    fireEvent.change(screen.getByTestId("log-filter-path"), {
      target: { value: "src/app.ts" },
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "src/app.ts" }),
    );
  });

  it("keeps the dense filter bar visible in a short webview", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        media: "(max-height: 600px)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );

    renderPanel({ onFiltersChange: vi.fn() });

    expect(screen.getByTestId("log-filter-bar")).toBeTruthy();
    expect(screen.getByTestId("log-filter-grep")).toBeTruthy();
    expect(screen.queryByTestId("log-filters-toggle")).toBeNull();
  });
});
