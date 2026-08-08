import type { ExtensionRequestType } from "./shared/protocol";
import type {
  ReviewCreateOptions,
  ReviewLineCommentOptions,
  ReviewListResult,
  ReviewProvider,
  ReviewProviderRegistry,
} from "./services/review/providerRegistry";
import type { RefreshPayload } from "./services/watchers/refreshCoordinator";
import type {
  ProtocolExtensionContext,
  ProtocolExtensionHandler,
  ProtocolExtensionRegistry,
} from "./webviewHost/protocolExtensionRegistry";

export type Disposable = { dispose(): void };

/** Public extension API returned from `vscode.extensions.getExtension(...).activate()`. */
export interface GitViewExtensionApi {
  readonly apiVersion: 1;
  registerReviewProvider(provider: ReviewProvider): Disposable;
  registerProtocolExtension<
    TType extends ExtensionRequestType,
    TPayload,
    TResponse,
  >(
    handler: ProtocolExtensionHandler<TType, TPayload, TResponse>,
  ): Disposable;
  onDidRefresh(listener: (payload: RefreshPayload) => void): Disposable;
}

export type {
  ExtensionRequestType,
  WebviewRequest,
} from "./shared/protocol";
export type {
  Repository,
  RepositorySnapshot,
} from "./shared/types/repository";
export type {
  ReviewDetailsSnapshot,
  ReviewFilters,
  ReviewItem,
  ReviewProviderInfo,
} from "./shared/types/review";
export type {
  ReviewCreateOptions,
  ReviewLineCommentOptions,
  ReviewListResult,
  ReviewProvider,
  ReviewProviderRegistry,
  ProtocolExtensionContext,
  ProtocolExtensionHandler,
  ProtocolExtensionRegistry,
  RefreshPayload,
};
