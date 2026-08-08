export type ReviewFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export const REVIEW_FETCH_TIMEOUT_MS = 20_000;

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

export async function fetchWithTimeout(
  fetchFn: ReviewFetch,
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number = REVIEW_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(timeoutMs);
  return Promise.race([
    fetchFn(url, { ...init, signal }),
    rejectAfter(timeoutMs, `Request timed out after ${timeoutMs}ms`),
  ]);
}