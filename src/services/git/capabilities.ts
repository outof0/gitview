import type { GitExecFn } from "./types";

export type GitCapabilities = {
  versionText: string;
  supportsSwitch: boolean;
  supportsRestore: boolean;
  supportsWorktree: boolean;
  supportsPathspecFromFile: boolean;
  supportsPorcelainV1Z: boolean;
  supportsMergeBaseForkPoint: boolean;
  supportsCommitGpgSign: boolean;
};

type GitVersion = readonly [major: number, minor: number, patch: number];

function parseGitVersion(versionText: string): GitVersion {
  const match = versionText.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return [0, 0, 0];
  }
  // `!`: all three groups are mandatory, and `Number(undefined)` would be `NaN`,
  // which silently reports every capability as unsupported instead of failing.
  return [Number(match[1]!), Number(match[2]!), Number(match[3]!)];
}

function versionAtLeast(version: GitVersion, major: number, minor = 0): boolean {
  if (version[0] > major) {
    return true;
  }
  if (version[0] < major) {
    return false;
  }
  return version[1] >= minor;
}

export function deriveCapabilities(versionText: string): GitCapabilities {
  const version = parseGitVersion(versionText);
  return {
    versionText,
    supportsSwitch: versionAtLeast(version, 2, 23),
    supportsRestore: versionAtLeast(version, 2, 23),
    supportsWorktree: versionAtLeast(version, 2, 5),
    supportsPathspecFromFile: versionAtLeast(version, 2, 25),
    supportsPorcelainV1Z: versionAtLeast(version, 2, 11),
    supportsMergeBaseForkPoint: versionAtLeast(version, 2, 18),
    supportsCommitGpgSign: versionAtLeast(version, 1, 7),
  };
}

export function createCapabilitiesApi(execGit: GitExecFn) {
  const capabilityCache = new Map<string, GitCapabilities>();

  async function detectCapabilities(
    repoRoot: string,
    gitExecutable = "git",
  ): Promise<GitCapabilities> {
    const cacheKey = `${gitExecutable}::${repoRoot}`;
    const cached = capabilityCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { stdout } = await execGit(repoRoot, ["--version"]);
      const caps = deriveCapabilities(stdout.trim());
      capabilityCache.set(cacheKey, caps);
      return caps;
    } catch {
      const fallback = deriveCapabilities("git version 0.0.0");
      capabilityCache.set(cacheKey, fallback);
      return fallback;
    }
  }

  function clearCapabilityCache(): void {
    capabilityCache.clear();
  }

  return { detectCapabilities, clearCapabilityCache, deriveCapabilities };
}
