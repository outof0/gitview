import { describe, it, expect } from "vitest";
import { makeFakeGit } from "./gitService.testHelpers";

describe("GitService isBinaryFile", () => {
  it("detects binary via numstat", async () => {
    const { service } = makeFakeGit({
      "diff --numstat -- image.png": {
        stdout: "-\t-\timage.png\n",
        stderr: "",
      },
    });
    const isBinary = await service.isBinaryFile("/repo", "image.png");
    expect(isBinary).toBe(true);
  });

  it("detects text file via numstat", async () => {
    const { service } = makeFakeGit({
      "diff --numstat -- src/app.tsx": {
        stdout: "10\t5\tsrc/app.tsx\n",
        stderr: "",
      },
    });
    const isBinary = await service.isBinaryFile("/repo", "src/app.tsx");
    expect(isBinary).toBe(false);
  });

  it("detects binary via unmerged stage numstat when worktree diff is 0/0", async () => {
    const { service } = makeFakeGit({
      "diff --numstat -- binary.png": {
        stdout: "0\t0\tbinary.png\n",
        stderr: "",
      },
      "diff --numstat :1:binary.png :2:binary.png": {
        stdout: "-\t-\tbinary.png\n",
        stderr: "",
      },
    });
    const isBinary = await service.isBinaryFile("/repo", "binary.png");
    expect(isBinary).toBe(true);
  });
});