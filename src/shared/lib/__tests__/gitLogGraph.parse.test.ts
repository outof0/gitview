import { describe, expect, it } from "vitest";
import { parseLogDagLines, uniqueRefTips } from "../gitLogGraph";

describe("parseLogDagLines", () => {
  it("parses NUL-delimited sha/parents/timestamp records", () => {
    const stdout = [
      ["aaa", "bbb ccc", "10"].join("\0"),
      ["bbb", "ddd", "9"].join("\0"),
      ["ccc", "ddd", "8"].join("\0"),
      ["ddd", "", "7"].join("\0"),
    ].join("\n");
    expect(parseLogDagLines(stdout)).toEqual([
      { sha: "aaa", parentShas: ["bbb", "ccc"], timestamp: 10 },
      { sha: "bbb", parentShas: ["ddd"], timestamp: 9 },
      { sha: "ccc", parentShas: ["ddd"], timestamp: 8 },
      { sha: "ddd", parentShas: [], timestamp: 7 },
    ]);
  });

  it("skips duplicate SHAs and blank lines", () => {
    const stdout = `${["aaa", "bbb", "1"].join("\0")}\n\n${["aaa", "zzz", "2"].join("\0")}\n`;
    expect(parseLogDagLines(stdout)).toEqual([
      { sha: "aaa", parentShas: ["bbb"], timestamp: 1 },
    ]);
  });
});

describe("uniqueRefTips", () => {
  it("puts HEAD first and drops duplicates", () => {
    expect(uniqueRefTips("aaa", ["bbb", "aaa", "ccc"])).toEqual([
      "aaa",
      "bbb",
      "ccc",
    ]);
  });
});
