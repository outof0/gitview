import * as fs from "fs/promises";
import * as path from "path";
import { detectEol } from "../../core/lines";
import type { GitExecFn } from "./types";

export type CrlfCheckResult = {
  warn: boolean;
  message: string | null;
  fileEol: "lf" | "crlf" | "mixed";
  expectedEol: "lf" | "crlf" | "any";
};

function parseGitAttrEol(stdout: string): "lf" | "crlf" | "any" {
  for (const line of stdout.split("\n")) {
    const match = line.match(/:\s*eol:\s*(\S+)/);
    if (match?.[1] === "lf" || match?.[1] === "crlf") {
      return match[1];
    }
    if (line.includes("text") && !line.includes("-text")) {
      return "lf";
    }
  }
  return "any";
}

export function createCrlfCheckApi(execGit: GitExecFn) {
  async function checkFile(
    repoRoot: string,
    relativePath: string,
  ): Promise<CrlfCheckResult> {
    let fileEol: CrlfCheckResult["fileEol"] = "lf";
    try {
      const content = await fs.readFile(
        path.join(repoRoot, relativePath),
        "utf8",
      );
      fileEol = detectEol(content);
    } catch {
      return { warn: false, message: null, fileEol, expectedEol: "any" };
    }

    let expectedEol: CrlfCheckResult["expectedEol"] = "any";
    try {
      const { stdout } = await execGit(repoRoot, [
        "check-attr",
        "eol",
        "text",
        "--",
        relativePath,
      ]);
      expectedEol = parseGitAttrEol(stdout);
    } catch {
      expectedEol = "any";
    }

    if (expectedEol === "any") {
      return { warn: false, message: null, fileEol, expectedEol };
    }

    const mismatch =
      (expectedEol === "lf" && fileEol !== "lf") ||
      (expectedEol === "crlf" && fileEol !== "crlf");

    if (!mismatch) {
      return { warn: false, message: null, fileEol, expectedEol };
    }

    return {
      warn: true,
      message: `${relativePath} uses ${fileEol.toUpperCase()} line endings but Git attributes expect ${expectedEol.toUpperCase()}.`,
      fileEol,
      expectedEol,
    };
  }

  return { checkFile };
}