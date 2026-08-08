import { describe, it, expect } from "vitest";
import { makeFakeGit } from "./gitService.testHelpers";

describe("GitService merge checkout helpers", () => {
  it("checkoutOurs uses git checkout --ours", async () => {
    const { service, calls } = makeFakeGit({
      "checkout --ours -- src/app.tsx": { stdout: "", stderr: "" },
    });
    await service.checkoutOurs("/repo", "src/app.tsx");
    expect(calls[0]!.args).toEqual(["checkout", "--ours", "--", "src/app.tsx"]);
  });

  it("checkoutTheirs uses git checkout --theirs", async () => {
    const { service, calls } = makeFakeGit({
      "checkout --theirs -- src/app.tsx": { stdout: "", stderr: "" },
    });
    await service.checkoutTheirs("/repo", "src/app.tsx");
    expect(calls[0]!.args).toEqual([
      "checkout",
      "--theirs",
      "--",
      "src/app.tsx",
    ]);
  });

  it("abortMerge calls git merge --abort", async () => {
    const { service, calls } = makeFakeGit({
      "merge --abort": { stdout: "", stderr: "" },
    });
    await service.abortMerge("/repo");
    expect(calls[0]!.args).toEqual(["merge", "--abort"]);
  });
});

describe("GitService addFile", () => {
  it("calls git add with path", async () => {
    const { service, calls } = makeFakeGit({
      "add -- src/app.tsx": { stdout: "", stderr: "" },
    });
    await service.addFile("/repo", "src/app.tsx");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toEqual(["add", "--", "src/app.tsx"]);
  });
});