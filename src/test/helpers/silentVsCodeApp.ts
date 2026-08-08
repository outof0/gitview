import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";

const exec = promisify(execFile);

/**
 * macOS: mark the *test* VS Code bundle as a background agent so it does not
 * appear in the Dock or steal focus when native e2e / integration tests launch.
 *
 * No-op when HEADED=1, non-darwin, or when the executable path is not inside
 * an .app bundle. Re-signs ad-hoc after Info.plist edits (required on modern macOS).
 *
 * This only touches the copy under `.vscode-test/` (or whatever path you pass),
 * never the user's real /Applications VS Code.
 */
export async function prepareSilentVsCodeApp(
  electronExecutablePath: string,
): Promise<void> {
  if (process.env.HEADED || process.platform !== "darwin") {
    return;
  }

  // Typical path: .../Visual Studio Code.app/Contents/MacOS/Electron
  const macOsDir = path.dirname(electronExecutablePath);
  const contentsDir = path.dirname(macOsDir);
  const appBundle = path.dirname(contentsDir);
  if (!appBundle.endsWith(".app")) {
    return;
  }

  const infoPlist = path.join(contentsDir, "Info.plist");
  try {
    await fs.access(infoPlist);
  } catch {
    return;
  }

  // Already prepared on a previous run — skip re-sign.
  try {
    const { stdout } = await exec("plutil", [
      "-extract",
      "LSUIElement",
      "raw",
      infoPlist,
    ]);
    if (String(stdout).trim() === "true" || String(stdout).trim() === "1") {
      return;
    }
  } catch {
    // key missing — continue
  }

  // LSUIElement = agent app: no Dock icon, does not activate like a normal GUI app.
  try {
    await exec("plutil", [
      "-replace",
      "LSUIElement",
      "-bool",
      "true",
      infoPlist,
    ]);
  } catch {
    await exec("plutil", [
      "-insert",
      "LSUIElement",
      "-bool",
      "true",
      infoPlist,
    ]);
  }

  // Info.plist change invalidates the signature; ad-hoc re-sign the test bundle only.
  await exec("codesign", [
    "--force",
    "--deep",
    "--sign",
    "-",
    appBundle,
  ]).catch(() => {
    // If codesign is unavailable, runtime hide still applies; launch may still work.
  });
}
