import type { GitViewErrorCode } from "@gitview/shared/errors/codes";

/**
 * Host errors arrive as structured codes over the protocol. Reading the code is
 * the only reliable way to branch on a failure — error messages are prose and
 * may be reworded at any time.
 */
export function errorCodeOf(error: unknown): GitViewErrorCode | undefined {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === "string" ? (code as GitViewErrorCode) : undefined;
  }
  return undefined;
}

export function isErrorCode(error: unknown, code: GitViewErrorCode): boolean {
  return errorCodeOf(error) === code;
}
