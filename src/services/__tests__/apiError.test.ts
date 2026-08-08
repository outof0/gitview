import { describe, expect, it } from "vitest";
import { formatProviderApiError, redactSecrets } from "../review/apiError";

describe("apiError", () => {
  it("redacts secrets from error text", () => {
    expect(redactSecrets("Token glpat-secret failed", ["glpat-secret"])).toBe(
      "Token [REDACTED] failed",
    );
  });

  it("formats provider API errors with JSON message", () => {
    const message = formatProviderApiError(
      "GitLab",
      401,
      JSON.stringify({ message: "401 Unauthorized" }),
      "glpat-secret",
    );
    expect(message).toBe("GitLab API 401: 401 Unauthorized");
    expect(message).not.toContain("glpat-secret");
  });
});