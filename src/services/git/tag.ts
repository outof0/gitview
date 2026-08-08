import type { TagEntry } from "../../shared/types/tag";
import type { GitExecFn } from "./types";

export function createTagApi(execGit: GitExecFn) {
  async function listTagEntries(
    repoRoot: string,
    repoId: string,
  ): Promise<TagEntry[]> {
    const { stdout } = await execGit(repoRoot, [
      "for-each-ref",
      "--format=%(refname:short)|%(objectname:short)|%(objecttype)|%(subject)|%(taggername)|%(taggerdate:unix)",
      "refs/tags/",
    ]);

    const tags: TagEntry[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const [name, sha, objectType, subject, tagger, taggerTimeStr] =
        trimmed.split("|");
      if (!name || !sha) {
        continue;
      }
      tags.push({
        repoId,
        name,
        sha,
        annotated: objectType === "tag",
        message: subject || undefined,
        tagger: tagger || undefined,
        taggerTime: taggerTimeStr
          ? Number.parseInt(taggerTimeStr, 10)
          : undefined,
      });
    }
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function createAnnotated(
    repoRoot: string,
    name: string,
    message?: string,
    sha?: string,
  ): Promise<void> {
    const args = ["tag", "-a", name];
    if (message?.trim()) {
      args.push("-m", message.trim());
    }
    if (sha?.trim()) {
      args.push(sha.trim());
    }
    await execGit(repoRoot, args);
  }

  async function checkout(repoRoot: string, name: string): Promise<void> {
    try {
      await execGit(repoRoot, ["switch", "--detach", name]);
    } catch {
      await execGit(repoRoot, ["checkout", name]);
    }
  }

  async function push(
    repoRoot: string,
    tagName: string,
    remote = "origin",
  ): Promise<void> {
    await execGit(repoRoot, ["push", remote, tagName]);
  }

  async function deleteTag(repoRoot: string, name: string): Promise<void> {
    await execGit(repoRoot, ["tag", "-d", name]);
  }

  return {
    listTagEntries,
    createAnnotated,
    checkout,
    push,
    deleteTag,
  };
}