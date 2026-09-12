import { describe, expect, it } from "vitest";
import {
  isoDaysAgo,
  parseLocalIso,
  startOfMonth,
  toLocalIso,
} from "../localIsoDate";

describe("toLocalIso", () => {
  it("zero-pads month and day", () => {
    expect(toLocalIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses local calendar fields, not UTC", () => {
    // 23:30 local on the 29th. A UTC-based formatter would report the 28th
    // for any positive offset, and the 30th for any negative one.
    expect(toLocalIso(new Date(2026, 7, 29, 23, 30))).toBe("2026-08-29");
  });

  it("keeps the year boundary on the local side", () => {
    expect(toLocalIso(new Date(2025, 11, 31, 23, 59))).toBe("2025-12-31");
  });
});

describe("parseLocalIso", () => {
  it("round-trips a date produced by toLocalIso", () => {
    const date = new Date(2026, 6, 4);
    expect(parseLocalIso(toLocalIso(date))).toEqual(date);
  });

  it("returns null for blank, malformed, or partial values", () => {
    expect(parseLocalIso(undefined)).toBeNull();
    expect(parseLocalIso("")).toBeNull();
    expect(parseLocalIso("2026-1-5")).toBeNull();
    expect(parseLocalIso("2026-01")).toBeNull();
    expect(parseLocalIso("not-a-date")).toBeNull();
  });

  it("rejects out-of-range days instead of rolling into the next month", () => {
    expect(parseLocalIso("2024-02-31")).toBeNull();
    expect(parseLocalIso("2026-13-01")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(parseLocalIso("2024-02-29")).toEqual(new Date(2024, 1, 29));
  });
});

describe("isoDaysAgo", () => {
  it("is stable whether or not the local day has wrapped in UTC", () => {
    // 06:20 local. East of Greenwich this instant is still the previous UTC
    // day, so a toISOString-based implementation loses a day here.
    expect(isoDaysAgo(1, new Date(2026, 7, 29, 6, 20))).toBe("2026-08-28");
    // 23:30 local. West of Greenwich this instant is already the next UTC day,
    // so a toISOString-based implementation gains a day here.
    expect(isoDaysAgo(1, new Date(2026, 7, 29, 23, 30))).toBe("2026-08-28");
  });

  it("counts back the requested number of calendar days", () => {
    const now = new Date(2026, 7, 29, 12, 0);
    expect(isoDaysAgo(0, now)).toBe("2026-08-29");
    expect(isoDaysAgo(1, now)).toBe("2026-08-28");
    expect(isoDaysAgo(7, now)).toBe("2026-08-22");
    expect(isoDaysAgo(30, now)).toBe("2026-07-30");
  });

  it("crosses month and year boundaries", () => {
    expect(isoDaysAgo(1, new Date(2026, 0, 1, 12, 0))).toBe("2025-12-31");
    expect(isoDaysAgo(1, new Date(2026, 2, 1, 12, 0))).toBe("2026-02-28");
    expect(isoDaysAgo(1, new Date(2024, 2, 1, 12, 0))).toBe("2024-02-29");
  });

  it("defaults to today", () => {
    expect(isoDaysAgo(0)).toBe(toLocalIso(new Date()));
  });

  it("stays consistent with the value the picker writes", () => {
    // The presets and the calendar grid are two views of the same filter; if
    // they disagree by a day the user sees the range jump after reopening.
    const now = new Date(2026, 7, 29, 6, 20);
    const preset = isoDaysAgo(7, now);
    expect(parseLocalIso(preset)).toEqual(new Date(2026, 7, 22));
  });
});

describe("startOfMonth", () => {
  it("returns local midnight on the first of the month", () => {
    expect(startOfMonth(new Date(2026, 7, 29, 18, 45))).toEqual(
      new Date(2026, 7, 1),
    );
  });
});
