import {
  PROTOCOL_VERSION,
  isHostEventType,
  responseTypeFor,
  type ProtocolRequestPayload,
  type ProtocolRequestType,
  type ProtocolResponsePayload,
} from "@gitview/shared/protocol";

const REQUEST_TIMEOUT_MS = 30_000;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  expectedType: string;
  timer: ReturnType<typeof setTimeout>;
};

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `wv-${requestCounter}`;
}

function settlePending(entry: PendingRequest): void {
  clearTimeout(entry.timer);
}

/**
 * Resolves with the response *payload*, not the envelope — callers previously
 * cast the envelope by hand, which is how a request could be paired with the
 * wrong response shape and still compile.
 */
export type ProtocolRequestFn = <K extends ProtocolRequestType>(
  type: K,
  payload: ProtocolRequestPayload<K>,
  timeoutMs?: number,
) => Promise<ProtocolResponsePayload<K>>;

/**
 * Shared across all `createProtocolClient` instances so nested surfaces (e.g.
 * GitHistoryApp + GitHistoryToolWindow) can resolve each other's requests.
 * Each client previously kept a private pending map, so host responses handled
 * only by the parent never settled child-issued queryLog / fileDiff requests.
 */
const sharedPending = new Map<string, PendingRequest>();

export function createProtocolClientTransport(postMessage: (msg: unknown) => void) {
  function handleHostMessage(raw: unknown): boolean {
    if (typeof raw !== "object" || raw === null) {
      return false;
    }
    const msg = raw as {
      protocolVersion?: number;
      requestId?: string;
      type?: string;
      ok?: boolean;
      error?: { message: string };
    };

    if (msg.protocolVersion !== PROTOCOL_VERSION) {
      // Dropping a reply we asked for would hang the caller until its timeout,
      // so surface the version mismatch instead of reporting a generic stall.
      if (msg.requestId && sharedPending.has(msg.requestId)) {
        const stale = sharedPending.get(msg.requestId)!;
        sharedPending.delete(msg.requestId);
        settlePending(stale);
        stale.reject(
          new Error(
            `Host replied with protocol version ${String(msg.protocolVersion)}, expected ${PROTOCOL_VERSION}. Reload the window after updating GitView.`,
          ),
        );
        return true;
      }
      return false;
    }

    if (msg.requestId && sharedPending.has(msg.requestId)) {
      const entry = sharedPending.get(msg.requestId)!;
      sharedPending.delete(msg.requestId);
      settlePending(entry);
      if (msg.ok === false) {
        const err = new Error(msg.error?.message ?? "Request failed") as Error & {
          details?: unknown;
          code?: string;
        };
        err.details = (msg.error as { details?: unknown } | undefined)?.details;
        err.code = (msg.error as { code?: string } | undefined)?.code;
        entry.reject(err);
      } else if (msg.type === entry.expectedType || msg.type === "error") {
        entry.resolve((msg as { payload?: unknown }).payload);
      } else {
        entry.reject(
          new Error(
            `Unexpected response type "${msg.type}" for "${entry.expectedType}"`,
          ),
        );
      }
      return true;
    }

    return typeof msg.type === "string" && isHostEventType(msg.type);
  }

  const request: ProtocolRequestFn = <K extends ProtocolRequestType>(
    type: K,
    payload: ProtocolRequestPayload<K>,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<ProtocolResponsePayload<K>> => {
    const requestId = nextRequestId();
    return new Promise<ProtocolResponsePayload<K>>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (sharedPending.has(requestId)) {
          sharedPending.delete(requestId);
          reject(new Error(`Request "${type}" timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      sharedPending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        expectedType: responseTypeFor(type),
        timer,
      });
      postMessage({
        protocolVersion: PROTOCOL_VERSION,
        requestId,
        type,
        payload,
      });
    });
  };

  return { handleHostMessage, request };
}
