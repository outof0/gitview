import { describe, expect, it, vi } from "vitest";
import { errorMessageOf, reportDiffOpenError } from "../userError";

const showToast = vi.fn();

vi.mock("../../stores/gitViewStore", () => ({
  useGitViewStore: {
    getState: () => ({ showToast }),
  },
}));

describe("errorMessageOf", () => {
  it("prefers the message and falls back to the error name", () => {
    expect(errorMessageOf(new Error("boom"))).toBe("boom");
    // `String(error)` on a message-less Error yields "Error", which tells the
    // user nothing.
    const nameless = new Error();
    nameless.message = "";
    expect(errorMessageOf(nameless)).toBe("Error");
  });

  it("stringifies anything that is not an Error", () => {
    expect(errorMessageOf("disk full")).toBe("disk full");
    expect(errorMessageOf(42)).toBe("42");
    expect(errorMessageOf(undefined)).toBe("undefined");
  });
});

describe("reportDiffOpenError", () => {
  it("raises a blocking toast with the underlying reason", () => {
    showToast.mockClear();
    reportDiffOpenError(new Error("editor unavailable"));
    expect(showToast).toHaveBeenCalledWith(
      "Could not open the diff in the editor: editor unavailable",
      "error",
    );
  });
});
