/**
 * Which VS Code build an integration run targets.
 *
 * `downloadAndUnzipVSCode` defaults to `stable`, i.e. the newest editor. That
 * proves the extension works today and says nothing about the oldest editor
 * `engines.vscode` promises to support, so CI drives this from a matrix
 * (`VSCODE_VERSION`) instead of leaving the floor untested.
 */

/** `stable` and `insiders` are channel names, not version numbers. */
const CHANNELS = new Set(["stable", "insiders"]);

export function resolveVsCodeTargetVersion(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const requested = env.VSCODE_VERSION?.trim();
  if (!requested) {
    return "stable";
  }
  if (CHANNELS.has(requested)) {
    return requested;
  }
  if (!/^\d+\.\d+\.\d+$/.test(requested)) {
    throw new Error(
      `VSCODE_VERSION must be "stable", "insiders", or a full x.y.z version — got "${requested}"`,
    );
  }
  return requested;
}
