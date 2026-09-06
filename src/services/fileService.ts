import * as fs from "fs/promises";
import { randomUUID } from "node:crypto";
import * as path from "node:path";
import { detectEol, hasFinalNewline } from "../core/lines";

export type FileServiceDeps = {
  readFileImpl?: (absolutePath: string) => Promise<Buffer>;
  writeFileImpl?: (absolutePath: string, data: Buffer) => Promise<void>;
};

export type FileReadResult = {
  content: string;
  eol: "lf" | "crlf";
  hasFinalNewline: boolean;
  encoding: "utf8";
};

export type FileWriteOptions = {
  eol: "lf" | "crlf";
  hasFinalNewline: boolean;
};

export interface FileService {
  readFile(absolutePath: string): Promise<FileReadResult>;
  writeFile(
    absolutePath: string,
    content: string,
    opts: FileWriteOptions,
  ): Promise<void>;
}

export function createFileService(deps?: FileServiceDeps): FileService {
  const readFileImpl = deps?.readFileImpl ?? ((p: string) => fs.readFile(p));
  const writeFileImpl =
    deps?.writeFileImpl ?? ((p: string, data: Buffer) => fs.writeFile(p, data));

  async function readFile(absolutePath: string) {
    const buffer = await readFileImpl(absolutePath);
    const content = buffer.toString("utf8");
    const eol = detectEol(content);
    const finalNl = hasFinalNewline(content);
    return {
      content,
      eol,
      hasFinalNewline: finalNl,
      encoding: "utf8" as const,
    };
  }

  async function writeFile(
    absolutePath: string,
    content: string,
    opts: FileWriteOptions,
  ): Promise<void> {
    await writeFileImpl(absolutePath, encodeFileContent(content, opts));
  }

  return { readFile, writeFile };
}

export function encodeFileContent(
  content: string,
  opts: FileWriteOptions,
): Buffer {
  let output = content;
  // Ensure consistent EOL
  const eolStr = opts.eol === "crlf" ? "\r\n" : "\n";
  if (opts.eol === "crlf") {
    output = output.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  } else {
    output = output.replace(/\r\n/g, "\n");
  }
  // Ensure final newline
  if (opts.hasFinalNewline && !output.endsWith(eolStr)) {
    output += eolStr;
  } else if (!opts.hasFinalNewline && output.endsWith(eolStr)) {
    output = output.slice(0, -eolStr.length);
  }

  return Buffer.from(output, "utf8");
}

/**
 * Write bytes without ever opening the destination for writing.
 *
 * `writeFile(destination)` follows a final-component symlink, so a path that
 * was validated and then swapped for a link redirects the write outside the
 * repository. A uniquely-named temporary file plus `rename` operates on
 * directory entries instead: replacing a hostile symlink rather than
 * following it.
 *
 * The parent directory is validated by identity, not just by path: its
 * realpath must stay contained AND its stat identity (ino/dev) must be
 * unchanged across the mutation. A parent swapped for a symlink (or replaced
 * outright) between the check and the syscalls is therefore detected after
 * the fact; the escaped file is then removed from its resolved location and
 * a compound error is thrown, so a lost race can never leave content
 * persistently outside the repository. Callers must still validate the
 * relative path with `resolveRepoRelativeRealPath()` first.
 */
export type AtomicWriteHooks = {
  /** Test-only hook run between the parent check and the temp-file write. */
  afterParentCheck?: () => Promise<void> | void;
  /** Test-only hook run after the temp-file write, before the rename. */
  beforeRename?: (tmpPath: string) => Promise<void> | void;
  /**
   * Test-only hook in the exact window between the final parent check and
   * the unlink of a quarantined entry.
   */
  beforeUnlink?: (quarantinePath: string) => Promise<void> | void;
  /**
   * Test-only hook in the exact window between the pre-rename parent check
   * and the quarantine rename.
   */
  beforeQuarantineRename?: () => Promise<void> | void;
};

type ParentIdentity = { realParent: string; ino: number; dev: number };

async function parentIdentity(
  realRoot: string,
  parent: string,
): Promise<ParentIdentity> {
  const realParent = await fs.realpath(parent);
  if (
    realParent !== realRoot &&
    !realParent.startsWith(realRoot + path.sep)
  ) {
    throw new Error("Refusing to write outside the repository.");
  }
  const stat = await fs.stat(realParent);
  return { realParent, ino: stat.ino, dev: stat.dev };
}

async function assertSameParent(
  realRoot: string,
  parent: string,
  before: ParentIdentity,
): Promise<ParentIdentity> {
  const after = await parentIdentity(realRoot, parent);
  if (after.realParent !== before.realParent || after.ino !== before.ino || after.dev !== before.dev) {
    throw new Error(
      "The parent directory changed during the write. Refusing to leave content outside the repository.",
    );
  }
  return after;
}

