import { describe, expect, it, vi } from "vitest";
import {
  isLogLevelSetting,
  withMinimumLevel,
  type Logger,
  type LogLevelSetting,
} from "../logger";

function recordingLogger(): { logger: Logger; events: string[] } {
  const events: string[] = [];
  const record = (level: string) => (event: string) =>
    void events.push(`${level}:${event}`);
  return {
    logger: {
      debug: record("debug"),
      info: record("info"),
      warn: record("warn"),
      error: record("error"),
    },
    events,
  };
}

function emitAll(logger: Logger): void {
  logger.debug("d");
  logger.info("i");
  logger.warn("w");
  logger.error("e");
}

describe("withMinimumLevel", () => {
  it("keeps only records at or above the threshold", () => {
    const { logger, events } = recordingLogger();

    emitAll(withMinimumLevel(logger, () => "warn"));

    expect(events).toEqual(["warn:w", "error:e"]);
  });

  it("silences everything when the level is off", () => {
    const { logger, events } = recordingLogger();

    emitAll(withMinimumLevel(logger, () => "off"));

    expect(events).toEqual([]);
  });

  it("re-reads the threshold so a settings change takes effect immediately", () => {
    const { logger, events } = recordingLogger();
    let level: LogLevelSetting = "error";
    const filtered = withMinimumLevel(logger, () => level);

    filtered.info("before");
    level = "info";
    filtered.info("after");

    expect(events).toEqual(["info:after"]);
  });

  it("forwards fields untouched", () => {
    const debug = vi.fn();
    const filtered = withMinimumLevel(
      { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      () => "debug",
    );

    filtered.debug("event", { traceId: "refresh-1" });

    expect(debug).toHaveBeenCalledWith("event", { traceId: "refresh-1" });
  });

  it("rejects values that are not selectable levels", () => {
    expect(isLogLevelSetting("debug")).toBe(true);
    expect(isLogLevelSetting("off")).toBe(true);
    expect(isLogLevelSetting("verbose")).toBe(false);
    expect(isLogLevelSetting(undefined)).toBe(false);
  });
});
