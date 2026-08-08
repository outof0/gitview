import type { HostToWebview } from "./hostToWebview";
import type { WebviewToHost } from "./webviewToHost";

/**
 * Request type, request payload and response payload are declared in three
 * separate unions. This module binds them into one lookup so a caller can be
 * typed end to end, and proves at compile time that no request type is missing
 * its response.
 */

export type ProtocolRequestType = WebviewToHost["type"];

type SolicitedHostMessage = Extract<
  HostToWebview,
  { requestId: string; ok: true }
>;

/**
 * Response type names match their request except where the protocol shipped a
 * different past-tense name. Adding an entry here is the only supported way to
 * diverge — anything else fails the coverage proof below. The runtime constant
 * is the source so the transport's response check cannot disagree with the type.
 */
export const RESPONSE_TYPE_OVERRIDES = {
  "merge.save": "merge.saved",
  "merge.markResolved": "merge.resolved",
} as const;

type ResponseTypeOverrides = typeof RESPONSE_TYPE_OVERRIDES;

type ResponseTypeFor<K extends ProtocolRequestType> =
  K extends keyof ResponseTypeOverrides ? ResponseTypeOverrides[K] : K;

export function responseTypeFor(requestType: string): string {
  return (
    (RESPONSE_TYPE_OVERRIDES as Record<string, string>)[requestType] ??
    requestType
  );
}

export type ProtocolMap = {
  [K in ProtocolRequestType]: {
    payload: Extract<WebviewToHost, { type: K }>["payload"];
    responseType: ResponseTypeFor<K>;
    response: Extract<
      SolicitedHostMessage,
      { type: ResponseTypeFor<K> }
    >["payload"];
  };
};

export type ProtocolRequestPayload<K extends ProtocolRequestType> =
  ProtocolMap[K]["payload"];

export type ProtocolResponsePayload<K extends ProtocolRequestType> =
  ProtocolMap[K]["response"];

/**
 * `Extract` yields `never` for a request whose response was never declared, so
 * any such request type shows up here and breaks the build.
 */
type RequestTypesWithoutResponse = {
  [K in ProtocolRequestType]: [ProtocolMap[K]["response"]] extends [never]
    ? K
    : never;
}[ProtocolRequestType];

const _everyRequestHasAResponse: RequestTypesWithoutResponse extends never
  ? true
  : RequestTypesWithoutResponse = true;
void _everyRequestHasAResponse;
