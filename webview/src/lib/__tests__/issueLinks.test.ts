import { describe, expect, it } from "vitest";
import { parseIssueLinks } from "../issueLinks";

describe("parseIssueLinks", () => {
  it("parses JIRA-style and hash issue references", () => {
    const links = parseIssueLinks(
      "Fix NX-42 and closes #99",
      "https://tracker.example.com",
    );
    expect(links).toEqual([
      {
        id: "NX-42",
        label: "NX-42",
        url: "https://tracker.example.com/browse/NX-42",
      },
      {
        id: "99",
        label: "#99",
        url: "https://tracker.example.com/issues/99",
      },
    ]);
  });

  it("deduplicates repeated references", () => {
    const links = parseIssueLinks("NX-1 and NX-1 again");
    expect(links).toHaveLength(1);
  });
});