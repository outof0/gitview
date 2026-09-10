import type { GitChangedFile, GitCommitEntry } from "@gitview/types";

/** Deterministic sample data for History visual previews. */

export const VISUAL_HISTORY_PATH = "src/components/Button.tsx";
export const VISUAL_REPO_ID = "preview-repo";

const t0 = 1_704_067_200; // fixed epoch for stable screenshots

const baseSha = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const headSha = "f6e5d4c3b2a19a8b7c6d5e4f3a2b1c0d";
const rootSha = "0102030405060708090a0b0c0d0e0f1011";

function files(...entries: Array<[string, GitChangedFile["status"]]>): GitChangedFile[] {
  return entries.map(([path, status]) => ({ path, status }));
}

export function visualHistoryCommits(): GitCommitEntry[] {
  return [
    {
      sha: headSha,
      shortSha: headSha.slice(0, 7),
      author: "bob",
      authorEmail: "bob@example.com",
      authorTime: t0 + 86_400 * 3,
      subject: "feat: support button variants",
      parentShas: [baseSha],
      refs: ["HEAD", "master", "origin/master"],
      body: "Support primary/secondary variants on Button.",
      changedFiles: files(
        [VISUAL_HISTORY_PATH, "M"],
        ["src/components/Modal.tsx", "A"],
      ),
    },
    {
      sha: baseSha,
      shortSha: baseSha.slice(0, 7),
      author: "alice",
      authorEmail: "alice@example.com",
      authorTime: t0,
      subject: "feat: add Button component",
      parentShas: [rootSha],
      refs: ["feature"],
      changedFiles: files([VISUAL_HISTORY_PATH, "A"]),
    },
    {
      sha: rootSha,
      shortSha: rootSha.slice(0, 7),
      author: "alice",
      authorEmail: "alice@example.com",
      authorTime: t0 - 86_400 * 2,
      subject: "chore: initial project layout",
      parentShas: [],
      refs: [],
      changedFiles: files(["README.md", "A"], ["package.json", "A"]),
    },
  ];
}
