import { useGitViewStore } from "../../stores/gitViewStore";

function hasMixedLineEndings(...parts: Array<string | null | undefined>): boolean {
  let sawLf = false;
  let sawCrlf = false;
  for (const part of parts) {
    if (!part) {
      continue;
    }
    if (part.includes("\r\n")) {
      sawCrlf = true;
    }
    if (part.replace(/\r\n/g, "").includes("\n")) {
      sawLf = true;
    }
  }
  return sawLf && sawCrlf;
}

export function CrlfBanner() {
  const doc = useGitViewStore((s) => s.activeDocument);
  const warnOnCrlf = useGitViewStore((s) => s.warnOnCrlf);
  const dismissed = useGitViewStore((s) => s.crlfBannerDismissed);
  const dismissCrlfBanner = useGitViewStore((s) => s.dismissCrlfBanner);
  const normalizeDocumentEol = useGitViewStore((s) => s.normalizeDocumentEol);

  if (!doc || !warnOnCrlf || dismissed) {
    return null;
  }

  const isMixed = hasMixedLineEndings(
    doc.base,
    doc.ours,
    doc.theirs,
    doc.worktree,
    doc.result,
  );

  if (!isMixed) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 bg-[var(--vscode-editorWarning-background,rgba(224,175,83,0.1))] text-[var(--vscode-editorWarning-foreground,#e0ad53)] border-b border-[var(--vscode-editorWarning-border,var(--vscode-editorWarning-foreground,rgba(224,175,83,0.3)))] text-xs font-mono"
      data-testid="crlf-banner"
      role="alert"
      aria-live="polite"
    >
      <span>Line separators: LF and CRLF.</span>
      <div className="flex gap-2">
        <button
          type="button"
          className="underline hover:no-underline font-semibold"
          data-testid="crlf-fix"
          aria-label="Normalize line endings"
          onClick={() => normalizeDocumentEol()}
        >
          Fix
        </button>
        <button
          type="button"
          className="underline hover:no-underline font-semibold"
          data-testid="crlf-ignore"
          aria-label="Dismiss line ending warning"
          onClick={() => dismissCrlfBanner()}
        >
          Ignore
        </button>
      </div>
    </div>
  );
}