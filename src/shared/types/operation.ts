/** Canonical Git operation state — shared between host and webview protocol. */

export type OperationState =
  | { type: "none" }
  | { type: "merge"; canContinue: boolean; canAbort: boolean }
  | { type: "rebase"; canContinue: boolean; canSkip: boolean; canAbort: boolean }
  | {
      type: "cherry_pick";
      canContinue: boolean;
      canSkip: boolean;
      canAbort: boolean;
    }
  | { type: "revert"; canContinue: boolean; canSkip: boolean; canAbort: boolean }
  | { type: "bisect"; canAbort: boolean };

export const NO_OPERATION: OperationState = { type: "none" };

export function operationCanContinue(operation: OperationState): boolean {
  switch (operation.type) {
    case "merge":
    case "rebase":
    case "cherry_pick":
    case "revert":
      return operation.canContinue;
    default:
      return false;
  }
}

export function operationCanSkip(operation: OperationState): boolean {
  switch (operation.type) {
    case "rebase":
    case "cherry_pick":
    case "revert":
      return operation.canSkip;
    default:
      return false;
  }
}