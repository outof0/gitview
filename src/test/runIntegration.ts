import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";
import { prepareSilentVsCodeApp } from "./helpers/silentVsCodeApp";
import { resolveDownloadedVsCodeExecutable } from "./helpers/vscodeExecutable";

// Entry point invoked by `pnpm test:int`. Downloads (on first run) and launches
// a real VS Code instance with this extension loaded, opening the
// test-conflict-repo as the workspace, then runs the mocha suite inside it.
async function main(): Promise<void> {
  // Repo root: out/test/runIntegration.js -> ../../.. = project root
  const extensionDevelopmentPath = path.resolve(__dirname, "../../");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  const testWorkspace = path.resolve(
    extensionDevelopmentPath,
    "test-conflict-repo",
  );

  // Isolated user-data so we never touch the developer's real VS Code profile.
  // Silent by default (LSUIElement agent + off-screen); set HEADED=1 to show UI.
  const silent = !process.env.HEADED;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nd-int-"));
  const userDir = path.join(userDataDir, "User");
  fs.mkdirSync(userDir, { recursive: true });
  fs.writeFileSync(
    path.join(userDir, "settings.json"),
    JSON.stringify(
      {
        "workbench.chat.enabled": false,
        "window.restoreWindows": "none",
        "window.openWithoutArgumentsInNewWindow": "on",
        "git.enabled": true,
      },
      null,
      2,
    ),
  );

  try {
    const vscodeExecutablePath = await resolveDownloadedVsCodeExecutable(
      await downloadAndUnzipVSCode({ extensionDevelopmentPath }),
    );
    if (silent) {
      await prepareSilentVsCodeApp(vscodeExecutablePath);
    }

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        // Keep vscode.git enabled — Explorer Git submenu delegates to it.
        "--disable-gpu",
        "--disable-updates",
        "--disable-workspace-trust",
        "--skip-welcome",
        "--skip-release-notes",
        `--user-data-dir=${userDataDir}`,
        ...(silent
          ? ["--window-position=-20000,-20000", "--window-size=800,600"]
          : []),
      ],
    });
  } catch (err) {
    console.error("Failed to run integration tests:", err);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

void main();
