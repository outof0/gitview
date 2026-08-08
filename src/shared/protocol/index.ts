export {
  PROTOCOL_VERSION,
  type WebviewRequest,
  type HostResponse,
  type HostErrorResponse,
  type HostEvent,
  type CommitCreatePayload,
} from "./base";
export type { WebviewToHost } from "./webviewToHost";
export type { HostToWebview } from "./hostToWebview";
export {
  GIT_PANEL_DIALOGS,
  GIT_PANEL_POPUPS,
  GIT_PANEL_SURFACES,
  HOST_EVENT_TYPES,
  isGitPanelDialog,
  isGitPanelSurface,
  isHostEventType,
  type GitPanelDialog,
  type GitPanelPopup,
  type GitPanelSurface,
  type HostToWebviewEvent,
  type HostToWebviewEventType,
} from "./hostToWebview";
export {
  RESPONSE_TYPE_OVERRIDES,
  responseTypeFor,
  type ProtocolMap,
  type ProtocolRequestType,
  type ProtocolRequestPayload,
  type ProtocolResponsePayload,
} from "./protocolMap";
export {
  isExtensionRequestType,
  isExtensionWebviewRequest,
  type ExtensionRequestType,
  type ExtensionWebviewRequest,
} from "./extensions";

import type { GitViewStructuredError } from "../errors/codes";
import type { WebviewToHost } from "./webviewToHost";
import type { HostToWebview } from "./hostToWebview";
import type { ExtensionWebviewRequest } from "./extensions";
import {
  PROTOCOL_VERSION,
  type HostErrorResponse,
  type HostEvent,
  type HostResponse,
} from "./base";
import { parseWebviewRequestResult } from "./requestValidation";

export {
  WEBVIEW_REQUEST_TYPES,
  parseWebviewRequestResult,
  type WebviewRequestParseFailure,
  type WebviewRequestParseResult,
  type ProtocolPayloadValidator,
} from "./requestValidation";

export type ParsedWebviewRequest = WebviewToHost | ExtensionWebviewRequest;

export type AnyProtocolMessage = WebviewToHost | HostToWebview;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProtocolMessage(value: unknown): value is AnyProtocolMessage {
  if (!isRecord(value)) {
    return false;
  }
  if ("requestId" in value) {
    return parseWebviewRequestResult(value).ok;
  }
  return value.protocolVersion === PROTOCOL_VERSION && typeof value.type === "string";
}

export function parseWebviewRequest(
  value: unknown,
  extensionValidators?: ReadonlyMap<string, (payload: unknown) => boolean>,
): ParsedWebviewRequest | null {
  const result = parseWebviewRequestResult(value, extensionValidators);
  return result.ok ? result.request : null;
}

export function createHostResponse<TType extends string, TPayload>(
  requestId: string,
  type: TType,
  payload: TPayload,
): HostResponse<TType, TPayload> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    type,
    ok: true,
    payload,
  };
}

export function createHostError(
  requestId: string,
  error: GitViewStructuredError,
): HostErrorResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    type: "error",
    ok: false,
    error,
  };
}

export function createHostEvent<TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
): HostEvent<TType, TPayload> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type,
    payload,
  };
}
