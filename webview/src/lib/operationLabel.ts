import type { OperationState } from "@gitview/shared/types/operation";

export function operationLabel(operation: OperationState): string | null {
  switch (operation.type) {
    case "none":
      return null;
    case "merge":
      return "Merge in progress";
    case "rebase":
      return "Rebase in progress";
    case "cherry_pick":
      return "Cherry-pick in progress";
    case "revert":
      return "Revert in progress";
    case "bisect":
      return "Bisect in progress";
  }
}