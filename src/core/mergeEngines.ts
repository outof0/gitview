import { buildChangeBlocksFromMarkers } from "./markersEngine";
import { buildChangeBlocks } from "./threeWay";
import type { ChangeBlock } from "./types";
import type { MergeEngine } from "../types/settings";

/** The stage contents an engine may look at; each uses a different subset. */
export type MergeEngineInput = {
  base: string | null;
  ours: string | null;
  theirs: string | null;
  worktree: string;
};

export type MergeEngineImpl = (input: MergeEngineInput) => ChangeBlock[];

/**
 * Keyed by the setting union, so adding an engine to `MergeEngine` (and to the
 * `gitView.mergeEngine` enum in package.json) fails to compile until an
 * implementation lands here — a new engine cannot be selectable but unwired.
 */
export const MERGE_ENGINES: Record<MergeEngine, MergeEngineImpl> = {
  threeWay: ({ base, ours, theirs }) =>
    buildChangeBlocks(base ?? "", ours ?? "", theirs ?? ""),
  markers: ({ worktree }) => buildChangeBlocksFromMarkers(worktree),
};

export const DEFAULT_MERGE_ENGINE: MergeEngine = "threeWay";
