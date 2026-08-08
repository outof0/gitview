import type { LogHandlerDeps } from "./logHelpers";
import { createLogHandlerApis } from "./logHelpers";
import { createLogQueryHandlers } from "./logQuery";
import { createLogSelectedChangesHandlers } from "./logSelectedChanges";
import { createLogCherryPickHandlers } from "./logCherryPick";
import { createLogRewriteHandlers } from "./logRewrite";

export type { LogHandlerDeps } from "./logHelpers";

export function createLogHandlers(deps: LogHandlerDeps) {
  const apis = createLogHandlerApis(deps);
  return {
    ...createLogQueryHandlers(apis),
    ...createLogSelectedChangesHandlers(apis),
    ...createLogCherryPickHandlers(apis),
    ...createLogRewriteHandlers(apis),
  };
}
