import { useState } from "react";
import { Tag, X } from "lucide-react";
import type { TagListSnapshot } from "@gitview/shared/types/tag";

type TagsPopupProps = {
  open: boolean;
  snapshot: TagListSnapshot | null;
  loading?: boolean;
  busy?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onCreate: (name: string, message: string) => void;
  onCheckout: (name: string) => void;
  onPush: (name: string) => void;
  onDelete: (name: string) => void;
};

export function TagsPopup({
  open,
  snapshot,
  loading = false,
  busy = false,
  onClose,
  onRefresh,
  onCreate,
  onCheckout,
  onPush,
  onDelete,
}: TagsPopupProps) {
  const [newName, setNewName] = useState("");
  const [newMessage, setNewMessage] = useState("");

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40"
      data-testid="tags-popup"
      onClick={onClose}
    >
      <div
        className="w-[min(440px,92vw)] max-h-[70vh] flex flex-col rounded-vscode border border-border bg-[var(--vscode-editor-background)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Tag size={16} aria-hidden />
          <span className="text-[13px] font-semibold flex-1">Tags</span>
          <button
            type="button"
            className="h-7 px-2 text-[11px] rounded-vscode hover:bg-list-hover"
            onClick={onRefresh}
            disabled={loading || busy}
          >
            Refresh
          </button>
          <button type="button" className="h-7 w-7 flex items-center justify-center rounded-vscode hover:bg-list-hover" onClick={onClose}>
            <X size={14} aria-hidden />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto" data-testid="tags-list">
          {loading && (
            <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
              Loading tags…
            </div>
          )}
          {!loading &&
            (snapshot?.tags ?? []).map((tag) => (
              <div
                key={tag.name}
                className="flex items-center gap-2 px-3 py-2 border-b border-border text-[12px]"
                data-testid={`tag-${tag.name}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono">{tag.name}</div>
                  <div className="text-[11px] text-[var(--vscode-descriptionForeground)]">
                    {tag.sha}
                    {tag.annotated ? " · annotated" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
                  disabled={busy}
                  onClick={() => onCheckout(tag.name)}
                >
                  Checkout
                </button>
                <button
                  type="button"
                  className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
                  disabled={busy}
                  onClick={() => onPush(tag.name)}
                >
                  Push
                </button>
                <button
                  type="button"
                  className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
                  disabled={busy}
                  onClick={() => onDelete(tag.name)}
                >
                  Delete
                </button>
              </div>
            ))}
        </div>

        <div className="shrink-0 flex flex-col gap-2 px-3 py-2 border-t border-border">
          <input
            type="text"
            className="h-7 px-2 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
            placeholder="New tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid="new-tag-name"
          />
          <input
            type="text"
            className="h-7 px-2 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
            placeholder="Annotated tag message"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            data-testid="new-tag-message"
          />
          <button
            type="button"
            className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40 self-end"
            disabled={!newName.trim() || busy}
            onClick={() => {
              onCreate(newName.trim(), newMessage.trim());
              setNewName("");
              setNewMessage("");
            }}
            data-testid="create-tag-button"
          >
            Create annotated tag
          </button>
        </div>
      </div>
    </div>
  );
}