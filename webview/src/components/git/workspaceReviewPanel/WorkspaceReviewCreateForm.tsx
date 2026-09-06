import { Input } from "../../ui/Input";
import { TextArea } from "../../ui/TextArea";
import { Button } from "../../ui/Button";
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
      <Input
        type="text"
        className="h-7 w-full px-2 text-ui-sm rounded-vscode border border-border bg-input"
        placeholder="Title"
        value={createTitle}
        onChange={(e) => setCreateTitle(e.target.value)}
        disabled={busy}
        aria-label="New review title"
        data-testid="review-create-title"
      />
      <div className="flex gap-2">
        <Input
          type="text"
          className="h-7 flex-1 px-2 text-ui-sm rounded-vscode border border-border bg-input"
          placeholder="Source branch"
          value={createSourceBranch}
          onChange={(e) => setCreateSourceBranch(e.target.value)}
          disabled={busy}
          aria-label="New review source branch"
          data-testid="review-create-source-branch"
        />
        <Input
          type="text"
          className="h-7 flex-1 px-2 text-ui-sm rounded-vscode border border-border bg-input"
          placeholder="Target branch"
          value={createTargetBranch}
          onChange={(e) => setCreateTargetBranch(e.target.value)}
          disabled={busy}
          aria-label="New review target branch"
          data-testid="review-create-target-branch"
        />
      </div>
      <TextArea
        className="w-full min-h-review-description px-2 py-1 text-ui-sm rounded-vscode border border-border bg-input"
        placeholder="Description (optional)"
        value={createBody}
        onChange={(e) => setCreateBody(e.target.value)}
        disabled={busy}
        aria-label="New review description"
        data-testid="review-create-body"
      />
      <Button variant="ghost" size="content"
        type="button"
        className="h-7 px-3 text-ui-sm rounded-vscode border border-border disabled:opacity-40"
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
      </Button>
    </div>
  );
}
