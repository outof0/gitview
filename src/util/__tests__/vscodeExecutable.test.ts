import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveDownloadedVsCodeExecutable } from "../../test/helpers/vscodeExecutable";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((entry) =>
      fs.rm(entry, { recursive: true, force: true }),
    ),
  );
});

async function macExecutablePaths() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-vscode-path-"));
  temporaryPaths.push(root);
  const macOsDir = path.join(
    root,
    "Visual Studio Code.app",
    "Contents",
    "MacOS",
  );
  await fs.mkdir(macOsDir, { recursive: true });
  return {
    legacy: path.join(macOsDir, "Electron"),
    current: path.join(macOsDir, "Code"),
  };
}

describe("resolveDownloadedVsCodeExecutable", () => {
  it("uses the current macOS executable when the downloader returns the legacy path", async () => {
    const executable = await macExecutablePaths();
    await fs.writeFile(executable.current, "");

    await expect(
      resolveDownloadedVsCodeExecutable(executable.legacy, "darwin"),
    ).resolves.toBe(executable.current);
  });

  it("keeps an existing legacy macOS executable", async () => {
    const executable = await macExecutablePaths();
    await fs.writeFile(executable.legacy, "");

    await expect(
      resolveDownloadedVsCodeExecutable(executable.legacy, "darwin"),
    ).resolves.toBe(executable.legacy);
  });

  it("does not rewrite executable paths on other platforms", async () => {
    await expect(
      resolveDownloadedVsCodeExecutable("/opt/code", "linux"),
    ).resolves.toBe("/opt/code");
  });
});
