import type { ChangeList, StatusSnapshot } from "../shared/types/status";
import type { ChangelistStorage } from "../storage/changelistStorage";
import type { createStatusApi } from "./git/status";

type StatusResult = Awaited<
  ReturnType<ReturnType<typeof createStatusApi>["getStatus"]>
>;

function defaultChangelists(
  repoId: string,
  files: StatusSnapshot["files"],
): ChangeList[] {
  const now = Date.now();
  const trackedPaths = files
    .filter((f) => f.kind !== "ignored" && f.kind !== "unversioned")
    .map((f) => f.path);
  return [
    {
      id: `${repoId}:changes`,
      repoId,
      name: "Changes",
      active: true,
      filePaths: trackedPaths,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export async function buildRepoStatusSnapshot(
  statusApi: ReturnType<typeof createStatusApi>,
  repoRoot: string,
  repoId: string,
  opts?: {
    includeIgnored?: boolean;
    changelistStorage?: ChangelistStorage;
    mode?: StatusSnapshot["mode"];
    /** Reuse the status already collected while refreshing repository metadata. */
    status?: StatusResult;
  },
): Promise<StatusSnapshot> {
  const status =
    opts?.status ??
    (await statusApi.getStatus(repoRoot, repoId, {
      includeIgnored: opts?.includeIgnored,
    }));
  const visiblePaths = status.files
    .filter((f) => f.kind !== "ignored")
    .map((f) => f.path);

  const mode = opts?.mode ?? "staging";
  const changelists =
    mode === "changelist"
      ? opts?.changelistStorage
        ? await opts.changelistStorage.mergeWithStatus(repoId, visiblePaths)
        : defaultChangelists(repoId, status.files)
      : [];

  return {
    repoId,
    files: status.files,
    changelists,
    mode,
    showIgnored: Boolean(opts?.includeIgnored),
    showUnversioned: true,
    refreshedAt: Date.now(),
  };
}
