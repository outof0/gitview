import * as path from "path";
import { isValidRepoRelativePath } from "../services/blameRefs";

export type RepoPathError = {
  ok: false;
  code: "INVALID_PATH";
  message: string;
};

export type RepoPathSuccess = {
  ok: true;
  relativePath: string;
  absolutePath: string;
};

export type RepoPathResult = RepoPathSuccess | RepoPathError;

const INVALID_PATH_MESSAGE =
  "Path must be a non-empty relative path inside the repository.";

const defaultJoin = (root: string, rel: string): string => path.join(root, rel);

export function resolveRepoRelativePath(
  repoRoot: string,
  relativePath: string,
  joinPath: (root: string, rel: string) => string = defaultJoin,
): RepoPathResult {
  if (!isValidRepoRelativePath(relativePath)) {
    return {
      ok: false,
      code: "INVALID_PATH",
      message: INVALID_PATH_MESSAGE,
    };
  }

  const canonicalRelativePath = path.posix.normalize(
    relativePath.replace(/\\/g, "/"),
  );
  const absolutePath = path.resolve(
    joinPath(repoRoot, canonicalRelativePath),
  );
  const normalizedRoot = path.resolve(repoRoot);
  const rootWithSep =
    normalizedRoot.endsWith(path.sep) ?
      normalizedRoot
    : normalizedRoot + path.sep;

  if (
    absolutePath !== normalizedRoot &&
    !absolutePath.startsWith(rootWithSep)
  ) {
    return {
      ok: false,
      code: "INVALID_PATH",
      message: INVALID_PATH_MESSAGE,
    };
  }

  return {
    ok: true,
    relativePath: canonicalRelativePath,
    absolutePath,
  };
}
