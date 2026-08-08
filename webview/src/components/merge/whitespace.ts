import type { WhitespacePolicy } from "../../stores/gitViewStore";

/** Normalize a line for whitespace-aware diff comparison. */
export function normalizeLineForCompare(
  text: string,
  policy: WhitespacePolicy,
): string {
  switch (policy) {
    case "ignoreWhitespaces":
      return text.replace(/\s/g, "");
    case "trimWhitespaces":
      return text.trim();
    default:
      return text;
  }
}

export function linesEqualUnderPolicy(
  a: string,
  b: string,
  policy: WhitespacePolicy,
): boolean {
  return (
    normalizeLineForCompare(a, policy) === normalizeLineForCompare(b, policy)
  );
}