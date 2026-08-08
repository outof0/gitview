import type { WebviewRequest } from "./base";

export type ExtensionRequestType = `extension.${string}`;

export type ExtensionWebviewRequest<
  TType extends ExtensionRequestType = ExtensionRequestType,
  TPayload = unknown,
> = WebviewRequest<TType, TPayload>;

export function isExtensionRequestType(
  value: string,
): value is ExtensionRequestType {
  return /^extension\.[a-z][a-z0-9.-]*$/.test(value);
}

export function isExtensionWebviewRequest(
  request: { type: string },
): request is ExtensionWebviewRequest {
  return isExtensionRequestType(request.type);
}
