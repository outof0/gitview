export type RepositoryHeadState =
  | { kind: "unborn"; branch: string }
  | { kind: "attached"; branch: string; sha: string }
  | { kind: "detached"; sha: string };

export type RepositoryRemoteState =
  | { kind: "none" }
  | { kind: "available"; remotes: string[]; upstream: string | null };

export type RepositoryShellState =
  | { kind: "no_repository" }
  | {
      kind: "repository";
      repoId: string;
      head: RepositoryHeadState;
      remote: RepositoryRemoteState;
      trusted: boolean;
      protectedBranch: boolean;
    };

type RepositoryHeadInput = {
  currentBranch: string | null;
  headSha: string | null;
  isDetached: boolean;
};

type RepositoryShellInput = RepositoryHeadInput & {
  id: string;
  upstream: string | null;
  headState?: RepositoryHeadState;
  remoteState?: RepositoryRemoteState;
  trusted: boolean;
  protectedBranch: boolean;
};

export function deriveRepositoryHeadState(
  repository: RepositoryHeadInput,
): RepositoryHeadState | null {
  if (repository.isDetached && repository.headSha) {
    return { kind: "detached", sha: repository.headSha };
  }
  if (repository.currentBranch && repository.headSha) {
    return {
      kind: "attached",
      branch: repository.currentBranch,
      sha: repository.headSha,
    };
  }
  if (repository.currentBranch && !repository.headSha) {
    return { kind: "unborn", branch: repository.currentBranch };
  }
  return null;
}

export function deriveRepositoryShellState(
  repositories: RepositoryShellInput[],
  activeRepoId: string | null,
): RepositoryShellState {
  const repository =
    repositories.find((candidate) => candidate.id === activeRepoId) ??
    repositories[0] ??
    null;
  if (!repository) {
    return { kind: "no_repository" };
  }

  const head =
    repository.headState ?? deriveRepositoryHeadState(repository);
  if (!head) {
    return { kind: "no_repository" };
  }

  const remote: RepositoryRemoteState =
    repository.remoteState ??
    (repository.upstream
      ? { kind: "available", remotes: [], upstream: repository.upstream }
      : { kind: "none" });

  return {
    kind: "repository",
    repoId: repository.id,
    head,
    remote,
    trusted: repository.trusted,
    protectedBranch: repository.protectedBranch,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRepository(value: unknown): value is RepositoryShellInput {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.rootPath === "string" &&
    (typeof value.currentBranch === "string" || value.currentBranch === null) &&
    (typeof value.headSha === "string" || value.headSha === null) &&
    typeof value.isDetached === "boolean" &&
    typeof value.trusted === "boolean" &&
    typeof value.protectedBranch === "boolean"
  );
}

export function isRepositorySnapshotPayload(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.repositories)) {
    return false;
  }
  if (
    value.activeRepoId !== null &&
    typeof value.activeRepoId !== "string"
  ) {
    return false;
  }
  if (typeof value.multiRootDiverged !== "boolean") {
    return false;
  }
  if (!value.repositories.every(isRepository)) {
    return false;
  }
  return (
    value.activeRepoId === null ||
    value.repositories.some((repository) => repository.id === value.activeRepoId)
  );
}
