import { describe, expect, it } from "vitest";
import {
  createSafeLogger,
  sanitizeLogMessage,
  toUserFacingGitError,
} from "../safeLog";

describe("safeLog", () => {
  it("redacts github and gitlab token patterns", () => {
    const message = sanitizeLogMessage(
      "Auth failed for ghp_abcdefghijklmnopqrstuvwxyz123456 and glpat-abcdefghijklmnopqrstuvwxyz123456",
    );
    expect(message).not.toContain("ghp_");
    expect(message).not.toContain("glpat-");
    expect(message).toContain("[REDACTED]");
  });

  it("redacts URL userinfo credentials", () => {
    const message = sanitizeLogMessage(
      "fatal: unable to access 'https://user:secret-token@github.com/org/repo.git/': 403",
    );
    expect(message).not.toContain("secret-token");
    expect(message).toContain("://[REDACTED]@");
  });

  it("redacts generic authorization and query credentials", () => {
    const message = sanitizeLogMessage(
      "Authorization: Bearer abcdefghijklmnop https://example.test?q=1&access_token=plain-secret",
    );
    expect(message).not.toContain("abcdefghijklmnop");
    expect(message).not.toContain("plain-secret");
    expect(message).toContain("[REDACTED]");
  });

  it("redacts configured secrets via createSafeLogger", () => {
    const lines: string[] = [];
    const logger = createSafeLogger((line) => lines.push(line), [
      "super-secret-token",
    ]);
    logger.debug("Review token super-secret-token rejected");
    expect(lines[0]).toBe("Review token [REDACTED] rejected");
  });

  it("toUserFacingGitError strips Command failed prefix and redacts credentials", () => {
    const err = new Error(
      "Command failed: git push\nfatal: https://u:ghp_abcdefghijklmnopqrstuvwxyz123456@host/repo.git rejected",
    );
    const msg = toUserFacingGitError(err);
    expect(msg).not.toMatch(/Command failed: git/i);
    expect(msg).not.toContain("ghp_");
    expect(msg).toContain("[REDACTED]");
  });
});
