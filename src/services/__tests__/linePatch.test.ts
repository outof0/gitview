import { describe, expect, it } from "vitest";
import { extractLinePatch } from "../git/linePatch";

const SAMPLE_DIFF = `diff --git a/sample.txt b/sample.txt
index 1234567..89abcde 100644
--- a/sample.txt
+++ b/sample.txt
@@ -1,5 +1,5 @@
 line1
-line2
+line2-changed
 line3
-line4
+line4-changed
 line5
`;

describe("extractLinePatch", () => {
  it("builds a patch for a single selected new line", () => {
    const patch = extractLinePatch(SAMPLE_DIFF, [{ side: "new", line: 2 }]);
    expect(patch).toBeTruthy();
    expect(patch).toContain("-line2");
    expect(patch).toContain("+line2-changed");
    expect(patch).not.toContain("line4-changed");
  });

  it("builds a patch for a single selected old line", () => {
    const patch = extractLinePatch(SAMPLE_DIFF, [{ side: "old", line: 4 }]);
    expect(patch).toBeTruthy();
    expect(patch).toContain("-line4");
    expect(patch).toContain("+line4-changed");
    expect(patch).not.toContain("line2-changed");
  });

  it("returns null when no selection matches", () => {
    const patch = extractLinePatch(SAMPLE_DIFF, [{ side: "new", line: 99 }]);
    expect(patch).toBeNull();
  });
});