/** Returns an error message when the value is not a usable Git branch name. */
export function validateBranchName(value: string): string | undefined {
  const branch = value.trim();
  if (!branch) {
    return "Enter a branch name.";
  }
  if (
    branch === "HEAD" ||
    branch.startsWith("-") ||
    branch.startsWith("/") ||
    branch.endsWith("/") ||
    branch.endsWith(".") ||
    branch.includes("..") ||
    branch.includes("@{") ||
    /[\s~^:?*[\]\\]/.test(branch)
  ) {
    return "Enter a valid Git branch name.";
  }
  return undefined;
}
