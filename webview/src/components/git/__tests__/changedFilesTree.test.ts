import { describe, it, expect } from "vitest";
import {
  buildChangedFilesTree,
  filterChangedFilesForScope,
  pickDefaultChangedFile,
} from "../changedFilesTree";
import type { GitChangedFile } from "@gitview/types";

describe("changedFilesTree", () => {
  const files: GitChangedFile[] = [
    { path: "src/app.ts", status: "M" },
    { path: "src/utils/helpers.ts", status: "A" },
    { path: "package.json", status: "M" },
  ];

  it("builds a nested directory tree", () => {
    const tree = buildChangedFilesTree(files);
    expect(tree.map((n) => n.name)).toEqual(["src", "package.json"]);
    const src = tree.find((n) => n.name === "src");
    expect(src?.isFolder).toBe(true);
    expect(src?.children.map((c) => c.name)).toEqual(["utils", "app.ts"]);
    const utils = src?.children.find((c) => c.name === "utils");
    expect(utils?.children[0]).toMatchObject({
      name: "helpers.ts",
      path: "src/utils/helpers.ts",
      status: "A",
    });
  });

  it("filters changed files to a folder scope", () => {
    const scoped = filterChangedFilesForScope(files, "src", true);
    expect(scoped.map((f) => f.path)).toEqual([
      "src/app.ts",
      "src/utils/helpers.ts",
    ]);
  });

  it("picks the history target file by default", () => {
    expect(pickDefaultChangedFile(files, "package.json", false)).toBe(
      "package.json",
    );
    expect(pickDefaultChangedFile(files, "src", true)).toBe("src/app.ts");
  });
});
