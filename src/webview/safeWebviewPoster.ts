import {
  errorLogFields,
  type Logger,
} from "../observability/logger";

export type WebviewMessageTarget = {
  postMessage(message: unknown): PromiseLike<boolean>;
};

export type SafeWebviewPoster<TMessage> = {
  postMessage(message: TMessage): void;
  dispose(): void;
};

/**
 * Owns asynchronous webview delivery for one view lifecycle. VS Code rejects
 * pending postMessage calls when a panel closes; expected disposal races are
 * suppressed while unexpected delivery failures remain observable.
 */
export function createSafeWebviewPoster<TMessage>(
  target: WebviewMessageTarget,
  logger: Logger,
  surface: string,
): SafeWebviewPoster<TMessage> {
  let disposed = false;

  const reportFailure = (error: unknown): void => {
    if (!disposed) {
      logger.warn("webview.post-message.failed", {
        surface,
        ...errorLogFields(error),
      });
    }
  };

  return {
    postMessage(message) {
      if (disposed) {
        return;
      }
      try {
        void Promise.resolve(target.postMessage(message)).catch(reportFailure);
      } catch (error) {
        reportFailure(error);
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
