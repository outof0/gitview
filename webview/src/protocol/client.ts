import { createProtocolClientAuxMethods } from "./clientAuxSlice";
import { createProtocolClientBranchMethods } from "./clientBranchSlice";
import { createProtocolClientTransport } from "./clientCore";
import { createProtocolClientLogMethods } from "./clientLogSlice";
import { createProtocolClientRepoMethods } from "./clientRepoSlice";
import { createProtocolClientReviewMethods } from "./clientReviewSlice";
import { createProtocolClientMergeMethods } from "./clientMergeSlice";

/** Every request method, derived from the slices rather than restated here. */
export type ProtocolClient = ReturnType<typeof createProtocolClient>;

export function createProtocolClient(postMessage: (msg: unknown) => void) {
  const { handleHostMessage, request } = createProtocolClientTransport(postMessage);

  return {
    handleHostMessage,
    ...createProtocolClientRepoMethods(request),
    ...createProtocolClientBranchMethods(request),
    ...createProtocolClientLogMethods(request),
    ...createProtocolClientAuxMethods(request),
    ...createProtocolClientReviewMethods(request),
    ...createProtocolClientMergeMethods(request),
  };
}