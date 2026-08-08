import { Plus } from "lucide-react";
import type { ChangeList } from "@gitview/shared/types/status";

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
    <div
      className="shrink-0 flex items-center gap-1 px-2 py-1 border-b border-border overflow-x-auto"
      data-testid="changelist-bar"
    >
      {changelists.map((list) => (
        <button
          key={list.id}
          type="button"
          className={`h-6 px-2 text-[11px] rounded-vscode whitespace-nowrap ${
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
        </button>
      ))}
      <button
        type="button"
        className="h-6 px-2 flex items-center gap-1 text-[11px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
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
      </button>
    </div>
  );
}