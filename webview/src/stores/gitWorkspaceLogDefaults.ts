import type { LogQueryFilters } from "@gitview/shared/types/log";

/** Filters for the unscoped repository log shown by the first Log tab. */
export function createRootLogFilters(): LogQueryFilters {
  return { range: "all", limit: 200 };
}
