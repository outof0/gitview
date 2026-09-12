import { describe, expect, it, vi } from "vitest";
import { createRepositoryMutationSerializer } from "../../services/repositoryMutationSerializer";
import { createNativeGitMutationRunner } from "../nativeGitMutation";

describe("createNativeGitMutationRunner", () => {
  it("serializes native mutations under the repository id", async () => {
    const serializer = createRepositoryMutationSerializer();
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const events: string[] = [];
    const run = createNativeGitMutationRunner({
      repositoryMutationSerializer: serializer,
      syncOperationCoordinator: {
        hasActive: () => false,
      },
      stableRepoId: () => "repo-id",
    });

    const first = run("/repo", async () => {
      events.push("first:start");
      await firstBlocked;
      events.push("first:end");
    });
    const second = run("/repo", async () => {
      events.push("second");
    });

    await vi.waitFor(() => expect(events).toEqual(["first:start"]));
    expect(serializer.isBusy("repo-id")).toBe(true);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("rechecks active sync state when a queued mutation begins", async () => {
    const serializer = createRepositoryMutationSerializer();
    let active = false;
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const operation = vi.fn(async () => undefined);
    const run = createNativeGitMutationRunner({
      repositoryMutationSerializer: serializer,
      syncOperationCoordinator: {
        hasActive: () => active,
      },
      stableRepoId: () => "repo-id",
    });

    const first = serializer.run("repo-id", () => firstBlocked);
    const queued = run("/repo", operation);
    active = true;
    releaseFirst();

    await first;
    await expect(queued).rejects.toThrow(/synchronization operation is running/i);
    expect(operation).not.toHaveBeenCalled();
  });
});
