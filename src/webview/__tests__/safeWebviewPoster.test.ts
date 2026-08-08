import { describe, expect, it, vi } from "vitest";
import type { Logger } from "../../observability/logger";
import { createSafeWebviewPoster } from "../safeWebviewPoster";

function logger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("createSafeWebviewPoster", () => {
  it("does not deliver messages after disposal", () => {
    const target = { postMessage: vi.fn(async () => true) };
    const poster = createSafeWebviewPoster(target, logger(), "history");

    poster.dispose();
    poster.postMessage({ type: "test" });

    expect(target.postMessage).not.toHaveBeenCalled();
  });

  it("logs unexpected delivery failures while the view is live", async () => {
    const log = logger();
    const target = {
      postMessage: vi.fn(async () => {
        throw new Error("delivery failed");
      }),
    };
    const poster = createSafeWebviewPoster(target, log, "history");

    poster.postMessage({ type: "test" });
    await Promise.resolve();
    await Promise.resolve();

    expect(log.warn).toHaveBeenCalledWith("webview.post-message.failed", {
      surface: "history",
      errorName: "Error",
      errorMessage: "delivery failed",
    });
  });

  it("suppresses an in-flight rejection after disposal", async () => {
    const log = logger();
    let reject: ((error: Error) => void) | undefined;
    const target = {
      postMessage: vi.fn(
        () =>
          new Promise<boolean>((_resolve, rejectPromise) => {
            reject = rejectPromise;
          }),
      ),
    };
    const poster = createSafeWebviewPoster(target, log, "history");

    poster.postMessage({ type: "test" });
    poster.dispose();
    reject?.(new Error("Webview is disposed"));
    await Promise.resolve();
    await Promise.resolve();

    expect(log.warn).not.toHaveBeenCalled();
  });
});
