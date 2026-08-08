import { useState } from "react";

type WorkspaceReviewCreateFormProps = {
  busy: boolean;
  createReviewDefaults?: {
    sourceBranch?: string;
    targetBranch?: string;
  };
  onCreateReview: (opts: {
    title: string;
    sourceBranch: string;
    targetBranch: string;
    body?: string;
    draft?: boolean;
  }) => void;
  onClose: () => void;
};

export function WorkspaceReviewCreateForm({
  busy,
  createReviewDefaults,
  onCreateReview,
  onClose,
}: WorkspaceReviewCreateFormProps) {
  const [createTitle, setCreateTitle] = useState("");
  const [createSourceBranch, setCreateSourceBranch] = useState(
    createReviewDefaults?.sourceBranch ?? "",
  );
  const [createTargetBranch, setCreateTargetBranch] = useState(
    createReviewDefaults?.targetBranch ?? "main",
  );
  const [createBody, setCreateBody] = useState("");

  return (
    <div
      className="shrink-0 px-3 py-2 border-b border-border space-y-2"
      data-testid="review-create-form"
    >
      <input
        type="text"
        className="h-7 w-full px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
        placeholder="Title"
        value={createTitle}
        onChange={(e) => setCreateTitle(e.target.value)}
        disabled={busy}
        aria-label="New review title"
        data-testid="review-create-title"
      />
      <div className="flex gap-2">
        <input
          type="text"
          className="h-7 flex-1 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          placeholder="Source branch"
          value={createSourceBranch}
          onChange={(e) => setCreateSourceBranch(e.target.value)}
          disabled={busy}
          aria-label="New review source branch"
          data-testid="review-create-source-branch"
        />
        <input
          type="text"
          className="h-7 flex-1 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          placeholder="Target branch"
          value={createTargetBranch}
          onChange={(e) => setCreateTargetBranch(e.target.value)}
          disabled={busy}
          aria-label="New review target branch"
          data-testid="review-create-target-branch"
        />
      </div>
      <textarea
        className="w-full min-h-[56px] px-2 py-1 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
        placeholder="Description (optional)"
        value={createBody}
        onChange={(e) => setCreateBody(e.target.value)}
        disabled={busy}
        aria-label="New review description"
        data-testid="review-create-body"
      />
      <button
        type="button"
        className="h-7 px-3 text-[11px] rounded-vscode border border-border disabled:opacity-50"
        disabled={
          busy ||
          !createTitle.trim() ||
          !createSourceBranch.trim() ||
          !createTargetBranch.trim()
        }
        onClick={() => {
          onCreateReview({
            title: createTitle.trim(),
            sourceBranch: createSourceBranch.trim(),
            targetBranch: createTargetBranch.trim(),
            body: createBody.trim() || undefined,
          });
          onClose();
          setCreateTitle("");
          setCreateBody("");
        }}
        data-testid="review-create-submit"
      >
        Create review
      </button>
    </div>
  );
}