export function isSafeGitOperand(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("-") &&
    !value.includes("\0") &&
    !value.includes("\r") &&
    !value.includes("\n")
  );
}

export function assertSafeGitOperand(value: string, label: string): void {
  if (!isSafeGitOperand(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}
