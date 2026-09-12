import type { LogDagSnapshot } from "../../shared/types/log";
import {
  parseLogDagLines,
  uniqueRefTips,
} from "../../shared/lib/gitLogGraph";
import type { GitExecFn } from "./types";

export type LogDagResult =
  | { ok: true; snapshot: Omit<LogDagSnapshot, "repoId"> }
  | { ok: false; code: "GIT_ERROR"; message: string };

function cacheKey(headSha: string | null, refTips: readonly string[]): string {
  return `${headSha ?? ""}:${refTips.join(",")}`;
}

export function createLogDagApi(execGit: GitExecFn) {
  const cache = new Map<string, Omit<LogDagSnapshot, "repoId">>();

  async function logDag(repoRoot: string): Promise<LogDagResult> {
    try {
      let headSha: string | null = null;
      try {
        const head = await execGit(repoRoot, ["rev-parse", "HEAD"]);
        headSha = head.stdout.trim() || null;
      } catch {
        headSha = null;
      }

      const refs = await execGit(repoRoot, [
        "for-each-ref",
        "--format=%(objectname)",
        "refs/heads",
        "refs/remotes",
        "refs/tags",
      ]);
      const refTips = uniqueRefTips(
        headSha,
        refs.stdout.split(/\s+/).filter(Boolean),
      );
      const key = `${repoRoot}\0${cacheKey(headSha, refTips)}`;
      const cached = cache.get(key);
      if (cached) {
        return { ok: true, snapshot: cached };
      }

      let stdout = "";
      if (headSha || refTips.length > 0) {
        try {
          const log = await execGit(repoRoot, [
            "log",
            "--format=%H%x00%P%x00%at",
            "--branches",
            "--remotes",
            "--tags",
            ...(headSha ? ["HEAD"] : []),
          ]);
          stdout = log.stdout;
        } catch (err) {
          if (headSha) {
            throw err;
          }
        }
      }
      const snapshot: Omit<LogDagSnapshot, "repoId"> = {
        headSha,
        refTips,
        nodes: parseLogDagLines(stdout),
        generatedAt: Date.now(),
      };
      cache.clear();
      cache.set(key, snapshot);
      return { ok: true, snapshot };
    } catch (err) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { logDag };
}
