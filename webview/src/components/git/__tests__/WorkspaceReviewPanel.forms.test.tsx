// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceReviewPanel } from "../WorkspaceReviewPanel";

describe("WorkspaceReviewPanel forms and filters", () => {
  afterEach(() => cleanup());

  it("exposes assignee and milestone filter inputs", () => {
    const onFiltersChange = vi.fn();
    render(
      <WorkspaceReviewPanel
        snapshot={{
          repoId: "repo-1",
          providers: [
            {
              id: "github",
              displayName: "GitHub",
              available: true,
              authRequired: false,
            },
          ],
          selectedProviderId: "github",
          items: [],
          authRequired: false,
          filters: { state: "open", sort: "updated" },
          refreshedAt: Date.now(),
        }}
        details={null}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId={null}
        onRefresh={vi.fn()}
        onFiltersChange={onFiltersChange}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("review-assignee-filter"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByTestId("review-milestone-filter"), {
      target: { value: "v1" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ assignee: "alice" }),
    );
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ milestone: "v1" }),
    );
  });

  it("creates reviews and line comments from the panel", () => {
    const onCreateReview = vi.fn();
    const onCreateLineComment = vi.fn();
    render(
      <WorkspaceReviewPanel
        snapshot={{
          repoId: "repo-1",
          providers: [
            {
              id: "github",
              displayName: "GitHub",
              available: true,
              authRequired: false,
            },
          ],
          selectedProviderId: "github",
          items: [],
          authRequired: false,
          filters: { state: "open", sort: "updated" },
          refreshedAt: Date.now(),
        }}
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
          suggestions: [],
          commits: [],
          canApprove: true,
          canRequestChanges: true,
          canMerge: true,
          canClose: true,
          canReopen: false,
          canDeleteSourceBranch: false,
          canCheckoutBranch: true,
          canCreateLineComment: true,
          mergeMethods: ["merge", "squash", "rebase"],
          refreshedAt: Date.now(),
        }}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId="12"
        canCreateReview
        createReviewDefaults={{ sourceBranch: "feature", targetBranch: "main" }}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
        onCreateReview={onCreateReview}
        onCreateLineComment={onCreateLineComment}
      />,
    );

    fireEvent.click(screen.getByTestId("review-create-toggle"));
    fireEvent.change(screen.getByTestId("review-create-title"), {
      target: { value: "New PR" },
    });
    fireEvent.click(screen.getByTestId("review-create-submit"));
    expect(onCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New PR",
        sourceBranch: "feature",
        targetBranch: "main",
      }),
    );

    fireEvent.change(screen.getByTestId("review-line-comment-path"), {
      target: { value: "src/app.ts" },
    });
    fireEvent.change(screen.getByTestId("review-line-comment-line"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("review-line-comment-body"), {
      target: { value: "Looks good" },
    });
    fireEvent.click(screen.getByTestId("review-line-comment-submit"));
    expect(onCreateLineComment).toHaveBeenCalledWith({
      path: "src/app.ts",
      line: 10,
      body: "Looks good",
    });
  });

  it("exposes author and label filter inputs", () => {
    const onFiltersChange = vi.fn();
    render(
      <WorkspaceReviewPanel
        snapshot={{
          repoId: "repo-1",
          providers: [
            {
              id: "github",
              displayName: "GitHub",
              available: true,
              authRequired: false,
            },
          ],
          selectedProviderId: "github",
          items: [],
          authRequired: false,
          filters: { state: "open", sort: "updated" },
          refreshedAt: Date.now(),
        }}
        details={null}
        loading={false}
        error={null}
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId={null}
        onRefresh={vi.fn()}
        onFiltersChange={onFiltersChange}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("review-author-filter"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByTestId("review-label-filter"), {
      target: { value: "bug" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ author: "alice" }),
    );
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ label: "bug" }),
    );
  });

  it("exposes alert semantics for error and auth-required states", () => {
    render(
      <WorkspaceReviewPanel
        snapshot={{
          repoId: "repo-1",
          providers: [
            {
              id: "gitlab",
              displayName: "GitLab",
              available: true,
              authRequired: true,
            },
          ],
          selectedProviderId: "gitlab",
          items: [],
          authRequired: true,
          filters: { state: "open", sort: "updated" },
          refreshedAt: Date.now(),
        }}
        details={null}
        loading={false}
        error="GitLab API 401: Unauthorized"
        filters={{ state: "open", sort: "updated" }}
        selectedReviewId={null}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onSelectReview={vi.fn()}
        onProviderChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("review-error").getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("review-auth-required").getAttribute("role")).toBe(
      "alert",
    );
    expect(screen.getByTestId("review-auth-required").textContent).toContain(
      "pull requests and merge requests",
    );
  });
});