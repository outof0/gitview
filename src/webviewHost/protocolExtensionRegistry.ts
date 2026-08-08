import type { GitViewStructuredError } from "../shared/errors/codes";
import type { Logger } from "../observability/logger";
import { NOOP_LOGGER, errorLogFields } from "../observability/logger";
import {
  createHostError,
  createHostResponse,
  isExtensionRequestType,
  type ExtensionRequestType,
  type ExtensionWebviewRequest,
  type HostToWebview,
  type ProtocolPayloadValidator,
  type WebviewRequest,
} from "../shared/protocol";

export type ProtocolExtensionContext = {
  trusted: boolean;
  workspaceFolders: ReadonlyArray<{ uriPath: string; name: string }>;
};

export interface ProtocolExtensionHandler<
  TType extends ExtensionRequestType = ExtensionRequestType,
  TPayload = unknown,
  TResponse = unknown,
> {
  readonly type: TType;
  validate(payload: unknown): boolean;
  handle(
    request: WebviewRequest<TType, TPayload>,
    context: ProtocolExtensionContext,
  ): TResponse | Promise<TResponse>;
}

export interface ProtocolExtensionRegistry {
  register<TType extends ExtensionRequestType, TPayload, TResponse>(
    handler: ProtocolExtensionHandler<TType, TPayload, TResponse>,
  ): { dispose(): void };
  getPayloadValidators(): ReadonlyMap<string, ProtocolPayloadValidator>;
  dispatch(
    request: ExtensionWebviewRequest,
    context: ProtocolExtensionContext,
    postMessage: (message: HostToWebview) => void,
  ): Promise<boolean>;
}

const INERT_DISPOSABLE = { dispose() {} };

export function createProtocolExtensionRegistry(
  deps: { logger?: Logger } = {},
): ProtocolExtensionRegistry {
  const handlers = new Map<string, ProtocolExtensionHandler>();
  const logger = deps.logger ?? NOOP_LOGGER;

  function register<TType extends ExtensionRequestType, TPayload, TResponse>(
    handler: ProtocolExtensionHandler<TType, TPayload, TResponse>,
  ): { dispose(): void } {
    if (!isExtensionRequestType(handler.type)) {
      throw new Error(
        `Invalid extension request type: ${handler.type}. Types must use extension.<id>.`,
      );
    }
    // Losing a race with another extension must not fail the loser's activate().
    if (handlers.has(handler.type)) {
      logger.warn("protocol.extension.duplicate", { requestType: handler.type });
      return INERT_DISPOSABLE;
    }
    const stored = handler as ProtocolExtensionHandler;
    handlers.set(handler.type, stored);
    let disposed = false;
    return {
      dispose() {
        if (!disposed && handlers.get(handler.type) === stored) {
          handlers.delete(handler.type);
        }
        disposed = true;
      },
    };
  }

  function getPayloadValidators(): ReadonlyMap<
    string,
    ProtocolPayloadValidator
  > {
    // Bound so a method-style validate keeps its receiver, and guarded so a
    // throwing third-party validator reads as "invalid payload".
    return new Map(
      [...handlers].map(([type, handler]) => [
        type,
        (payload: unknown) => {
          try {
            return handler.validate(payload) === true;
          } catch (err) {
            logger.error("protocol.extension.validateFailed", {
              requestType: type,
              ...errorLogFields(err),
            });
            return false;
          }
        },
      ]),
    );
  }

  async function dispatch(
    request: ExtensionWebviewRequest,
    context: ProtocolExtensionContext,
    postMessage: (message: HostToWebview) => void,
  ): Promise<boolean> {
    const handler = handlers.get(request.type);
    if (!handler) {
      return false;
    }
    const payload = await handler.handle(request, context);
    // HostToWebview is intentionally closed for core exhaustiveness. This is
    // the single adapter where a validated extension response crosses it.
    postMessage(
      createHostResponse(
        request.requestId,
        request.type,
        payload,
      ) as unknown as HostToWebview,
    );
    return true;
  }

  return { register, getPayloadValidators, dispatch };
}

export function postProtocolExtensionError(
  requestId: string,
  error: GitViewStructuredError,
  postMessage: (message: HostToWebview) => void,
): void {
  postMessage(createHostError(requestId, error));
}
