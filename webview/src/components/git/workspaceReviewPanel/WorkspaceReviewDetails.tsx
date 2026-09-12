import { Input } from "../../ui/Input";
import { TextArea } from "../../ui/TextArea";
import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";
import { useState } from "react";
import type { ReviewDetailsSnapshot } from "@gitview/shared/types/review";
import { ScrollArea } from "../../ui/ScrollArea";

type WorkspaceReviewDetailsProps = {
  details: ReviewDetailsSnapshot | null;
  busy: boolean;
  selectedCommitSha?: string | null;
  onCommitFilterChange?: (sha: string | null) => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onMerge?: (method?: "merge" | "squash" | "rebase") => void;
  onApplySuggestion?: (suggestionId: string) => void;
  onClose?: () => void;
  onReopen?: () => void;
  onDeleteSourceBranch?: () => void;
  onCheckoutBranch?: () => void;
  onCreateLineComment?: (opts: {
    path: string;
    line: number;
    body: string;
    side?: "LEFT" | "RIGHT";
  }) => void;
};

export function WorkspaceReviewDetails({
  details,
  busy,
  selectedCommitSha = null,
  onCommitFilterChange,
  onApprove,
  onRequestChanges,
  onMerge,
  onApplySuggestion,
  onClose,
  onReopen,
  onDeleteSourceBranch,
  onCheckoutBranch,
  onCreateLineComment,
}: WorkspaceReviewDetailsProps) {
  const [lineCommentPath, setLineCommentPath] = useState("");
  const [lineCommentLine, setLineCommentLine] = useState("");
  const [lineCommentBody, setLineCommentBody] = useState("");

  return (
    <ScrollArea axis="vertical" className="flex-1 px-3 py-2">
      {details ? (
        <div data-testid="review-details">
          <h3 className="text-title font-semibold mb-1">
            #{details.review.number} {details.review.title}
          </h3>
          <p className="text-ui text-vscode-description mb-3">
            {details.review.author} · {details.review.state}
          </p>
          {details.mergeBlockedReason && (
            <p
              className="text-ui text-warning-fg mb-3"
              data-testid="review-merge-blocked"
            >
              {details.mergeBlockedReason}
            </p>
          )}
          {details.deleteSourceBranchBlockedReason && (
            <p
              className="text-ui text-vscode-description mb-3"
              data-testid="review-delete-branch-blocked"
            >
              {details.deleteSourceBranchBlockedReason}
            </p>
          )}
          {details.checkoutBranchBlockedReason && (
            <p
              className="text-ui text-vscode-description mb-3"
              data-testid="review-checkout-blocked"
            >
              {details.checkoutBranchBlockedReason}
            </p>
          )}
          {details.commits.length > 0 && onCommitFilterChange && (
            <div className="mb-3">
              <label className="text-ui-sm text-vscode-description mr-2">
                Commit filter
              </label>
              <SelectField
                className="h-7 px-2 text-ui-sm rounded-vscode border border-border bg-input"
                value={selectedCommitSha ?? ""}
                onChange={(e) =>
                  onCommitFilterChange(e.target.value || null)
                }
                data-testid="review-commit-filter"
              >
                <option value="">All commits</option>
                {details.commits.map((commit) => (
                  <option key={commit.sha} value={commit.sha}>
                    {commit.sha.slice(0, 7)} {commit.message}
                  </option>
                ))}
              </SelectField>
            </div>
          )}
          {details.timeline.length > 0 && (
            <div className="mb-3">
              <div className="text-ui font-medium mb-1">Timeline</div>
              <ScrollArea axis="vertical" className="max-h-review-timeline-max">
                <ul className="text-ui-sm space-y-1">
                  {details.timeline.map((entry) => (
                    <li key={entry.id} className="truncate">
                      <span className="font-medium">{entry.author}</span>:{" "}
                      {entry.body.slice(0, 120)}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
          {details.canCreateLineComment && onCreateLineComment && (
            <div className="mb-3" data-testid="review-line-comment-form">
              <div className="text-ui font-medium mb-1">
                Add line comment
              </div>
              <div className="flex gap-2 mb-2">
                <Input
                  type="text"
                  className="h-7 flex-1 px-2 text-ui-sm rounded-vscode border border-border bg-input"
                  placeholder="File path"
                  value={lineCommentPath}
                  onChange={(e) => setLineCommentPath(e.target.value)}
                  disabled={busy}
                  aria-label="Line comment file path"
                  data-testid="review-line-comment-path"
                />
                <Input
                  type="number"
                  min={1}
                  className="h-7 w-16 px-2 text-ui-sm rounded-vscode border border-border bg-input"
                  placeholder="Line"
                  value={lineCommentLine}
                  onChange={(e) => setLineCommentLine(e.target.value)}
                  disabled={busy}
                  aria-label="Line comment line number"
                  data-testid="review-line-comment-line"
                />
              </div>
              <TextArea
                className="w-full min-h-review-comment px-2 py-1 text-ui-sm rounded-vscode border border-border bg-input mb-2"
                placeholder="Comment"
                value={lineCommentBody}
                onChange={(e) => setLineCommentBody(e.target.value)}
                disabled={busy}
                aria-label="Line comment body"
                data-testid="review-line-comment-body"
              />
              <Button variant="ghost" size="content"
                type="button"
                className="h-7 px-3 text-ui-sm rounded-vscode border border-border disabled:opacity-40"
                disabled={
                  busy ||
                  !lineCommentPath.trim() ||
                  !lineCommentBody.trim() ||
                  !Number.isFinite(Number.parseInt(lineCommentLine, 10))
                }
                onClick={() => {
                  onCreateLineComment({
                    path: lineCommentPath.trim(),
                    line: Number.parseInt(lineCommentLine, 10),
                    body: lineCommentBody.trim(),
                  });
                  setLineCommentPath("");
                  setLineCommentLine("");
                  setLineCommentBody("");
                }}
                data-testid="review-line-comment-submit"
              >
                Post line comment
              </Button>
            </div>
          )}
          {details.comments.length > 0 && (
            <div className="mb-3" data-testid="review-comments">
              <div className="text-ui font-medium mb-1">Comments</div>
              <ScrollArea axis="vertical" className="max-h-review-comments-max">
                <ul className="text-ui-sm space-y-2">
                  {details.comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="border border-border rounded-vscode p-2"
                      data-testid={`review-comment-${comment.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{comment.author}</span>
                        {comment.pending && (
                          <span
                            className="text-section px-1 rounded-vscode bg-warning-bg text-warning-fg"
                            data-testid={`review-comment-pending-${comment.id}`}
                          >
                            pending
                          </span>
                        )}
                        {comment.path && (
                          <span className="font-mono text-section truncate text-vscode-description">
                            {comment.path}
                            {comment.line != null ? `:${comment.line}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-section">
                        {comment.body.slice(0, 400)}
                      </p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
          {(details.suggestions ?? []).length > 0 && (
            <div className="mb-3" data-testid="review-suggestions">
              <div className="text-ui font-medium mb-1">Suggestions</div>
              <ul className="text-ui-sm space-y-2">
                {(details.suggestions ?? []).map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="border border-border rounded-vscode p-2"
                    data-testid={`review-suggestion-${suggestion.id}`}
                  >
                    <div className="font-mono truncate mb-1">
                      {suggestion.path}:{suggestion.line}
                    </div>
                    <pre className="whitespace-pre-wrap text-section bg-code-block-bg p-1 rounded-vscode mb-2">
                      {suggestion.suggestionText}
                    </pre>
                    <Button variant="ghost" size="content"
                      type="button"
                      className="h-6 px-2 text-ui-sm rounded-vscode border border-border disabled:opacity-40"
                      disabled={!onApplySuggestion || busy}
                      onClick={() => onApplySuggestion?.(suggestion.id)}
                      data-testid={`review-apply-suggestion-${suggestion.id}`}
                    >
                      Apply suggestion
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-ui font-medium mb-2">Changed files</div>
          {details.files.length === 0 ? (
            <p className="text-ui text-vscode-description">
              No changed files loaded.
            </p>
          ) : (
            <ul className="text-ui space-y-1">
              {details.files.map((file) => (
                <li key={file.id} className="font-mono truncate">
                  {file.path}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {onCheckoutBranch && (
              <Button variant="ghost" size="content"
                type="button"
                className="h-7 px-3 text-ui rounded-vscode border border-border disabled:opacity-40"
                disabled={!details.canCheckoutBranch || busy}
                onClick={onCheckoutBranch}
                aria-label="Checkout review branch"
                data-testid="review-checkout-branch"
              >
                Checkout branch
              </Button>
            )}
            <Button variant="ghost" size="content"
              type="button"
              className="h-7 px-3 text-ui rounded-vscode border border-border disabled:opacity-40"
              disabled={!details.canApprove || !onApprove}
              onClick={onApprove}
              aria-label="Approve review"
              data-testid="review-approve"
            >
              Approve
            </Button>
            <Button variant="ghost" size="content"
              type="button"
              className="h-7 px-3 text-ui rounded-vscode border border-border disabled:opacity-40"
              disabled={!details.canRequestChanges || !onRequestChanges}
              onClick={onRequestChanges}
              aria-label="Request changes on review"
              data-testid="review-request-changes"
            >
              Request changes
            </Button>
            {(details.mergeMethods ?? ["merge"]).map((method) => (
              <Button variant="ghost" size="content"
                key={method}
                type="button"
                className="h-7 px-3 text-ui rounded-vscode border border-border disabled:opacity-40"
                disabled={!details.canMerge || !onMerge}
                onClick={() => onMerge?.(method)}
                aria-label={`${method} merge review`}
                data-testid={`review-merge-${method}`}
              >
                {method === "merge"
                  ? "Merge"
                  : method === "squash"
                    ? "Squash"
                    : "Rebase"}
              </Button>
            ))}
            {onClose && (
              <Button variant="ghost" size="content"
                type="button"
                className="h-7 px-3 text-ui rounded-vscode border border-border disabled:opacity-40"
                disabled={!details.canClose || busy}
                onClick={onClose}
                aria-label="Close review"
                data-testid="review-close"
              >
                Close
              </Button>
            )}
            {onReopen && (
              <Button variant="ghost" size="content"
                type="button"
                className="h-7 px-3 text-ui rounded-vscode border border-border disabled:opacity-40"
                disabled={!details.canReopen || busy}
                onClick={onReopen}
                aria-label="Reopen review"
                data-testid="review-reopen"
              >
                Reopen
              </Button>
            )}
            {onDeleteSourceBranch && (
              <Button variant="ghost" size="content"
                type="button"
                className="h-7 px-3 text-ui rounded-vscode border border-border disabled:opacity-40"
                disabled={!details.canDeleteSourceBranch || busy}
                onClick={onDeleteSourceBranch}
                aria-label="Delete merged source branch"
                data-testid="review-delete-source-branch"
              >
                Delete source branch
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-ui text-vscode-description">
          Select a review to see overview and timeline.
        </div>
      )}
    </ScrollArea>
  );
}
