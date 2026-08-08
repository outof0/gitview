import type { ReviewListSnapshot } from "@gitview/shared/types/review";

type WorkspaceReviewListProps = {
  snapshot: ReviewListSnapshot | null;
  loading: boolean;
  selectedReviewId: string | null;
  onSelectReview: (reviewId: string) => void;
};

export function WorkspaceReviewList({
  snapshot,
  loading,
  selectedReviewId,
  onSelectReview,
}: WorkspaceReviewListProps) {
  return (
    <div className="w-[min(320px,40%)] shrink-0 border-r border-border overflow-auto">
      {(snapshot?.items ?? []).length === 0 && !loading ? (
        <div className="px-3 py-2 text-[12px] text-[var(--vscode-descriptionForeground)]">
          No reviews found.
        </div>
      ) : (
        <ul>
          {(snapshot?.items ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 border-b border-border hover:bg-list-hover ${
                  selectedReviewId === item.id ? "bg-list-active" : ""
                }`}
                onClick={() => onSelectReview(item.id)}
                data-testid={`review-item-${item.id}`}
              >
                <div className="text-[12px] font-medium truncate">
                  #{item.number} {item.title}
                </div>
                <div className="text-[11px] text-[var(--vscode-descriptionForeground)] truncate">
                  {item.author} · {item.sourceBranch} → {item.targetBranch}
                  {(item.labels?.length ?? 0) > 0
                    ? ` · ${item.labels!.join(", ")}`
                    : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}