async function isSameParent(
  realRoot: string,
  parent: string,
  before: ParentIdentity,
): Promise<boolean> {
  try {
    await assertSameParent(realRoot, parent, before);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replace a directory entry via a caller-staged temporary file.
 *
 * Security contract (portable Node.js offers no renameat/openat, so every
 * check-then-syscall pair below has a residual microsecond race; the design
 * makes each of those races fail closed):
 *
 * - The destination is never opened or followed: a hostile final-component
 *   symlink is replaced by rename, never traversed. This holds
 *   unconditionally.
 * - The staged entry must have no extra hard links when checked: a temp file
 *   pre-linked elsewhere (the setup for replacing a pre-existing outside
 *   victim) is refused before any rename runs.
 * - The parent is re-verified immediately before the rename; on mismatch the
 *   operation throws with nothing touched.
 * - After the rename, parent and file identity are re-verified. Cleanup
 *   removes only content proven to be ours (same dev/ino) with no extra
 *   links; anything else is left untouched and reported loudly.
 *
 * `stage` creates the new entry at the given unique temporary path (bytes,
 * a symlink, …) and may adjust it (e.g. `chmod`) before it is renamed over
 * the destination. Best-effort cleanup failures are surfaced in the error,
 * never swallowed.
 */
export async function replaceFileAtomically(
  repoRoot: string,
  absolutePath: string,
  stage: (tmpPath: string) => Promise<void>,
  hooks?: AtomicWriteHooks,
): Promise<void> {
  const normalizedRoot = path.resolve(repoRoot);
  const destination = path.resolve(absolutePath);
  const realRoot = await fs.realpath(normalizedRoot);
  const parent = path.dirname(destination);
  const fileName = path.basename(destination);

  const before = await parentIdentity(realRoot, parent);
  await hooks?.afterParentCheck?.();
  const tmpPath = path.join(parent, `.gitview-replace-${randomUUID()}.tmp`);
  try {
    await stage(tmpPath);
  } catch (error) {
    throw new Error(
      `Could not stage file content: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  // Identity of our staged entry, so the post-rename verification can tell
  // our file apart from anything planted at the destination. `lstat` never
  // follows the final component, which also covers staged symlinks.
  const staged = await fs.lstat(tmpPath);
  const removeStaged = async (): Promise<void> => {
    await fs.rm(tmpPath, { force: true });
  };
  try {
    await assertSameParent(realRoot, parent, before);
    await hooks?.beforeRename?.(tmpPath);
    // A staged entry with extra hard links means someone linked our temp
    // file elsewhere (e.g. into a directory a swapped parent would resolve
    // to). Renaming it could then replace a pre-existing outside victim,
    // and no post-check could restore that victim's bytes — so refuse
    // before renaming. Checked here (not at staging time) so even a link
    // planted in the final window is caught.
    const stagedNow = await fs.lstat(tmpPath).catch(() => null);
    if (!stagedNow) {
      throw new Error(
        "Could not stage file content: the staged entry disappeared before the rename.",
      );
    }
    if (stagedNow.nlink !== 1) {
      throw new Error(
        "Could not stage file content: the staged entry has unexpected hard links. Refusing to rename it.",
      );
    }
    await fs.rename(tmpPath, destination);
  } catch (error) {
    await removeStaged();
    throw new Error(
      `Could not write file content: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const sameParent = await isSameParent(realRoot, parent, before);
  const destStat = await fs.lstat(destination).catch(() => null);
  const sameFile =
    destStat !== null && destStat.ino === staged.ino && destStat.dev === staged.dev;
  if (sameParent && sameFile) {
    return;
  }
  // Cleanup removes only our own single-linked content. A destination with
  // extra links may share its inode with an entry we must not touch, so it
  // is reported and left alone instead of unlinked.
  if (sameFile && destStat.nlink === 1) {
    const escapedParent = await fs.realpath(parent).catch(() => null);
    if (escapedParent) {
      const escaped = path.join(escapedParent, fileName);
      const cleaned = await fs
        .rm(escaped, { force: true })
        .then(() => true)
        .catch(() => false);
      if (!cleaned) {
        throw new Error(
          "Could not verify file content: the parent directory changed during the write, " +
            `and the escaped copy at ${escaped} could not be removed. Delete it manually.`,
        );
      }
    }
  }
  throw new Error(
    "Could not verify file content: the parent directory or destination changed during the write.",
  );
}

export async function writeBufferAtomically(
  repoRoot: string,
  absolutePath: string,
  data: Buffer,
  hooks?: AtomicWriteHooks,
): Promise<void> {
  await replaceFileAtomically(
    repoRoot,
    absolutePath,
    async (tmpPath) => {
      await fs.writeFile(tmpPath, data, { flag: "wx" });
      // Preserve the destination's permission bits (notably the executable
      // bit): a temp file is born with the default mode, and renaming it
      // over the destination would otherwise silently downgrade 0755 to 0644.
      // Symlinks carry no meaningful mode — a link at the destination is
      // being replaced, not followed, so it keeps the default.
      const current = await fs.lstat(path.resolve(absolutePath)).catch(() => null);
      if (current && current.isFile() && !current.isSymbolicLink()) {
        const mode = current.mode & 0o777;
        if (mode !== 0) {
          await fs.chmod(tmpPath, mode);
        }
      }
    },
    hooks,
  );
}

/**
 * Remove a repository entry without ever letting a parent-directory swap
 * turn the deletion against an outside file.
 *
 * Node offers no `unlinkat`, so a bare `unlink(path)` always resolves the
 * parent at syscall time — after the last possible check. This instead moves
 * the victim to an unpredictable quarantine name inside the same parent
 * first and only unlinks that name after re-verifying both the parent
 * identity and the moved entry's identity. The parent is re-verified
 * immediately before the quarantine rename as well, so a swap there fails
 * closed with nothing touched; the entry is moved straight back and no
 * unlink is attempted. A swap around the final unlink redirects it onto a
 * name the attacker cannot predict (which fails with ENOENT instead of
 * deleting their chosen file). A removal that cannot be verified
 * is reported loudly, and the quarantined entry is moved back when the
 * parent is currently valid.
 *
 * `unlink` never follows a hostile final symlink — the link itself is moved
 * and removed — so tracked symlinks can be deleted through this path.
 */
export async function unlinkInsideRepo(
  repoRoot: string,
  absolutePath: string,
  hooks?: AtomicWriteHooks,
): Promise<void> {
  const normalizedRoot = path.resolve(repoRoot);
  const destination = path.resolve(absolutePath);
  const realRoot = await fs.realpath(normalizedRoot);
  const parent = path.dirname(destination);
  const fileName = path.basename(destination);

  const before = await parentIdentity(realRoot, parent);
  await hooks?.afterParentCheck?.();
  const victim = await fs.lstat(destination).catch(() => null);
  if (!victim) {
    throw new Error(`Cannot remove ${fileName}: path does not exist.`);
  }
  // Fail closed: without descriptor-relative renameat, the quarantine rename
  // below is the first mutating syscall and it resolves the parent by path.
  // Re-verify the parent immediately before it — on mismatch nothing has
  // been touched yet, so refusal is side-effect free.
  await assertSameParent(realRoot, parent, before);
  const quarantine = path.join(parent, `${fileName}.gitview-del-${randomUUID()}`);
  await hooks?.beforeQuarantineRename?.();
  try {
    await fs.rename(destination, quarantine);
  } catch (error) {
    throw new Error(
      `Could not stage removal of ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  // The rename above is the one step that can have run under a swapped
  // parent (check→rename window). Verify before anything destructive: on
  // mismatch move the entry straight back — through the same, possibly still
  // swapped, parent, which restores the exact pre-rename state — and refuse
  // to unlink. A post-mutation recheck could never undo an outside rename.
  if (!(await isSameParent(realRoot, parent, before))) {
    const restored = await fs
      .rename(quarantine, destination)
      .then(() => true)
      .catch(() => false);
    throw new Error(
      `The parent directory changed during the removal of ${fileName}. ` +
        (restored
          ? "The entry was moved back untouched."
          : "The entry could not be moved back; inspect the quarantine entry before retrying."),
    );
  }
  // Move the quarantined entry back without ever clobbering a foreign
  // entry: if the destination name is occupied by anything other than our
  // own moved entry, the quarantine is left in place and reported instead
  // of replacing it.
  const restoreQuarantine = async (): Promise<"restored" | "left"> => {
    const current = await fs.lstat(quarantine).catch(() => null);
    if (!current) {
      return "restored";
    }
    const occupant = await fs.lstat(destination).catch(() => null);
    if (
      occupant &&
      (occupant.ino !== current.ino || occupant.dev !== current.dev)
    ) {
      return "left";
    }
    try {
      await fs.rename(quarantine, destination);
      return "restored";
    } catch {
      return "left";
    }
  };
  try {
    await assertSameParent(realRoot, parent, before);
    const moved = await fs.lstat(quarantine).catch(() => null);
    if (!moved || moved.ino !== victim.ino || moved.dev !== victim.dev) {
      throw new Error(
        "The parent directory changed during the removal. Refusing to delete an unverified entry.",
      );
    }
    await hooks?.beforeUnlink?.(quarantine);
    await fs.unlink(quarantine);
    if (!(await isSameParent(realRoot, parent, before))) {
      throw new Error(
        "The parent directory changed during the removal; the entry cannot be verified as removed from the repository.",
      );
    }
  } catch (error) {
    const restored = await restoreQuarantine();
    throw new Error(
      `Could not remove ${fileName}: ${error instanceof Error ? error.message : String(error)}` +
        (restored === "restored"
          ? " The entry was restored to its original name."
          : " The entry was left under a temporary quarantine name instead of risking a foreign entry."),
    );
  }
}
