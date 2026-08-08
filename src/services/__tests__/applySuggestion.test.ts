import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySuggestionToContent,
  applySuggestionToFile,
} from "../review/applySuggestion";

describe("applySuggestionToContent", () => {
  it("replaces a single line with suggestion text", () => {
    const result = applySuggestionToContent(
      "line1\nold\nline3\n",
      2,
      undefined,
      "new",
    );
    expect(result).toBe("line1\nnew\nline3\n");
  });

  it("replaces a line range with multiline suggestion", () => {
    const result = applySuggestionToContent(
      "a\nb\nc\nd\n",
      3,
      2,
      "x\ny",
    );
    expect(result).toBe("a\nx\ny\nd\n");
  });
});

describe("applySuggestionToFile", () => {
  let tmpRoot: string;

  afterEach(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  async function makeRepoWithFile(
    relative: string,
    content: string,
  ): Promise<{ repoRoot: string; absolute: string }> {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-apply-sug-"));
    const absolute = path.join(tmpRoot, relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content);
    return { repoRoot: tmpRoot, absolute };
  }

  it("writes a suggestion into a valid repo-relative path", async () => {
    const { repoRoot, absolute } = await makeRepoWithFile(
      "src/file.ts",
      "a\nold\nc\n",
    );
    await applySuggestionToFile(repoRoot, "src/file.ts", 2, undefined, "new");
    expect(await fs.readFile(absolute, "utf8")).toBe("a\nnew\nc\n");
  });

  it("rejects parent traversal paths without writing outside the repo", async () => {
    const { repoRoot } = await makeRepoWithFile("inside.txt", "keep\n");
    const outside = path.join(repoRoot, "..", "escape-target.txt");
    await fs.writeFile(outside, "safe\n");
    await expect(
      applySuggestionToFile(repoRoot, "../escape-target.txt", 1, undefined, "x"),
    ).rejects.toThrow(/relative path|Invalid|inside the repository/i);
    expect(await fs.readFile(outside, "utf8")).toBe("safe\n");
  });

  it("rejects absolute paths", async () => {
    const { repoRoot } = await makeRepoWithFile("inside.txt", "keep\n");
    await expect(
      applySuggestionToFile(repoRoot, "/etc/passwd", 1, undefined, "x"),
    ).rejects.toThrow(/relative path|Invalid|inside the repository/i);
  });
});
