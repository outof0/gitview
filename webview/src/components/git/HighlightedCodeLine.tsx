import { useEffect, useMemo, useState } from "react";
import { applyGitViewMonacoTheme } from "../../lib/monacoTheme";
import type { ThemeKind } from "../../hooks/useTheme";
import type * as Monaco from "monaco-editor/editor";
import { loadMonaco } from "../merge/monacoSetup";
import { detectLanguage, syntaxClass, tokenizeLine } from "../merge/syntax";

type HighlightedCodeLineProps = {
  text: string;
  /** Repo-relative path — drives syntax token classes and E2E language checks. */
  filePath?: string | null;
};

const monacoLineCache = new Map<string, string>();

function stripTrailingBreak(html: string): string {
  return html.replace(/<br\s*\/?>$/i, "");
}

/** Colorize may emit inline background styles — strip them; keep color only. */
function sanitizeColorizeHtml(html: string): string {
  return stripTrailingBreak(html)
    .replace(/background(?:-color)?\s*:\s*[^;"']+;?/gi, "")
    .replace(/\sstyle="\s*"/g, "")
    .replace(/\sstyle='\s*'/g, "");
}

function currentThemeKind(): ThemeKind {
  if (document.body.classList.contains("vscode-high-contrast-light")) {
    return "high-contrast-light";
  }
  if (document.body.classList.contains("vscode-high-contrast")) {
    return "high-contrast";
  }
  if (document.body.classList.contains("vscode-light")) {
    return "light";
  }
  return "dark";
}

function canUseMonacoColorizer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof CSS !== "undefined" &&
    typeof CSS.escape === "function"
  );
}

function fallbackTokens(text: string, language?: string) {
  return tokenizeLine(text, language).map((tok, i) => {
    const cls = syntaxClass(tok.type);
    return cls ? (
      <span key={i} className={cls}>
        {tok.value}
      </span>
    ) : (
      <span key={i}>{tok.value}</span>
    );
  });
}

/** Syntax-highlighted source line using Monaco tokenization, with regex fallback while Monaco loads. */
export function HighlightedCodeLine({
  text,
  filePath,
}: HighlightedCodeLineProps) {
  const theme = currentThemeKind();
  const language = filePath ? detectLanguage(filePath) : undefined;
  const languageId = language ?? "plaintext";
  const cacheKey = useMemo(
    () => `${theme}\u0000${languageId}\u0000${text}`,
    [theme, languageId, text],
  );
  const [monacoHtml, setMonacoHtml] = useState<string | null>(
    () => monacoLineCache.get(cacheKey) ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!canUseMonacoColorizer()) {
      setMonacoHtml(null);
      return () => {
        cancelled = true;
      };
    }
    const cached = monacoLineCache.get(cacheKey);
    if (cached !== undefined) {
      setMonacoHtml(cached);
      return () => {
        cancelled = true;
      };
    }
    setMonacoHtml(null);
    void loadMonaco().then(async (monaco: typeof Monaco) => {
        applyGitViewMonacoTheme(monaco, theme);
        const html = sanitizeColorizeHtml(
          await monaco.editor.colorize(text, languageId, { tabSize: 2 }),
        );
        monacoLineCache.set(cacheKey, html);
        if (!cancelled) {
          setMonacoHtml(html);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMonacoHtml(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, languageId, text, theme]);

  // Never paint a chip/box behind code — only token colors.
  const codeClass =
    "nx-code-line inline font-inherit whitespace-pre bg-transparent";

  if (text === "") {
    return (
      <code
        className={codeClass}
        data-testid="code-line"
        data-language={language}
      >
        {" "}
      </code>
    );
  }

  if (monacoHtml !== null) {
    return (
      <code
        className={codeClass}
        data-testid="code-line"
        data-language={language}
        dangerouslySetInnerHTML={{ __html: monacoHtml }}
      />
    );
  }

  return (
    <code
      className={codeClass}
      data-testid="code-line"
      data-language={language}
    >
      {fallbackTokens(text, language)}
    </code>
  );
}
