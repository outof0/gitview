import type { GitViewStructuredError } from "../errors/codes";

export const PROTOCOL_VERSION = 1 as const;

export type WebviewRequest<TType extends string, TPayload> = {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  type: TType;
  payload: TPayload;
};

export type HostResponse<TType extends string, TPayload> = {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  type: TType;
  ok: true;
  payload: TPayload;
};

export type HostErrorResponse = {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  type: "error";
  ok: false;
  error: GitViewStructuredError;
};

export type HostEvent<TType extends string, TPayload> = {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: TType;
  payload: TPayload;
};

export type CommitCreatePayload = {
  repoId: string;
  message: string;
  paths?: string[];
  amend?: boolean;
  signoff?: boolean;
  gpgSign?: boolean;
  author?: string;
  skipHooks?: boolean;
  runChecks?: boolean;
  skipChecks?: boolean;
  confirmedChecks?: boolean;
  pushAfter?: boolean;
};