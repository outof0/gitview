import { Button } from "../ui/Button";
import { Plus } from "lucide-react";
import type { ChangeList } from "@gitview/shared/types/status";
import { ScrollArea } from "../ui/ScrollArea";

type ChangelistBarProps = {
  changelists: ChangeList[];
  busy?: boolean;
  onActivate: (listId: string) => void;
  onCreate: (name: string) => void;
};

export function ChangelistBar({
  changelists,
  busy = false,
  onActivate,
  onCreate,
}: ChangelistBarProps) {
  if (changelists.length === 0) {
    return null;
  }

  return (
    <ScrollArea
      axis="horizontal"
      className="shrink-0 flex items-center gap-1 px-2 py-1 border-b border-border"
      data-testid="changelist-bar"
    >
      {changelists.map((list) => (
        <Button variant="ghost" size="content"
          key={list.id}
          type="button"
          className={`h-6 px-2 text-ui-sm rounded-vscode whitespace-nowrap ${
            list.active
              ? "bg-list-active text-list-active-foreground"
              : "hover:bg-list-hover"
          }`}
          disabled={busy || list.active}
          onClick={() => onActivate(list.id)}
          data-testid={`changelist-${list.id}`}
        >
          {list.name}
          <span className="ml-1 opacity-70">({list.filePaths.length})</span>
        </Button>
      ))}
      <Button variant="ghost" size="content"
        type="button"
        className="h-6 px-2 flex items-center gap-1 text-ui-sm rounded-vscode hover:bg-list-hover disabled:opacity-40"
        disabled={busy}
        onClick={() => {
          const name = window.prompt("New changelist name");
          if (name?.trim()) {
            onCreate(name.trim());
          }
        }}
        data-testid="changelist-create"
      >
        <Plus size={12} aria-hidden />
        New
      </Button>
    </ScrollArea>
  );
}