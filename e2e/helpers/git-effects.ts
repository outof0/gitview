import type { BlameLine, FileDiffView, GitCommitEntry } from "../../src/types/blame";

export type GitViewEffect =
  | {
      type: "history";
      path: string;
      isFolder: boolean;
      commits: GitCommitEntry[];
    }
  | {
      type: "diffPreview";
      relativePath: string;
      title: string;
      diff: FileDiffView;
    }
  | {
      type: "blame";
      relativePath: string;
      lines: BlameLine[];
    };

let lastEffect: GitViewEffect | null = null;

export function setGitEffect(effect: GitViewEffect): void {
  lastEffect = effect;
}

export function consumeGitEffect(): GitViewEffect | null {
  const effect = lastEffect;
  lastEffect = null;
  return effect;
}

export function peekGitEffect(): GitViewEffect | null {
  return lastEffect;
}

export function resetGitEffect(): void {
  lastEffect = null;
}