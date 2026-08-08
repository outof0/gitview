import type { BlameLineEntry } from "@gitview/shared/types/blame";
import type { GitChangedFile, GitCommitEntry } from "@gitview/types";

/** Deterministic sample data for History / Blame visual previews. */

export const VISUAL_HISTORY_PATH = "src/components/Button.tsx";
export const VISUAL_REPO_ID = "preview-repo";

const t0 = 1_704_067_200; // fixed epoch for stable screenshots

const baseSha = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const headSha = "f6e5d4c3b2a19a8b7c6d5e4f3a2b1c0d";
const rootSha = "0102030405060708090a0b0c0d0e0f1011";

export function visualBlameLines(): BlameLineEntry[] {
  const body = [
    'import React from "react";',
    "",
    "interface ButtonProps {",
    "  label: string;",
    "  onClick: () => void;",
    '  variant?: "primary" | "secondary";',
    "}",
    "",
    "export const Button: React.FC<ButtonProps> = ({",
    "  label,",
    "  onClick,",
    '  variant = "primary",',
    "}) => {",
    "  return (",
    "    <button",
    "      className={`btn btn-${variant}`}",
    "      onClick={onClick}",
    "    >",
    "      {label}",
    "    </button>",
    "  );",
    "};",
    "",
  ];
  return body.map((text, i) => {
    const early = i < 8;
    const sha = early ? baseSha : headSha;
    return {
      lineNumber: i + 1,
      sha,
      shortSha: sha.slice(0, 7),
      author: early ? "alice" : "bob",
      authorEmail: early ? "alice@example.com" : "bob@example.com",
      authorTime: early ? t0 : t0 + 86_400 * 3,
      summary: early ? "add Button component" : "support variants",
      text,
    };
  });
}

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

export const VISUAL_REVISION_TEXT = visualBlameLines()
  .map((l) => l.text ?? "")
  .join("\n");

/** Side-by-side sample for History Diff pane (full-width layout screenshots). */
export function visualSampleDiff(): import("@gitview/types").FileDiffView {
  return {
    layout: "split",
    status: "M",
    left: {
      label: "a1b2c3d",
      text: [
        'import React from "react";',
        "",
        "interface ButtonProps {",
        "  label: string;",
        "  onClick: () => void;",
        "}",
        "",
        "export const Button: React.FC<ButtonProps> = ({",
        "  label,",
        "  onClick,",
        "}) => {",
        "  return <button onClick={onClick}>{label}</button>;",
        "};",
        "",
      ].join("\n"),
    },
    right: {
      label: "f6e5d4c",
      text: VISUAL_REVISION_TEXT,
    },
  };
}
