export const E2E_PROTOCOL_VERSION = 1;
export const E2E_REPO_ID = "e2e-repo";

export function v1Response<TType extends string, TPayload>(
  requestId: string,
  type: TType,
  payload: TPayload,
) {
  return {
    protocolVersion: E2E_PROTOCOL_VERSION,
    requestId,
    type,
    ok: true as const,
    payload,
  };
}

export function v1Event<TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
) {
  return {
    protocolVersion: E2E_PROTOCOL_VERSION,
    type,
    payload,
  };
}