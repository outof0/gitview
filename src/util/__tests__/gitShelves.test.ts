import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createShelfStorage } from "../../storage/shelfStorage";
import { createShelfApi } from "../../services/git/shelf";
import { createDefaultExecGit } from "../../services/git/exec";
import { shelveChanges, unshelveLatest } from "../gitShelves";
import * as crypto from "node:crypto";

const exec = promisify(execFile);

function repoIdFor(root: string): string {
  return crypto.createHash("sha256").update(root).digest("hex").slice(0, 16);
}

describe("gitShelves explorer helpers", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  async function initRepo(): Promise<string> {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-shelves-"));
    await exec("git", ["init", "-b", "master"], { cwd: tmp });
    await exec("git", ["config", "user.email", "t@t.com"], { cwd: tmp });
    await exec("git", ["config", "user.name", "t"], { cwd: tmp });
    await fs.writeFile(path.join(tmp, "file.txt"), "base\n");
    await exec("git", ["add", "file.txt"], { cwd: tmp });
    await exec("git", ["commit", "-m", "init"], { cwd: tmp });
    return tmp;
  }

  it("shelve + unshelve share storage with enablement listShelves", async () => {
    const root = await initRepo();
    await fs.writeFile(path.join(root, "file.txt"), "base\nedited\n");

    const shelved = await shelveChanges(root, "file.txt");
    expect(shelved).toBe(true);
    expect(await fs.readFile(path.join(root, "file.txt"), "utf8")).toBe(
      "base\n",
    );

    const storage = createShelfStorage();
    const api = createShelfApi(createDefaultExecGit(), storage);
    const listed = await api.listShelves(root, repoIdFor(root));
    expect(listed.length).toBe(1);
    expect(listed[0]?.paths).toContain("file.txt");

    const restored = await unshelveLatest(root);
    expect(restored).toBe(true);
    expect(await fs.readFile(path.join(root, "file.txt"), "utf8")).toBe(
      "base\nedited\n",
    );
    expect(await api.listShelves(root, repoIdFor(root))).toEqual([]);
  });
});
