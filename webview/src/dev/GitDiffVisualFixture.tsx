import { useEffect } from "react";
import type { StandaloneDiffPreview } from "@gitview/shared/types/diff";
import { GitHistoryDiffViewer } from "../components/git/GitHistoryDiffViewer";
import { GitCompareToolbar } from "../components/git/GitCompareToolbar";
import { VISUAL_HISTORY_PATH } from "./historyBlameVisualFixtures";

/**
 * Seeded Diff Viewer for visual baselines / playground.
 * /?app=gitDiffVisual
 */
export function visualDiffPreview(): StandaloneDiffPreview {
  return {
    relativePath: VISUAL_HISTORY_PATH,
    title: `${VISUAL_HISTORY_PATH} (HEAD ↔ Working Tree)`,
    diff: {
      layout: "split",
      status: "M",
      left: {
        label: "HEAD",
        text: [
          'import React from "react";',
          "",
          "interface ButtonProps {",
          "  label: string;",
          "  onClick: () => void;",
          "}",
          "",
          "export const Button = ({ label, onClick }: ButtonProps) => {",
          "  return (",
          "    <button onClick={onClick}>",
          "      {label}",
          "    </button>",
          "  );",
          "};",
          "",
        ].join("\n"),
      },
      right: {
        label: "Working Tree",
        text: [
          'import React from "react";',
          "",
          "interface ButtonProps {",
          "  label: string;",
          "  onClick: () => void;",
          '  variant?: "primary" | "secondary";',
          "}",
          "",
          "export const Button = ({",
          "  label,",
          "  onClick,",
          '  variant = "primary",',
          "}: ButtonProps) => {",
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
        ].join("\n"),
      },
    },
  };
}

export function GitDiffVisualFixture() {
  const preview = visualDiffPreview();

  useEffect(() => {
    document.body.classList.add("vscode-dark");
  }, []);

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden bg-vscode-editor-bg text-vscode-editor-fg font-[family-name:var(--nx-font-ui)] vscode-dark"
      data-testid="git-diff-app"
      data-visual-fixture="gitDiff"
    >
      <GitCompareToolbar
        filePath={preview.relativePath}
        title={preview.title}
        leftLabel={preview.diff.left?.label}
        rightLabel={preview.diff.right?.label}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <GitHistoryDiffViewer
          diff={preview.diff}
          filePath={preview.relativePath}
          variant="standalone"
        />
      </div>
    </div>
  );
}
