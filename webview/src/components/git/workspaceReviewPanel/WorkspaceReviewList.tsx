import { Button } from "../../ui/Button";
import type { ReviewListSnapshot } from "@gitview/shared/types/review";
import { ScrollArea } from "../../ui/ScrollArea";

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
    <ScrollArea
      axis="vertical"
      className="w-[min(320px,40%)] shrink-0 border-r border-border"
    >
      {(snapshot?.items ?? []).length === 0 && !loading ? (
        <div className="px-3 py-2 text-ui text-vscode-description">
          No reviews found.
        </div>
      ) : (
        <ul>
          {(snapshot?.items ?? []).map((item) => (
            <li key={item.id}>
              <Button variant="ghost" size="content"
                type="button"
                className={`w-full text-left px-3 py-2 border-b border-border hover:bg-list-hover ${
                  selectedReviewId === item.id
                    ? "bg-list-active text-list-activeForeground"
                    : ""
                }`}
                onClick={() => onSelectReview(item.id)}
                data-testid={`review-item-${item.id}`}
              >
                <div className="text-ui font-medium truncate">
                  #{item.number} {item.title}
                </div>
                <div className="text-ui-sm text-vscode-description truncate">
                  {item.author} · {item.sourceBranch} → {item.targetBranch}
                  {(item.labels?.length ?? 0) > 0
                    ? ` · ${item.labels!.join(", ")}`
                    : ""}
                </div>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}