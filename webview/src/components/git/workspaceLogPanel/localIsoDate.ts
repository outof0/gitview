/**
 * Calendar-date helpers for the log filter bar.
 *
 * Everything here is deliberately *local* time. A git commit's calendar day is
 * what the user means when they pick "Since 2024-01-01", so formatting through
 * `toISOString()` (UTC) shifts the day for anyone east of Greenwich. The date
 * picker and the relative presets must agree, so both go through this module.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Formats a Date as YYYY-MM-DD using local calendar fields. */
export function toLocalIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses YYYY-MM-DD into a local-midnight Date, or null when unusable. */
export function parseLocalIso(value: string | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year!, month! - 1, day!);
  // Rejects overflow dates such as 2024-02-31, which Date would roll forward.
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month! - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Local calendar day N days before today, as YYYY-MM-DD. */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() - days);
  return toLocalIso(date);
}

/** First day of `date`'s month, at local midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
