import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ShelfStorageCorruptionError,
  createShelfStorage,
} from "../shelfStorage";

describe("shelfStorage", () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) {
      await fs.rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  async function setup() {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-shelf-storage-"));
    const storageDir = path.join(root, "storage");
    return {
      storageDir,
      storage: createShelfStorage({ resolveStorageDir: async () => storageDir }),
    };
  }

  it("serializes concurrent additions without dropping records", async () => {
    const { storage } = await setup();
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        storage.add(root!, {
          id: `shelf-${index}`,
          repoId: "repo",
          name: `Shelf ${index}`,
          createdAt: index,
          paths: [`file-${index}.txt`],
          patch: `patch-${index}`,
        }),
      ),
    );
    await expect(storage.list(root!, "repo")).resolves.toHaveLength(10);
  });

  it("refuses to overwrite a corrupt index", async () => {
    const { storage, storageDir } = await setup();
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(path.join(storageDir, "index.json"), "{broken", "utf8");

    await expect(
      storage.add(root!, {
        id: "new",
        repoId: "repo",
        name: "New shelf",
        createdAt: 1,
        paths: ["file.txt"],
        patch: "patch",
      }),
    ).rejects.toBeInstanceOf(ShelfStorageCorruptionError);
    await expect(fs.readFile(path.join(storageDir, "index.json"), "utf8")).resolves.toBe(
      "{broken",
    );
  });
});
