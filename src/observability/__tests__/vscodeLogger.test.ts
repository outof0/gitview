import { describe, expect, it, vi } from "vitest";
import { createOutputChannelLogger } from "../vscodeLogger";

describe("createOutputChannelLogger", () => {
  it("writes structured records and redacts credentials", () => {
    const appendLine = vi.fn();
    const logger = createOutputChannelLogger({ appendLine });

    logger.error("request.failed", {
      requestId: "request-1",
      error: new Error(
        "https://user:secret@example.com ghp_abcdefghijklmnopqrstuvwxyz",
      ),
    });

    const record = JSON.parse(appendLine.mock.calls[0]![0]) as Record<
      string,
      unknown
    >;
    expect(record.level).toBe("error");
    expect(record.event).toBe("request.failed");
    expect(record.requestId).toBe("request-1");
    expect(JSON.stringify(record)).not.toContain("secret");
    expect(JSON.stringify(record)).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
    expect(JSON.stringify(record)).toContain("[REDACTED]");
  });

  it("bounds recursive diagnostic fields", () => {
    const appendLine = vi.fn();
    const logger = createOutputChannelLogger({ appendLine });
    const recursive: { self?: unknown } = {};
    recursive.self = recursive;

    expect(() => logger.warn("recursive", { recursive })).not.toThrow();
    expect(appendLine.mock.calls[0]![0]).toContain("[TRUNCATED]");
  });
});
