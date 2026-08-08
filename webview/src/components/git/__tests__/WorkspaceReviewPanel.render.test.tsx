// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceReviewPanel } from "../WorkspaceReviewPanel";

describe("WorkspaceReviewPanel render", () => {
  afterEach(() => cleanup());

  it("renders provider filters and review list scaffold", () => {
    render(
      <WorkspaceReviewPanel
        snapshot={{
          repoId: "repo-1",
          providers: [
            {
              id: "github",
              displayName: "GitHub",
              available: true,
              authRequired: true,
              unavailableReason: "Connect a GitHub token to load pull requests.",
            },
          ],
          selectedProviderId: "github",
          items: [
            {
              id: "12",
              number: 12,
              title: "Add login flow",
              state: "open",
              author: "dev",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
              sourceBranch: "feature/login",
              targetBranch: "main",
            },
          ],
          authRequired: true,
          unavailableReason: "Connect a GitHub token to load pull requests.",
          filters: { state: "open", sort: "updated" },
          refreshedAt: Date.now(),
        }}
        details={null}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId={null}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
        selectedCommitSha={null}
        onCommitFilterChange={vi.fn()}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onMerge={vi.fn()}
      />,
    );

    expect(screen.getByTestId("workspace-review-panel")).toBeTruthy();
    expect(screen.getByTestId("review-auth-required")).toBeTruthy();
    expect(screen.getByTestId("review-item-12")).toBeTruthy();
    fireEvent.click(screen.getByTestId("review-item-12"));
  });

  it("renders suggestions and applies them", () => {
    const onApplySuggestion = vi.fn();
    render(
      <WorkspaceReviewPanel
        snapshot={null}
        details={{
          repoId: "repo-1",
          providerId: "github",
          review: {
            id: "12",
            number: 12,
            title: "Fix",
            state: "open",
            author: "dev",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            sourceBranch: "feature",
            targetBranch: "main",
          },
          timeline: [],
          files: [],
          comments: [],
          suggestions: [
            {
              id: "suggestion-99",
              commentId: "99",
              author: "reviewer",
              path: "src/app.ts",
              line: 4,
              body: "```suggestion\nconst ok = true;\n```",
              suggestionText: "const ok = true;",
              createdAt: "2026-01-03T00:00:00.000Z",
            },
          ],
          commits: [],
          canApprove: true,
          canRequestChanges: true,
          canMerge: false,
          canClose: true,
          canReopen: false,
          canDeleteSourceBranch: false,
          canCheckoutBranch: true,
          refreshedAt: Date.now(),
        }}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId="12"
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
        onApplySuggestion={onApplySuggestion}
      />,
    );

    expect(screen.getByTestId("review-suggestions")).toBeTruthy();
    fireEvent.click(screen.getByTestId("review-apply-suggestion-suggestion-99"));
    expect(onApplySuggestion).toHaveBeenCalledWith("suggestion-99");
  });

  it("renders close, reopen, checkout, and delete source branch actions", () => {
    const onClose = vi.fn();
    const onReopen = vi.fn();
    const onCheckoutBranch = vi.fn();
    const onDeleteSourceBranch = vi.fn();
    render(
      <WorkspaceReviewPanel
        snapshot={null}
        details={{
          repoId: "repo-1",
          providerId: "github",
          review: {
            id: "12",
            number: 12,
            title: "Merged PR",
            state: "merged",
            author: "dev",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            sourceBranch: "feature/login",
            targetBranch: "main",
          },
          timeline: [],
          files: [],
          comments: [],
          suggestions: [],
          commits: [],
          canApprove: false,
          canRequestChanges: false,
          canMerge: false,
          canClose: false,
          canReopen: false,
          canDeleteSourceBranch: true,
          canCheckoutBranch: false,
          checkoutBranchBlockedReason: "Pull request is already merged.",
          refreshedAt: Date.now(),
        }}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId="12"
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
        onClose={onClose}
        onReopen={onReopen}
        onCheckoutBranch={onCheckoutBranch}
        onDeleteSourceBranch={onDeleteSourceBranch}
      />,
    );

    expect(screen.getByTestId("review-delete-source-branch")).toBeTruthy();
    expect(
      (screen.getByTestId("review-checkout-branch") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("review-delete-source-branch"));
    expect(onDeleteSourceBranch).toHaveBeenCalled();

    cleanup();
    render(
      <WorkspaceReviewPanel
        snapshot={null}
        details={{
          repoId: "repo-1",
          providerId: "github",
          review: {
            id: "13",
            number: 13,
            title: "Open PR",
            state: "open",
            author: "dev",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            sourceBranch: "feature/x",
            targetBranch: "main",
          },
          timeline: [],
          files: [],
          comments: [],
          suggestions: [],
          commits: [],
          canApprove: true,
          canRequestChanges: true,
          canMerge: true,
          canClose: true,
          canReopen: false,
          canDeleteSourceBranch: false,
          canCheckoutBranch: true,
          refreshedAt: Date.now(),
        }}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId="13"
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
        onClose={onClose}
        onCheckoutBranch={onCheckoutBranch}
      />,
    );

    fireEvent.click(screen.getByTestId("review-close"));
    fireEvent.click(screen.getByTestId("review-checkout-branch"));
    expect(onClose).toHaveBeenCalled();
    expect(onCheckoutBranch).toHaveBeenCalled();
  });

  it("renders comments with pending badge and merge method actions", () => {
    const onMerge = vi.fn();
    render(
      <WorkspaceReviewPanel
        snapshot={null}
        details={{
          repoId: "repo-1",
          providerId: "github",
          review: {
            id: "12",
            number: 12,
            title: "Fix",
            state: "open",
            author: "dev",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            sourceBranch: "feature",
            targetBranch: "main",
          },
          timeline: [],
          files: [],
          comments: [
            {
              id: "c1",
              author: "reviewer",
              body: "Please fix this line.",
              path: "src/app.ts",
              line: 10,
              createdAt: "2026-01-03T00:00:00.000Z",
              pending: true,
            },
          ],
          suggestions: [],
          commits: [],
          canApprove: true,
          canRequestChanges: true,
          canMerge: true,
          canClose: true,
          canReopen: false,
          canDeleteSourceBranch: false,
          canCheckoutBranch: true,
          mergeMethods: ["merge", "squash", "rebase"],
          refreshedAt: Date.now(),
        }}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId="12"
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
        onMerge={onMerge}
      />,
    );

    expect(screen.getByTestId("review-comments")).toBeTruthy();
    expect(screen.getByTestId("review-comment-pending-c1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("review-merge-squash"));
    expect(onMerge).toHaveBeenCalledWith("squash");
  });
});