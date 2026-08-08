import {
  createError,
  isGitViewStructuredError,
  type GitViewStructuredError,
} from "../shared/errors/codes";
import {
  createHostError,
  isExtensionWebviewRequest,
  parseWebviewRequestResult,
} from "../shared/protocol";
import { createMessageRouterContext } from "./messageRouterContext";
import type { MessageRouterDeps } from "./messageRouterTypes";
import { resolveDispatcher } from "./messageRouterRoutes";
import { createProtocolExtensionRegistry } from "./protocolExtensionRegistry";
import { NOOP_LOGGER, errorLogFields } from "../observability/logger";
import { toUserFacingGitError } from "../util/safeLog";

export type { MessageRouterDeps } from "./messageRouterTypes";

export function createMessageRouter(deps: MessageRouterDeps) {
  const ctx = createMessageRouterContext(deps);
  const logger = deps.logger ?? NOOP_LOGGER;
  const protocolExtensions =
    deps.protocolExtensionRegistry ?? createProtocolExtensionRegistry({ logger });

  function toRouterError(error: unknown): GitViewStructuredError {
    if (isGitViewStructuredError(error)) {
      return {
        ...error,
        message: toUserFacingGitError(error.message),
      };
    }
    const nodeError = error as NodeJS.ErrnoException;
    const message = toUserFacingGitError(error);
    const executableMissing =
      nodeError?.code === "ENOENT" &&
      (/\bspawn\b/i.test(nodeError.message ?? "") ||
        /\bgit\b/i.test(nodeError.path ?? ""));
    return createError(
      executableMissing ? "GIT_EXECUTABLE_NOT_FOUND" : "GIT_COMMAND_FAILED",
      message || "The Git operation failed.",
    );
  }

  async function handleRawMessage(raw: unknown): Promise<void> {
    const startedAt = Date.now();
    // Extension payload validators are third-party code and run inside the
    // parser, so a throwing plugin must not escape as an unhandled rejection.
    let parsed: ReturnType<typeof parseWebviewRequestResult>;
    try {
      parsed = parseWebviewRequestResult(
        raw,
        protocolExtensions.getPayloadValidators(),
      );
    } catch (err) {
      const requestId =
        typeof (raw as { requestId?: unknown })?.requestId === "string"
          ? (raw as { requestId: string }).requestId
          : "unknown";
      logger.error("protocol.request.validatorFailed", {
        requestId,
        ...errorLogFields(err),
      });
      deps.postMessage(
        createHostError(
          requestId,
          createError("INVALID_REQUEST", "Protocol request validation failed."),
        ),
      );
      return;
    }
    if (!parsed.ok) {
      logger.warn("protocol.request.rejected", {
        requestId: parsed.requestId ?? "unknown",
        errorCode: parsed.code,
        durationMs: Date.now() - startedAt,
      });
      deps.postMessage(
        createHostError(
          parsed.requestId ?? "unknown",
          createError(parsed.code, parsed.message, { details: parsed.details }),
        ),
      );
      return;
    }
    const request = parsed.request;
    let outcome: "handled" | "not_implemented" | "failed" = "failed";
    logger.debug("protocol.request.started", {
      requestId: request.requestId,
      requestType: request.type,
    });

    try {
      if (isExtensionWebviewRequest(request)) {
        const handled = await protocolExtensions.dispatch(
          request,
          {
            trusted:
              ctx.deps.getTrusted?.() ?? ctx.deps.trusted ?? false,
            workspaceFolders: ctx.deps.workspaceFolders,
          },
          deps.postMessage,
        );
        if (handled) {
          outcome = "handled";
          return;
        }
      } else {
        const dispatch = resolveDispatcher(request.type);
        if (dispatch && (await dispatch(request, ctx))) {
          outcome = "handled";
          return;
        }
      }

      outcome = "not_implemented";
      logger.warn("protocol.request.unhandled", {
        requestId: request.requestId,
        requestType: request.type,
      });
      deps.postMessage(
        createHostError(
          request.requestId,
          createError("NOT_IMPLEMENTED", "Request type is not implemented yet."),
        ),
      );
    } catch (err) {
      const structuredError = toRouterError(err);
      logger.error("protocol.request.failed", {
        requestId: request.requestId,
        requestType: request.type,
        gitviewErrorCode: structuredError.code,
        ...errorLogFields(err),
      });
      deps.postMessage(
        createHostError(
          request.requestId,
          structuredError,
        ),
      );
    } finally {
      logger.debug("protocol.request.completed", {
        requestId: request.requestId,
        requestType: request.type,
        outcome,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  return { handleRawMessage };
}
