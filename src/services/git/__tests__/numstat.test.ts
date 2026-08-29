import { describe, expect, it, vi } from "vitest";
import {
  createNumstatApi,
  isValidRefSpec,
  parseNumstatTotals,
} from "../numstat";

describe("parseNumstatTotals", () => {
  it("sums additions and deletions across rows", () => {
    const stdout = [
      "12\t3\tsrc/a.ts",
      "0\t40\tsrc/b.ts",
      "",
      "5\t2\tsrc/dir/c.ts",
    ].join("\n");
    expect(parseNumstatTotals(stdout)).toEqual({ additions: 17, deletions: 45 });
  });

  it("treats binary rows as zero", () => {
    expect(parseNumstatTotals("-\t-\tassets/logo.png")).toEqual({
      additions: 0,
      deletions: 0,
    });
  });

  it("returns zeros for empty output", () => {
    expect(parseNumstatTotals("")).toEqual({ additions: 0, deletions: 0 });
  });
});

describe("isValidRefSpec", () => {
  it("accepts normal refs and range specs", () => {
    expect(isValidRefSpec("HEAD")).toBe(true);
    expect(isValidRefSpec("main")).toBe(true);
    expect(isValidRefSpec("main...feature")).toBe(true);
    expect(isValidRefSpec("origin/main")).toBe(true);
  });

  it("rejects option-like refs", () => {
    expect(isValidRefSpec("--output=/tmp/file")).toBe(false);
    expect(isValidRefSpec("-p")).toBe(false);
    expect(isValidRefSpec(" --all")).toBe(false);
  });

  it("rejects control characters and shell metachars", () => {
    expect(isValidRefSpec("branch\x00")).toBe(false);
    expect(isValidRefSpec("a;b")).toBe(false);
    expect(isValidRefSpec("a|b")).toBe(false);
    expect(isValidRefSpec("a&b")).toBe(false);
    expect(isValidRefSpec("a$b")).toBe(false);
  });
});

describe("createNumstatApi", () => {
  it("rejects ref starting with dash before invoking git", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const api = createNumstatApi(exec);
    await expect(api.totalsForRefSpec("/repo", "--output=/tmp/file")).rejects.toThrow(
      /Invalid refSpec/,
    );
    expect(exec).not.toHaveBeenCalled();
  });

  it("passes -- end-of-options after refSpec", async () => {
    const exec = vi.fn(async () => ({ stdout: "2\t1\ta.txt\n", stderr: "" }));
    const api = createNumstatApi(exec);
    await api.totalsForRefSpec("/repo", "HEAD");
    expect(exec).toHaveBeenCalledWith("/repo", ["diff", "--numstat", "HEAD", "--"]);
  });

  it("totalsForPaths uses HEAD diff only without double-counting staged", async () => {
    const exec = vi.fn(async (_repo: string, args: string[]) => {
      const key = args.join(" ");
      if (key.includes("diff HEAD")) {
        return { stdout: "2\t1\ta.txt\n1\t0\tb.txt\n", stderr: "" };
      }
      if (key.includes("--cached")) {
        return { stdout: "10\t10\ta.txt\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });
    const api = createNumstatApi(exec);
    const totals = await api.totalsForPaths("/repo", ["a.txt", "b.txt"]);
    expect(totals).toEqual({ additions: 3, deletions: 1 });
    const calls = exec.mock.calls.map((c) => (c[1] as string[]).join(" "));
    expect(calls.some((c) => c.includes("--cached"))).toBe(false);
    expect(calls[0]).toContain("diff HEAD --numstat -- a.txt b.txt");
  });

  it("returns zeros for empty paths without calling git", async () => {
    const exec = vi.fn(async () => ({ stdout: "1\t1\ta.txt\n", stderr: "" }));
    const api = createNumstatApi(exec);
    expect(await api.totalsForPaths("/repo", [])).toEqual({ additions: 0, deletions: 0 });
    expect(exec).not.toHaveBeenCalled();
  });
});
