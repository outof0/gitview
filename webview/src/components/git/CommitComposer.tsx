import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { TextArea } from "../ui/TextArea";
import { Settings2 } from "lucide-react";

type CommitComposerProps = {
  message: string;
  amend: boolean;
  busy: boolean;
  canCommit: boolean;
  protectedBranch?: boolean;
  onMessageChange: (value: string) => void;
  onAmendChange: (value: boolean) => void;
  onCommit: () => void;
  onCommitAndPush: () => void;
  onOptions?: () => void;
};

export function CommitComposer({
  message,
  amend,
  busy,
  canCommit,
  protectedBranch = false,
  onMessageChange,
  onAmendChange,
  onCommit,
  onCommitAndPush,
  onOptions,
}: CommitComposerProps) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-vscode-sidebar-bg font-ui"
      data-testid="gitview-commit-panel"
    >
      <div className="flex h-toolbar min-h-toolbar shrink-0 items-center gap-control-gap px-pad-x">
        <Checkbox
          checked={amend}
          disabled={protectedBranch || busy}
          onChange={onAmendChange}
          testId="commit-amend"
        >
          Amend
        </Checkbox>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-pad-x pb-pad-x">
        <TextArea
          className="min-h-commit-body-min h-full flex-1 resize-none bg-panel-bg border-nx-border"
          placeholder="Commit Message"
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          data-testid="commit-message"
        />
      </div>
      <div className="flex shrink-0 items-center gap-control-gap border-t border-border px-pad-x py-footer-pad-y">
        <Button
          variant="primary"
          size="default"
          disabled={!canCommit}
          onClick={onCommit}
          data-testid="commit-button"
        >
          Commit
        </Button>
        <Button
          variant="secondary"
          size="default"
          disabled={!canCommit}
          onClick={onCommitAndPush}
          data-testid="commit-and-push-button"
        >
          Commit and Push...
        </Button>
        <span className="flex-1" />
        <Button
          variant="toolbar"
          size="icon"
          aria-label="Commit options"
          title="Commit options"
          onClick={() => onOptions?.()}
          data-testid="commit-options"
        >
          <Settings2 size={14} aria-hidden />
        </Button>
      </div>
    </section>
  );
}
