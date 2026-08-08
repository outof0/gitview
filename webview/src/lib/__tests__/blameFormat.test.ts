import { describe, expect, it } from "vitest";
import {
  formatBlameAnnotationDate,
  formatBlameAnnotationLabel,
  isCurrentRevisionLine,
} from "../blameFormat";

describe("blameFormat", () => {
  it("formats compact D/M/YY dates", () => {
    expect(formatBlameAnnotationDate(1_633_353_600)).toBe("4/10/21");
  });

  it("builds per-line annotate labels with commit message", () => {
    const line = {
      author: "Jane",
      authorTime: 1_633_353_600,
      sha: "abc1234567890abcdef1234567890abcdef1234",
      summary: "feat: add presets",
    };
    expect(formatBlameAnnotationLabel(line, line.sha)).toBe(
      "4/10/21 Jane feat: add presets *",
    );
    expect(formatBlameAnnotationLabel(line, null)).toBe(
      "4/10/21 Jane feat: add presets",
    );
  });

  it("detects current revision lines by full or short sha", () => {
    const head = "abc1234567890abcdef1234567890abcdef1234";
    expect(isCurrentRevisionLine(head, head)).toBe(true);
    expect(isCurrentRevisionLine("abc1234", head)).toBe(true);
    expect(isCurrentRevisionLine("deadbeef", head)).toBe(false);
  });
});