import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { mapPool } from "../../util/mapPool";

/**
 * Cap on how much file content is hashed in full. Past this budget we fall back
 * to size + mtime, which is weaker but still changes whenever the content does —
 * the property the confirmation fingerprint actually needs.
 */
const MAX_HASHED_BYTES = 8 * 1024 * 1024;
const MAX_CONCURRENT_DIGEST_IO = 16;

type DigestFile =
  | { state: "absent" }
  | { state: "directory" }
  | { state: "file"; absolutePath: string; size: number; mtimeMs: number };

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
  const filesToDigest = await mapPool(
    pending,
    MAX_CONCURRENT_DIGEST_IO,
    async (relativePath): Promise<DigestFile> => {
      const absolutePath = path.join(repoRoot, relativePath);
      try {
        const stat = await fs.stat(absolutePath);
        return stat.isDirectory()
          ? { state: "directory" }
          : {
              state: "file",
              absolutePath,
              size: stat.size,
              mtimeMs: stat.mtimeMs,
            };
      } catch {
        return { state: "absent" };
      }
    },
  );
  const contentReads = filesToDigest.map((file) => {
    if (file.state !== "file" || file.size > budget) {
      return false;
    }
    budget -= file.size;
    return true;
  });
  const contents = await mapPool(
    filesToDigest,
    MAX_CONCURRENT_DIGEST_IO,
    async (file, index): Promise<Buffer | null> => {
      if (file.state !== "file" || !contentReads[index]) {
        return null;
      }
      try {
        return await fs.readFile(file.absolutePath);
      } catch {
        return null;
      }
    },
  );

  for (const [index, relativePath] of pending.entries()) {
    hash.update(relativePath);
    hash.update("\0");
    const file = filesToDigest[index]!;
    if (file.state === "directory") {
      hash.update("directory");
    } else if (file.state === "absent" || (contentReads[index] && !contents[index])) {
      hash.update("absent");
    } else if (contentReads[index]) {
      hash.update(contents[index]!);
    } else {
      hash.update(`stat:${file.size}:${file.mtimeMs}`);
    }
    hash.update("\0");
  }

  return hash.digest("hex");
}
