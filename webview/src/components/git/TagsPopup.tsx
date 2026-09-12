import {
  useState,
} from "react";
import {
  Tag,
  X,
} from "lucide-react";
import type { TagListSnapshot } from "@gitview/shared/types/tag";
import { GitDialogShell } from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { ToolbarIconButton } from "../ui/ToolbarControls";
import { ToolEmptyState } from "../ui/ToolEmptyState";

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

  return (
    <GitDialogShell
      open={open}
      title="Tags"
      titleIcon={<Tag size={16} />}
      size="list"
      onCancel={onClose}
      testId="tags-popup"
      headerActions={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onRefresh}
            disabled={loading || busy}
          >
            Refresh
          </Button>
          <ToolbarIconButton onClick={onClose} aria-label="Close tags">
            <X size={14} aria-hidden />
          </ToolbarIconButton>
        </>
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          <TextField
            size="compact"
            containerClassName="w-full"
            placeholder="New tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid="new-tag-name"
          />
          <TextField
            size="compact"
            containerClassName="w-full"
            placeholder="Annotated tag message"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            data-testid="new-tag-message"
          />
          <Button
            type="button"
            variant="primary" size="compact" className="self-end"
            disabled={!newName.trim() || busy}
            onClick={() => {
              onCreate(newName.trim(), newMessage.trim());
              setNewName("");
              setNewMessage("");
            }}
            data-testid="create-tag-button"
          >
            Create annotated tag
          </Button>
        </div>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="tags-list">
        {loading && (
          <div className="p-3 text-ui-sm text-vscode-description">
            Loading tags…
          </div>
        )}
        {!loading && (snapshot?.tags ?? []).length === 0 && (
          <ToolEmptyState title="No tags yet." />
        )}
        {!loading &&
          (snapshot?.tags ?? []).map((tag) => (
            <div
              key={tag.name}
              className="flex items-center gap-2 px-3 py-2 border-b border-border text-ui"
              data-testid={`tag-${tag.name}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono">{tag.name}</div>
                <div className="text-ui-sm text-vscode-description">
                  {tag.sha}
                  {tag.annotated ? " · annotated" : ""}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary" size="compact"
                disabled={busy}
                onClick={() => onCheckout(tag.name)}
              >
                Checkout
              </Button>
              <Button
                type="button"
                variant="secondary" size="compact"
                disabled={busy}
                onClick={() => onPush(tag.name)}
              >
                Push
              </Button>
              <Button
                type="button"
                variant="secondary" size="compact"
                disabled={busy}
                onClick={() => onDelete(tag.name)}
              >
                Delete
              </Button>
            </div>
          ))}
      </div>
    </GitDialogShell>
  );
}
