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

export class ProtocolRequestTimeoutError extends Error {
  constructor(
    readonly requestType: ProtocolRequestType,
    readonly timeoutMs: number,
  ) {
    super(`Request "${requestType}" timed out after ${timeoutMs}ms`);
    this.name = "ProtocolRequestTimeoutError";
  }
}

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

/**
 * Snapshot/diff event keys each request type can emit, audited against the
 * host handlers. The client records the latest issued request per key so the
 * subscription can drop a late event from a superseded request instead of
 * letting it overwrite fresher data. A request type missing here degrades to
 * legacy behavior (its events always apply) — safe, but add it when its
 * handler gains an emission.
 */
const REQUEST_EVENT_KEYS: Record<string, string[]> = {
  "log.query": ["log.snapshot"],
  "diff.open": ["diff.result"],
  "branch.list": ["branch.snapshot"],
  "branch.compareCurrent": ["branch.compare.snapshot", "diff.result"],
  "branch.compareWorkingTree": ["branch.compare.snapshot", "diff.result"],
  "branch.compareFile": ["diff.result"],
  "branch.rename": ["branch.snapshot"],
  "branch.delete": ["branch.snapshot"],
  "branch.favorite": ["branch.snapshot"],
  "blame.query": ["blame.snapshot"],
  "stash.list": ["stash.snapshot"],
  "stash.push": ["stash.snapshot"],
  "stash.apply": ["stash.snapshot"],
  "stash.pop": ["stash.snapshot"],
  "stash.drop": ["stash.snapshot"],
  "stash.clear": ["stash.snapshot"],
  "stash.branch": ["stash.snapshot"],
  "shelf.list": ["shelf.snapshot"],
  "shelf.files": ["shelf.snapshot"],
  "shelf.hunk": ["shelf.snapshot"],
  "shelf.unshelve": ["shelf.snapshot"],
  "shelf.delete": ["shelf.snapshot"],
  "shelf.importPatch": ["shelf.snapshot"],
  "tag.list": ["tag.snapshot"],
  "tag.createAnnotated": ["tag.snapshot"],
  "tag.delete": ["tag.snapshot"],
  "worktree.list": ["worktree.snapshot"],
  "worktree.add": ["worktree.snapshot"],
  "worktree.remove": ["worktree.snapshot"],
  "review.list": ["review.snapshot"],
  "review.open": ["review.details"],
  "review.create": ["review.details"],
  "review.submit": ["review.details"],
  "review.merge": ["review.details"],
  "review.close": ["review.details"],
  "review.reopen": ["review.details"],
  "review.deleteSourceBranch": ["review.details"],
  "review.createLineComment": ["review.details"],
  "status.list": ["status.snapshot"],
  "repo.refresh": ["repo.snapshot", "status.snapshot"],
};

/**
 * Latest issued request per snapshot event key, shared across client
 * instances like the pending map (nested surfaces share correlation state).
 */
const latestEventRequest = new Map<string, string>();

function recordEventRequest(type: string, requestId: string): void {
  const keys = REQUEST_EVENT_KEYS[type];
  if (!keys) {
    return;
  }
  for (const key of keys) {
    latestEventRequest.set(key, requestId);
  }
}

/**
 * Whether a host event is still current for its key.
 *
 * Applies when the event carries no request id (spontaneous pushes from
 * refresh/watchers always apply), when nothing newer was issued, or when the
 * id matches the latest issued request. The latest marker survives failures
 * and timeouts on purpose: resurrecting an older in-flight event would
 * overwrite the newest error and display results for obsolete filters. A
 * retry records a newer id and reopens the key.
 */
function isCurrentEvent(
  eventType: string,
  requestId: string | undefined,
): boolean {
  if (typeof requestId !== "string" || requestId.length === 0) {
    return true;
  }
  const latest = latestEventRequest.get(eventType);
  if (latest === undefined) {
    return true;
  }
  return latest === requestId;
}

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

    // Responses carry an `ok` boolean; host events never do. The host posts
    // a snapshot/diff event *before* the response for the same requestId, so
    // matching a pending request by id alone would consume the event as the
    // response and reject with "unexpected response type" — which broke every
    // surface that lists branches. Only envelopes with `ok` settle promises;
    // everything else falls through to event dispatch below, and the later
    // response still settles the promise.
    if (
      msg.requestId &&
      sharedPending.has(msg.requestId) &&
      typeof msg.ok === "boolean"
    ) {
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
    recordEventRequest(type, requestId);
    return new Promise<ProtocolResponsePayload<K>>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (sharedPending.has(requestId)) {
          sharedPending.delete(requestId);
          // The tombstone stays: a late event from an older in-flight
          // request must not resurrect superseded data over the error the
          // loader reports for this failed attempt. The next attempt records
          // a newer id and reopens the key.
          reject(new ProtocolRequestTimeoutError(type, timeoutMs));
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

  return { handleHostMessage, request, isCurrentEvent };
}
