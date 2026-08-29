import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Cap on how much file content is hashed in full. Past this budget we fall back
 * to size + mtime, which is weaker but still changes whenever the content does —
 * the property the confirmation fingerprint actually needs.
 */
const MAX_HASHED_BYTES = 8 * 1024 * 1024;

export type ChangedFileForDigest = {
  path: string;
  kind: string;
};

/**
 * Digest the *content* of the working tree's pending changes.
 *
 * `Repository.dirty` is a boolean: it cannot tell "the user edited file A" from
 * "the user then edited file A again, differently". Confirmation evidence that
 * only carries `dirty` therefore stays valid across arbitrary content changes,
 * so a hard reset / force checkout / rollback confirmed a minute ago still fires
 * against a tree the user never agreed to destroy.
 *
 * Returns null when nothing is pending, which lets callers skip the digest
 * entirely for clean repositories.
 */
export async function computeChangeDigest(
  repoRoot: string,
  files: readonly ChangedFileForDigest[],
): Promise<string | null> {
  const pending = files
    .filter((file) => file.kind !== "ignored")
    .map((file) => file.path)
    .sort();

  if (pending.length === 0) {
    return null;
  }

  const hash = createHash("sha256");
  let budget = MAX_HASHED_BYTES;

  for (const relativePath of pending) {
    hash.update(relativePath);
    hash.update("\0");

    const absolutePath = path.join(repoRoot, relativePath);
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        hash.update("directory");
      } else if (stat.size <= budget) {
        budget -= stat.size;
        hash.update(await fs.readFile(absolutePath));
      } else {
        hash.update(`stat:${stat.size}:${stat.mtimeMs}`);
      }
    } catch {
      // Deleted, or unreadable. Both are states worth fingerprinting.
      hash.update("absent");
    }

    hash.update("\0");
  }

  return hash.digest("hex");
}
