import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Run git without allowing a failed probe to throw away its diagnostics. */
export function git(args) {
  try {
    const stdout = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return {
      code: typeof err.status === "number" ? err.status : -1,
      stdout: "",
      stderr: `${err.stderr ?? ""}`.trim(),
    };
  }
}

function compareTagNames(left, right) {
  const leftParts = parseTagName(left);
  const rightParts = parseTagName(right);
  if (!leftParts || !rightParts) {
    return left.localeCompare(right, undefined, { numeric: true });
  }
  for (let index = 0; index < 3; index += 1) {
    if (leftParts.release[index] !== rightParts.release[index]) {
      return leftParts.release[index] - rightParts.release[index];
    }
  }
  if (!leftParts.prerelease && !rightParts.prerelease) {
    return 0;
  }
  if (!leftParts.prerelease) {
    return 1;
  }
  if (!rightParts.prerelease) {
    return -1;
  }
  return comparePrerelease(leftParts.prerelease, rightParts.prerelease);
}

function comparePrerelease(left, right) {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    if (leftPart === rightPart) {
      continue;
    }
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) {
      return leftNumber - rightNumber;
    }
    if (leftNumber !== null) {
      return -1;
    }
    if (rightNumber !== null) {
      return 1;
    }
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

export function parseTagName(name) {
  const match = name.match(
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:(?:0|[1-9]\d*)|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:(?:0|[1-9]\d*)|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );
  if (!match) {
    return null;
  }
  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? "",
  };
}

export function newestTag(tags) {
  return [...tags].sort((left, right) => compareTagNames(right.name, left.name))[0];
}

export function parseRemoteTags(stdout) {
  const tags = new Map();
  for (const line of stdout.split("\n")) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (!sha || !ref || !ref.startsWith("refs/tags/v")) {
      continue;
    }
    const peeled = ref.endsWith("^{}");
    const name = ref.slice("refs/tags/".length).replace(/\^\{\}$/, "");
    if (!parseTagName(name)) {
      continue;
    }
    const entry = tags.get(name) ?? { name, objectSha: "", commitSha: "" };
    if (peeled) {
      entry.commitSha = sha;
    } else {
      entry.objectSha = sha;
    }
    tags.set(name, entry);
  }
  return [...tags.values()].map((tag) => ({
    ...tag,
    commitSha: tag.commitSha || tag.objectSha,
  }));
}

function localTags() {
  const result = git(["tag", "--list", "v*"]);
  if (result.code !== 0) {
    throw new Error(`cannot list local v* tags: ${result.stderr || "git failed"}`);
  }
  return result.stdout
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => parseTagName(name) !== null)
    .map((name) => ({ name }));
}

/**
 * Resolve the latest published tag and prove the local checkout agrees with it.
 * A local-only tag is never allowed to define a release range.
 */
export function getPublishedReleaseLineage(
  remoteName = process.env.RELEASE_REMOTE || "origin",
) {
  const head = git(["rev-parse", "HEAD"]);
  if (head.code !== 0) {
    throw new Error(`cannot resolve HEAD: ${head.stderr || "git failed"}`);
  }

  const remote = git(["remote", "get-url", remoteName]);
  if (remote.code !== 0) {
    throw new Error(
      `cannot resolve release remote ${remoteName}: ${remote.stderr || "git failed"}`,
    );
  }

  const remoteTagsResult = git([
    "ls-remote",
    "--tags",
    remoteName,
    "refs/tags/v*",
  ]);
  if (remoteTagsResult.code !== 0) {
    throw new Error(
      `cannot read published tags from ${remoteName} (${remote.stdout}): ${
        remoteTagsResult.stderr || "git failed"
      }`,
    );
  }

  const publishedTags = parseRemoteTags(remoteTagsResult.stdout);
  const local = localTags();
  if (publishedTags.length === 0) {
    if (local.length > 0) {
      throw new Error(
        `remote ${remoteName} has no published v* tags, but local tags exist (${local
          .map((tag) => tag.name)
          .join(", ")}); local-only tags cannot define a changelog range`,
      );
    }
    return { headSha: head.stdout, remoteName, latest: null };
  }

  const latest = newestTag(publishedTags);
  const localLatest = newestTag(local);
  if (!localLatest) {
    throw new Error(
      `published tag ${latest.name} is missing locally; fetch tags from ${remoteName} before generating a changelog`,
    );
  }
  if (localLatest.name !== latest.name) {
    throw new Error(
      `latest published tag is ${latest.name}, but the latest local v* tag is ${localLatest.name}; fetch tags from ${remoteName} and do not use a local-only tag`,
    );
  }

  const localSha = git(["rev-list", "-n", "1", latest.name]);
  if (localSha.code !== 0) {
    throw new Error(
      `cannot resolve local tag ${latest.name}: ${localSha.stderr || "git failed"}`,
    );
  }
  if (localSha.stdout !== latest.commitSha) {
    throw new Error(
      `published tag ${latest.name} resolves to ${latest.commitSha.slice(
        0,
        7,
      )} on ${remoteName}, but the local tag resolves to ${localSha.stdout.slice(
        0,
        7,
      )}; fetch the published tag instead of moving it`,
    );
  }

  const object = git(["cat-file", "-e", `${latest.commitSha}^{commit}`]);
  if (object.code !== 0) {
    throw new Error(
      `published tag ${latest.name} is not available as a local commit; fetch tags from ${remoteName}`,
    );
  }

  const ancestry = git(["merge-base", "--is-ancestor", latest.commitSha, "HEAD"]);
  if (ancestry.code === 1) {
    throw new Error(
      `published tag ${latest.name} (${latest.commitSha.slice(
        0,
        7,
      )}) is not an ancestor of HEAD (${head.stdout.slice(
        0,
        7,
      )}); the histories diverged, so no release range can be described`,
    );
  }
  if (ancestry.code !== 0) {
    throw new Error(
      `git merge-base --is-ancestor ${latest.name} HEAD failed: ${
        ancestry.stderr || "git failed"
      }`,
    );
  }

  const described = git(["describe", "--tags", "--match", latest.name, "HEAD"]);
  if (described.code !== 0) {
    throw new Error(
      `local git cannot describe HEAD from published tag ${latest.name}: ${
        described.stderr || "no output"
      }`,
    );
  }

  return { headSha: head.stdout, remoteName, latest };
}
