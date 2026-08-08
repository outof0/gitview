import * as fs from "fs/promises";
import * as path from "path";

export async function resolveDownloadedVsCodeExecutable(
  executablePath: string,
  platform = process.platform,
): Promise<string> {
  if (platform !== "darwin" || path.basename(executablePath) !== "Electron") {
    return executablePath;
  }

  try {
    await fs.access(executablePath);
    return executablePath;
  } catch {
    const currentPath = path.join(path.dirname(executablePath), "Code");
    await fs.access(currentPath);
    return currentPath;
  }
}
