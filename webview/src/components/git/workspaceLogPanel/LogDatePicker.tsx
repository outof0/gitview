import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  parseLocalIso,
  startOfMonth,
  toLocalIso,
} from "./localIsoDate";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const fieldCls =
  "h-7 w-full min-w-0 box-border px-2 text-[length:var(--vscode-font-size,13px)] leading-none rounded-sm border border-[var(--vscode-input-border,var(--border))] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground,var(--vscode-editor-foreground))] placeholder:text-[var(--vscode-input-placeholderForeground,var(--vscode-descriptionForeground))]";

type LogDatePickerProps = {
  since?: string;
  until?: string;
  onChange: (next: { since?: string; until?: string }) => void;
};

export function LogDatePicker({ since, until, onChange }: LogDatePickerProps) {
  const [picking, setPicking] = useState<"since" | "until">("since");
  const selected = picking === "since" ? since : until;
  const [cursor, setCursor] = useState(() =>
    startOfMonth(parseLocalIso(selected) ?? new Date()),
  );

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    const items: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < startWeekday; i += 1) {
      items.push({ iso: `pad-${i}`, day: 0, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      items.push({ iso: toLocalIso(date), day, inMonth: true });
    }
    return items;
  }, [cursor]);

  const monthLabel = cursor.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayIso = toLocalIso(new Date());

  return (
    <div className="flex flex-col gap-1" data-testid="log-date-picker">
      <label className="px-0.5 text-[12px] text-vscode-description">Since</label>
      <div className="relative">
        <input
          type="text"
          className={`${fieldCls} pr-7 ${picking === "since" ? "outline outline-1 outline-[var(--vscode-focusBorder)]" : ""}`}
          placeholder="YYYY-MM-DD"
          value={since ?? ""}
          onFocus={() => {
            setPicking("since");
            setCursor(startOfMonth(parseLocalIso(since) ?? new Date()));
          }}
          onChange={(e) => onChange({ since: e.target.value, until })}
          data-testid="log-filter-since"
        />
        {since ? (
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded-sm text-vscode-description hover:bg-list-hover hover:text-foreground"
            onClick={() => onChange({ since: undefined, until })}
            aria-label="Clear Since"
            tabIndex={-1}
          >
            <X size={12} aria-hidden />
          </button>
        ) : null}
      </div>
      <label className="px-0.5 text-[12px] text-vscode-description">Until</label>
      <div className="relative">
        <input
          type="text"
          className={`${fieldCls} pr-7 ${picking === "until" ? "outline outline-1 outline-[var(--vscode-focusBorder)]" : ""}`}
          placeholder="YYYY-MM-DD"
          value={until ?? ""}
          onFocus={() => {
            setPicking("until");
            setCursor(startOfMonth(parseLocalIso(until) ?? new Date()));
          }}
          onChange={(e) => onChange({ since, until: e.target.value })}
          data-testid="log-filter-until"
        />
        {until ? (
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded-sm text-vscode-description hover:bg-list-hover hover:text-foreground"
            onClick={() => onChange({ since, until: undefined })}
            aria-label="Clear Until"
            tabIndex={-1}
          >
            <X size={12} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-0.5 pt-1">
        <button
          type="button"
          className="h-5 w-5 inline-flex items-center justify-center rounded-sm text-vscode-description hover:bg-list-hover hover:text-foreground"
          aria-label="Previous month"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          <ChevronLeft size={14} aria-hidden />
        </button>
        <span className="text-[length:var(--vscode-font-size,13px)] font-semibold">
          {monthLabel}
        </span>
        <button
          type="button"
          className="h-5 w-5 inline-flex items-center justify-center rounded-sm text-vscode-description hover:bg-list-hover hover:text-foreground"
          aria-label="Next month"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          <ChevronRight size={14} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="h-6 text-center text-[11px] leading-6 text-vscode-description"
          >
            {day}
          </span>
        ))}
        {cells.map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.iso} className="h-7" />;
          }
          const isSelected = cell.iso === selected;
          const isToday = cell.iso === todayIso;
          return (
            <button
              key={cell.iso}
              type="button"
              className={`h-7 w-full flex items-center justify-center p-0 text-[length:var(--vscode-font-size,13px)] leading-none rounded-sm ${
                isSelected
                  ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
                  : isToday
                    ? "text-[var(--vscode-textLink-foreground)] hover:bg-list-hover"
                    : "hover:bg-list-hover"
              }`}
              onClick={() => {
                if (picking === "since") {
                  onChange({ since: cell.iso, until });
                } else {
                  onChange({ since, until: cell.iso });
                }
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
