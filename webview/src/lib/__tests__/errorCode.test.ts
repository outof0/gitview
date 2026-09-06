import { describe, expect, it } from "vitest";
import { errorCodeOf, isErrorCode } from "../errorCode";

describe("errorCodeOf", () => {
  it("reads a structured code off an Error", () => {
    const error = Object.assign(new Error("nope"), { code: "AUTH_REQUIRED" });
    expect(errorCodeOf(error)).toBe("AUTH_REQUIRED");
  });

  it("returns undefined for non-string codes and non-Error values", () => {
    expect(errorCodeOf(Object.assign(new Error("x"), { code: 42 }))).toBeUndefined();
    expect(errorCodeOf(new Error("plain"))).toBeUndefined();
    expect(errorCodeOf("GIT_COMMAND_FAILED")).toBeUndefined();
    expect(errorCodeOf(undefined)).toBeUndefined();
  });
});

describe("isErrorCode", () => {
  it("matches only the exact code", () => {
    const error = Object.assign(new Error("denied"), { code: "AUTH_REQUIRED" });
    expect(isErrorCode(error, "AUTH_REQUIRED")).toBe(true);
    expect(isErrorCode(error, "NETWORK_OFFLINE")).toBe(false);
    expect(isErrorCode("AUTH_REQUIRED", "AUTH_REQUIRED")).toBe(false);
  });
});
