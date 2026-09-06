import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { unlinkInsideRepo, writeBufferAtomically } from "../fileService";

describe("atomic repository writes under parent-directory swap", () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  async function makeRepo(): Promise<{ repoRoot: string; sub: string }> {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-atomic-"));
    roots.push(repoRoot);
    const sub = path.join(repoRoot, "sub");
    await fs.mkdir(sub, { recursive: true });
    return { repoRoot, sub };
  }

  async function makeOutside(): Promise<string> {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-outside-"));
    roots.push(outside);
    return outside;
  }

  async function swapDirForLink(dir: string, target: string): Promise<string> {
    const parked = `${dir}.parked`;
    await fs.rename(dir, parked);
    await fs.symlink(target, dir);
    return parked;
  }

  async function restoreLinkToDir(dir: string, parked: string): Promise<void> {
    await fs.rm(dir, { force: true });
    await fs.rename(parked, dir);
  }

  it("preserves the executable bit across atomic writes", async () => {
    const { repoRoot, sub } = await makeRepo();
    const dest = path.join(sub, "run.sh");
    await fs.writeFile(dest, "old\n");
    await fs.chmod(dest, 0o755);
    const { writeBufferAtomically } = await import("../fileService");
    await writeBufferAtomically(repoRoot, dest, Buffer.from("#!/bin/sh\n"));
    expect(await fs.readFile(dest, "utf8")).toBe("#!/bin/sh\n");
    expect((await fs.stat(dest)).mode & 0o777).toBe(0o755);
  });

  it("keeps the default mode for new files", async () => {
    const { repoRoot, sub } = await makeRepo();
    const dest = path.join(sub, "new.txt");
    const { writeBufferAtomically } = await import("../fileService");
    await writeBufferAtomically(repoRoot, dest, Buffer.from("hello\n"));
    expect((await fs.stat(dest)).mode & 0o777).toBe(0o644);
  });

  it("refuses the rename when the staged entry was hard-linked elsewhere", async () => {
    const { repoRoot, sub } = await makeRepo();
    const outside = await makeOutside();
    await fs.writeFile(path.join(outside, "victim.txt"), "victim\n");
    let parked: string | null = null;
    try {
      await expect(
        writeBufferAtomically(repoRoot, path.join(sub, "file.txt"), Buffer.from("evil\n"), {
          beforeRename: async (tmpPath) => {
            // The exact P0 setup: link the staged temp into the outside
            // directory, plant a victim at the destination name, then swap
            // the parent so the rename would replace that victim.
            await fs.link(tmpPath, path.join(outside, path.basename(tmpPath)));
            await fs.writeFile(path.join(outside, "file.txt"), "victim\n");
            parked = await swapDirForLink(sub, outside);
          },
        }),
      ).rejects.toThrow(/unexpected hard links/);
      // The victim was never replaced: refusal happened before any rename.
      expect(await fs.readFile(path.join(outside, "victim.txt"), "utf8")).toBe("victim\n");
      expect(await fs.readFile(path.join(outside, "file.txt"), "utf8")).toBe("victim\n");
    } finally {
      if (parked) {
        await restoreLinkToDir(sub, parked);
      }
    }
  });

  it("writes normally when the parent is untouched", async () => {
    const { repoRoot, sub } = await makeRepo();
    const dest = path.join(sub, "file.txt");
    await writeBufferAtomically(repoRoot, dest, Buffer.from("hello\n"));
    expect(await fs.readFile(dest, "utf8")).toBe("hello\n");
    await unlinkInsideRepo(repoRoot, dest);
    await expect(fs.access(dest)).rejects.toThrow();
  });

  it("refuses the write when the parent is swapped before staging", async () => {
    const { repoRoot, sub } = await makeRepo();
    const outside = await makeOutside();
    let parked: string | null = null;
    try {
      await expect(
        writeBufferAtomically(repoRoot, path.join(sub, "file.txt"), Buffer.from("evil\n"), {
          afterParentCheck: async () => {
            parked = await swapDirForLink(sub, outside);
          },
        }),
      ).rejects.toThrow(/outside the repository|changed during|write file content/i);
      // The staged temp file must not persist outside the repository.
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      if (parked) {
        await restoreLinkToDir(sub, parked);
      }
    }
  });

  it("refuses before renaming when the parent flaps around the rename", async () => {
    const { repoRoot, sub } = await makeRepo();
    const outside = await makeOutside();
    let parked: string | null = null;
    try {
      await expect(
        writeBufferAtomically(repoRoot, path.join(sub, "file.txt"), Buffer.from("evil\n"), {
          beforeRename: async (tmpPath) => {
            // Link the staged bytes outside, then swap the parent. The
            // hard-link check fires before any rename, so the write never
            // reaches the post-rename recovery path at all.
            await fs.link(tmpPath, path.join(outside, path.basename(tmpPath)));
            parked = await swapDirForLink(sub, outside);
          },
        }),
      ).rejects.toThrow(/unexpected hard links/);
      // The staged link the attacker planted is removed; nothing persists
      // outside and nothing landed inside the repository.
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      if (parked) {
        await restoreLinkToDir(sub, parked);
      }
    }
    await expect(fs.access(path.join(sub, "file.txt"))).rejects.toThrow();
  });

  it("does not delete a planted file that is not the staged content", async () => {
    const { repoRoot, sub } = await makeRepo();
    const outside = await makeOutside();
    await fs.writeFile(path.join(outside, "file.txt"), "planted\n");
    let parked: string | null = null;
    try {
      await expect(
        writeBufferAtomically(repoRoot, path.join(sub, "file.txt"), Buffer.from("evil\n"), {
          beforeRename: async () => {
            parked = await swapDirForLink(sub, outside);
          },
        }),
      ).rejects.toThrow();
      // The planted file is not ours: recovery must leave it alone.
      expect(await fs.readFile(path.join(outside, "file.txt"), "utf8")).toBe("planted\n");
    } finally {
      if (parked) {
        await restoreLinkToDir(sub, parked);
      }
    }
  });

  it("touches nothing outside when the parent is swapped before removal", async () => {
    const { repoRoot, sub } = await makeRepo();
    const outside = await makeOutside();
    await fs.writeFile(path.join(sub, "victim.txt"), "keep\n");
    await fs.writeFile(path.join(outside, "victim.txt"), "outside\n");
    let parked: string | null = null;
    try {
      await expect(
        unlinkInsideRepo(repoRoot, path.join(sub, "victim.txt"), {
          afterParentCheck: async () => {
            parked = await swapDirForLink(sub, outside);
          },
        }),
      ).rejects.toThrow(/outside the repository|parent directory changed/);
      // Fail-closed: the quarantine rename never ran, so the outside file
      // was not even renamed, let alone deleted.
      expect(await fs.readFile(path.join(outside, "victim.txt"), "utf8")).toBe("outside\n");
      expect(await fs.readdir(outside)).toEqual(["victim.txt"]);
    } finally {
      if (parked) {
        await restoreLinkToDir(sub, parked);
      }
    }
    expect(await fs.readFile(path.join(sub, "victim.txt"), "utf8")).toBe("keep\n");
  });

  it("moves the entry back when the swap wins the quarantine window", async () => {
    const { repoRoot, sub } = await makeRepo();
    const outside = await makeOutside();
    await fs.writeFile(path.join(sub, "victim.txt"), "keep\n");
    await fs.writeFile(path.join(outside, "victim.txt"), "outside\n");
    let parked: string | null = null;
    try {
      await expect(
        unlinkInsideRepo(repoRoot, path.join(sub, "victim.txt"), {
          beforeQuarantineRename: async () => {
            parked = await swapDirForLink(sub, outside);
          },
        }),
      ).rejects.toThrow(/moved back untouched/);
      // The outside entry was renamed aside and then moved straight back
      // through the same swapped parent: byte-identical restoration.
      expect(await fs.readFile(path.join(outside, "victim.txt"), "utf8")).toBe("outside\n");
      expect(await fs.readdir(outside)).toEqual(["victim.txt"]);
    } finally {
      if (parked) {
        await restoreLinkToDir(sub, parked);
      }
    }
    expect(await fs.readFile(path.join(sub, "victim.txt"), "utf8")).toBe("keep\n");
  });

  it("survives a parent swap in the exact unlink window", async () => {
    const { repoRoot, sub } = await makeRepo();
    const outside = await makeOutside();
    await fs.writeFile(path.join(sub, "victim.txt"), "keep\n");
    await fs.writeFile(path.join(outside, "victim.txt"), "outside\n");
    let parked: string | null = null;
    try {
      await expect(
        unlinkInsideRepo(repoRoot, path.join(sub, "victim.txt"), {
          beforeUnlink: async () => {
            // The victim already sits under an unpredictable quarantine name:
            // swapping the parent now redirects the unlink onto a name the
            // outside directory does not contain.
            parked = await swapDirForLink(sub, outside);
          },
        }),
      ).rejects.toThrow(/Could not remove/);
      // The outside file is untouched — the unlink hit ENOENT, not a victim.
      expect(await fs.readFile(path.join(outside, "victim.txt"), "utf8")).toBe("outside\n");
      expect(await fs.readdir(outside)).toEqual(["victim.txt"]);
    } finally {
      if (parked) {
        await restoreLinkToDir(sub, parked);
        // The entry could not be moved back while the parent was swapped, so
        // it waits under its quarantine name: move it back once the real
        // directory is in place. No bytes were lost.
        const names = await fs.readdir(sub);
        const quarantined = names.find((name) =>
          name.startsWith("victim.txt.gitview-del-"),
        );
        if (quarantined) {
          await fs.rename(
            path.join(sub, quarantined),
            path.join(sub, "victim.txt"),
          );
        }
      }
    }
    expect(await fs.readFile(path.join(sub, "victim.txt"), "utf8")).toBe("keep\n");
  });

  it("deletes a tracked final-component symlink without touching its target", async () => {
    const { repoRoot } = await makeRepo();
    const outside = await makeOutside();
    const outsideFile = path.join(outside, "secret.txt");
    await fs.writeFile(outsideFile, "original\n");
    const link = path.join(repoRoot, "link");
    await fs.symlink(outsideFile, link);
    // Unlinking removes the link itself and never follows it, so deleting a
    // tracked symlink is safe through this path.
    await unlinkInsideRepo(repoRoot, link);
    await expect(fs.lstat(link)).rejects.toThrow();
    expect(await fs.readFile(outsideFile, "utf8")).toBe("original\n");
  });
});
