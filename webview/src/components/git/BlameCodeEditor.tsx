import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type * as Monaco from "monaco-editor/editor";
import type { BlameLineEntry } from "@gitview/shared/types/blame";
import { groupBlameBlocks } from "@gitview/shared/lib/groupBlameBlocks";
import { useBlameGutterWidth } from "./useBlameGutterWidth";
import { BlameCommitHoverCard } from "./BlameCommitHoverCard";
import {
  blameBlockBackground,
  formatBlameAnnotationDate,
  isCurrentRevisionLine,
} from "../../lib/blameFormat";
import { mapBlameAnchors } from "../../lib/mapBlameAnchors";
import { applyGitViewMonacoTheme } from "../../lib/monacoTheme";
import { cn } from "../../lib/cn";
import { useTheme } from "../../hooks/useTheme";
import { loadMonaco } from "../merge/monacoSetup";
import { detectLanguage } from "../merge/syntax";

const SHOW_DELAY_MS = 220;
const HIDE_DELAY_MS = 120;
const LINE_HEIGHT = 20;

export type BlameSaveState = "clean" | "dirty" | "saving" | "saved" | "error";

function clampPopup(rect: DOMRect): { left: number; top: number } {
  const cardWidth = 320;
  const cardHeight = 150;
  const margin = 8;
  let left = rect.right + 6;
  let top = rect.top;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left + cardWidth > vw - margin) {
    left = Math.max(margin, rect.left - cardWidth - 6);
  }
  if (top + cardHeight > vh - margin) {
    top = Math.max(margin, vh - cardHeight - margin);
  }
  return { left, top };
}

type BlameCodeEditorProps = {
  lines: BlameLineEntry[];
  filePath: string;
  headSha?: string | null;
  selectedSha: string | null;
  /** 1-based line to reveal (cursor when Annotate was opened). */
  focusLine?: number;
  onOpenCommit?: (sha: string) => void;
  /** Persist file content (Cmd/Ctrl+S or Save button). */
  onSaveContent?: (content: string) => void | Promise<void>;
  /** Fired when dirty/save state changes — drives title bar + host tab title. */
  onSaveStateChange?: (state: BlameSaveState) => void;
};

type GutterRow = {
  lineNumber: number;
  source: BlameLineEntry | null;
  annotated: boolean;
  /** Only set on the first row of a same-commit run; counts the whole run. */
  blockLines?: number;
};

/**
 * Build gutter rows by content-stable anchoring (not line-number index).
 * Inserted / edited lines stay blank; unchanged lines keep their commit
 * even when shifted by inserts above them.
 */
function buildGutterRows(
  modelLines: string[],
  original: BlameLineEntry[],
): GutterRow[] {
  const mapped = mapBlameAnchors(original, modelLines);
  const rows: GutterRow[] = modelLines.map((_text, i) => {
    const source = mapped[i] ?? null;
    return {
      lineNumber: i + 1,
      source,
      annotated: source != null,
    };
  });

  let anchor: GutterRow | null = null;
  let run = 0;
  for (const row of rows) {
    if (anchor && row.source && row.source.sha === anchor.source?.sha) {
      run += 1;
      continue;
    }
    if (anchor) {
      anchor.blockLines = run;
    }
    anchor = row.source ? row : null;
    run = anchor ? 1 : 0;
  }
  if (anchor) {
    anchor.blockLines = run;
  }

  return rows;
}

/**
 * Annotate editor: Monaco (edit + syntax) + synced blame gutter.
 * Dirty / inserted lines leave the commit column blank.
 */
export function BlameCodeEditor({
  lines,
  filePath,
  headSha,
  selectedSha,
  focusLine,
  onOpenCommit,
  onSaveContent,
  onSaveStateChange,
}: BlameCodeEditorProps) {
  const theme = useTheme();
  const language = detectLanguage(filePath);
  const { gutterWidth, startGutterDrag } = useBlameGutterWidth();

  const originalRef = useRef(lines);
  originalRef.current = lines;

  const initialValue = useMemo(
    () => lines.map((l) => l.text ?? "").join("\n"),
    // Only seed from host when blame snapshot identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines.map((l) => `${l.lineNumber}:${l.sha}:${l.text ?? ""}`).join("\n")],
  );

  /** Last successfully saved content — dirty when model differs. */
  const savedBaselineRef = useRef(initialValue);
  const [saveState, setSaveState] = useState<BlameSaveState>("clean");
  const saveStateRef = useRef<BlameSaveState>("clean");

  const [gutterRows, setGutterRows] = useState<GutterRow[]>(() =>
    buildGutterRows(
      lines.map((l) => l.text ?? ""),
      lines,
    ),
  );
  const [monacoReady, setMonacoReady] = useState(false);
  const [card, setCard] = useState<{
    line: BlameLineEntry;
    left: number;
    top: number;
  } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const monacoHostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const monacoApiRef = useRef<typeof Monaco | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const syncingScroll = useRef(false);
  const onSaveContentRef = useRef(onSaveContent);
  onSaveContentRef.current = onSaveContent;
  const onSaveStateChangeRef = useRef(onSaveStateChange);
  onSaveStateChangeRef.current = onSaveStateChange;

  const clearHoverTimers = () => {
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  useEffect(() => () => clearHoverTimers(), []);

  const updateSaveState = useCallback((next: BlameSaveState) => {
    if (saveStateRef.current === next) {
      return;
    }
    saveStateRef.current = next;
    setSaveState(next);
    onSaveStateChangeRef.current?.(next);
  }, []);

  const recomputeDirty = useCallback(() => {
    const model = modelRef.current;
    if (!model) {
      return;
    }
    const dirty = model.getValue() !== savedBaselineRef.current;
    if (dirty) {
      updateSaveState("dirty");
    } else if (
      saveStateRef.current === "dirty" ||
      saveStateRef.current === "error"
    ) {
      updateSaveState("clean");
    }
  }, [updateSaveState]);

  const performSave = useCallback(async () => {
    const model = modelRef.current;
    const save = onSaveContentRef.current;
    if (!model || !save) {
      return;
    }
    const content = model.getValue();
    if (content === savedBaselineRef.current) {
      updateSaveState("clean");
      return;
    }
    updateSaveState("saving");
    try {
      await save(content);
      savedBaselineRef.current = content;
      updateSaveState("saved");
      window.setTimeout(() => {
        if (saveStateRef.current === "saved") {
          updateSaveState("clean");
        }
      }, 1600);
    } catch {
      updateSaveState("error");
    }
  }, [updateSaveState]);

  // Reset baseline when host reloads blame snapshot
  useEffect(() => {
    savedBaselineRef.current = initialValue;
    updateSaveState("clean");
  }, [initialValue, updateSaveState]);

  const refreshGutterFromModel = useCallback(() => {
    const model = modelRef.current;
    if (!model) {
      return;
    }
    const texts: string[] = [];
    const count = model.getLineCount();
    for (let i = 1; i <= count; i += 1) {
      texts.push(model.getLineContent(i));
    }
    setGutterRows(buildGutterRows(texts, originalRef.current));
  }, []);

  // Create / dispose Monaco once
  useEffect(() => {
    let disposed = false;
    let changeDisposable: Monaco.IDisposable | null = null;
    let scrollDisposable: Monaco.IDisposable | null = null;
    let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
    let model: Monaco.editor.ITextModel | null = null;

    void loadMonaco()
      .then((monaco) => {
        if (disposed || !monacoHostRef.current) {
          return;
        }
        monacoApiRef.current = monaco;
        const monacoTheme = applyGitViewMonacoTheme(monaco, theme);

        const uri = monaco.Uri.parse(
          `inmemory://gitview-blame/${encodeURIComponent(filePath)}`,
        );
        const existing = monaco.editor.getModel(uri);
        if (existing) {
          existing.dispose();
        }
        model = monaco.editor.createModel(initialValue, language, uri);
        modelRef.current = model;
        savedBaselineRef.current = initialValue;

        editor = monaco.editor.create(monacoHostRef.current, {
          model,
          theme: monacoTheme,
          readOnly: false,
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 8,
          // No per-line wash — only explicit change decorations may paint fills.
          renderLineHighlight: "none",
          renderLineHighlightOnlyWhenFocus: false,
          scrollBeyondLastLine: false,
          wordWrap: "off",
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          automaticLayout: true,
          fontSize: 12.5,
          lineHeight: LINE_HEIGHT,
          fontFamily:
            "var(--vscode-editor-font-family, ui-monospace, 'Cascadia Code', Consolas, monospace)",
          contextmenu: true,
          links: true,
          occurrencesHighlight: "off",
          selectionHighlight: true,
          renderWhitespace: "selection",
          guides: { indentation: false, bracketPairs: false },
          padding: { top: 0, bottom: 0 },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            useShadows: false,
          },
        });
        editorRef.current = editor;
        setMonacoReady(true);
        refreshGutterFromModel();
        updateSaveState("clean");

        // Cmd/Ctrl+S — explicit save (like a normal VS Code editor tab)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          void performSave();
        });

        changeDisposable = model.onDidChangeContent((e) => {
          if (e.isFlush) {
            return;
          }
          refreshGutterFromModel();
          recomputeDirty();
        });

        scrollDisposable = editor.onDidScrollChange((e) => {
          if (syncingScroll.current || !e.scrollTopChanged) {
            return;
          }
          const gutter = gutterRef.current;
          if (gutter) {
            syncingScroll.current = true;
            gutter.scrollTop = e.scrollTop;
            requestAnimationFrame(() => {
              syncingScroll.current = false;
            });
          }
        });
      })
      .catch(() => {
        // Editor stays in its not-ready state; the surrounding panel shows the
        // blame gutter regardless.
      });

    return () => {
      disposed = true;
      changeDisposable?.dispose();
      scrollDisposable?.dispose();
      editor?.dispose();
      model?.dispose();
      editorRef.current = null;
      modelRef.current = null;
      setMonacoReady(false);
    };
    // Recreate when file path changes (new annotate target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // Push host snapshot into model when blame data reloads for same file
  useEffect(() => {
    const model = modelRef.current;
    if (!model || model.getValue() === initialValue) {
      return;
    }
    // Only reset when host sent a fresh snapshot (e.g. re-annotate)
    model.setValue(initialValue);
    savedBaselineRef.current = initialValue;
    refreshGutterFromModel();
    updateSaveState("clean");
  }, [initialValue, refreshGutterFromModel, updateSaveState]);

  // Global Cmd/Ctrl+S when focus is outside Monaco (e.g. on gutter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        void performSave();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [performSave]);

  // Restore the user's place in the file (cursor line when Annotate opened).
  const focusAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!monacoReady || !focusLine || focusLine < 1) {
      return;
    }
    const editor = editorRef.current;
    const model = modelRef.current;
    if (!editor || !model || model.getLineCount() < 1) {
      return;
    }
    // Re-apply when content identity or focus target changes (not on every keystroke).
    const key = `${filePath}:${focusLine}:${initialValue.length}`;
    if (focusAppliedRef.current === key) {
      return;
    }
    const line = Math.min(focusLine, model.getLineCount());
    // Wait a frame so layout/split has size (otherwise reveal is a no-op).
    const t = window.requestAnimationFrame(() => {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
      // Sync annotate gutter scroll with Monaco
      const gutter = gutterRef.current;
      if (gutter) {
        gutter.scrollTop = editor.getScrollTop();
      }
      focusAppliedRef.current = key;
    });
    return () => window.cancelAnimationFrame(t);
  }, [monacoReady, focusLine, filePath, initialValue]);

  useEffect(() => {
    const monaco = monacoApiRef.current;
    if (monaco) {
      applyGitViewMonacoTheme(monaco, theme);
    }
    const editor = editorRef.current;
    if (editor) {
      const model = editor.getModel();
      if (model && model.getLanguageId() !== language) {
        monaco?.editor.setModelLanguage(model, language);
      }
    }
  }, [theme, language]);

  const handleGutterScroll = () => {
    if (syncingScroll.current) {
      return;
    }
    const gutter = gutterRef.current;
    const editor = editorRef.current;
    if (!gutter || !editor) {
      return;
    }
    syncingScroll.current = true;
    editor.setScrollTop(gutter.scrollTop);
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  };

  const handleAnnotEnter = (line: BlameLineEntry, rect: DOMRect) => {
    clearHoverTimers();
    showTimer.current = window.setTimeout(() => {
      const { left, top } = clampPopup(rect);
      setCard({ line, left, top });
    }, SHOW_DELAY_MS);
  };

  const handleAnnotLeave = () => {
    clearHoverTimers();
    hideTimer.current = window.setTimeout(() => setCard(null), HIDE_DELAY_MS);
  };

  const handleCardEnter = () => clearHoverTimers();
  const handleCardLeave = () => {
    clearHoverTimers();
    hideTimer.current = window.setTimeout(() => setCard(null), HIDE_DELAY_MS);
  };

  const handleOpenFromCard = (sha: string) => {
    clearHoverTimers();
    setCard(null);
    onOpenCommit?.(sha);
  };

  const bgBySha = useMemo(() => {
    const map = new Map<string, string>();
    const annotated = gutterRows
      .filter((r) => r.annotated && r.source)
      .map((r) => r.source!);
    for (const block of groupBlameBlocks(annotated)) {
      if (!map.has(block.sha)) {
        map.set(block.sha, blameBlockBackground(block.sha));
      }
    }
    return map;
  }, [gutterRows]);

  const gridStyle = {
    "--nx-annotate-gutter-width": `${gutterWidth}px`,
  } as CSSProperties;

  return (
    <div
      ref={hostRef}
      className="nx-editor nx-blame-editor flex-1 min-h-0 relative h-full min-h-full flex flex-col bg-vscode-editor-bg font-editor text-[12.5px] leading-5 overflow-hidden"
      style={gridStyle}
      data-testid="blame-editor"
      data-language={language}
      data-monaco={monacoReady ? "ready" : "loading"}
      data-save-state={saveState}
    >
      {/* Hidden save hook for title bar button */}
      <button
        type="button"
        className="absolute w-px h-px p-0 m-[-1px] overflow-hidden border-0"
        style={{ clip: "rect(0,0,0,0)" }}
        data-testid="blame-save-trigger"
        tabIndex={-1}
        onClick={() => void performSave()}
        aria-hidden
      />
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* Blame gutter — scrolls with Monaco */}
        <div
          ref={gutterRef}
          className="nx-blame-gutter shrink-0 overflow-y-auto overflow-x-hidden border-r border-vscode-panel-border bg-[var(--vscode-editorGutter-background,var(--vscode-editor-background,#1e1e1e))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ width: `${gutterWidth}px` }}
          onScroll={handleGutterScroll}
          data-testid="blame-annotate-gutter"
        >
          {gutterRows.map((row) => {
            const source = row.source;
            const annotated = row.annotated && source != null;
            const accent = source
              ? (bgBySha.get(source.sha) ?? "transparent")
              : "transparent";
            const isCurrent = source
              ? isCurrentRevisionLine(source.sha, headSha)
              : false;
            const selected = Boolean(source && selectedSha === source.sha);
            const date = source
              ? formatBlameAnnotationDate(source.authorTime)
              : "";
            const currentMarker = isCurrent ? " *" : "";

            return (
              <div
                key={row.lineNumber}
                className={cn(
                  "nx-blame-annotate-row flex items-stretch bg-transparent",
                  selected && "nx-blame-annotate-row--selected",
                )}
                style={{ height: LINE_HEIGHT }}
                data-testid={`blame-line-${row.lineNumber}`}
                data-annotated={annotated ? "true" : "false"}
                data-block-sha={source?.sha}
              >
                {annotated && source ? (
                  <button
                    type="button"
                    className={cn(
                      "nx-blame-annotate w-full min-w-0 py-0 pl-[10px] pr-2 flex items-center gap-2 overflow-hidden select-none",
                      "font-editor text-[11px] leading-5 text-left cursor-pointer border-0 border-l-[3px]",
                      "bg-transparent text-vscode-description",
                      isCurrent && "font-bold text-vscode-editor-fg",
                    )}
                    style={{ borderLeftColor: accent, height: LINE_HEIGHT }}
                    aria-label={[
                      source.author,
                      `${date} ${source.author}${currentMarker}`,
                      `${source.shortSha} — ${source.summary}`,
                    ].join(", ")}
                    data-testid={`blame-sha-${row.lineNumber}`}
                    data-block-lines={row.blockLines}
                    onMouseEnter={(e) => {
                      handleAnnotEnter(
                        source,
                        e.currentTarget.getBoundingClientRect(),
                      );
                    }}
                    onMouseLeave={handleAnnotLeave}
                    onClick={() => onOpenCommit?.(source.sha)}
                  >
                    <span className="shrink min-w-0 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {source.author}
                      {currentMarker}
                    </span>
                    <span className="shrink-0 whitespace-nowrap opacity-70">
                      {date}
                    </span>
                    <span
                      className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis opacity-80"
                      title={source.summary}
                    >
                      {source.summary}
                    </span>
                  </button>
                ) : (
                  <div
                    className="nx-blame-annotate nx-blame-annotate--empty w-full border-0 border-l-[3px] border-transparent"
                    style={{ height: LINE_HEIGHT }}
                    data-testid={`blame-sha-${row.lineNumber}`}
                    aria-label="Local change — not committed"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          className="shrink-0 w-1 z-[6] cursor-col-resize bg-transparent transition-colors hover:bg-ring active:bg-ring"
          onMouseDown={startGutterDrag}
          data-testid="blame-gutter-resizer"
        />

        {/* Monaco: real editor — edit + syntax highlight */}
        <div
          ref={monacoHostRef}
          className="flex-1 min-w-0 min-h-0 h-full"
          data-testid="blame-monaco"
          data-language={language}
        />
      </div>

      {card && (
        <BlameCommitHoverCard
          line={card.line}
          isCurrent={isCurrentRevisionLine(card.line.sha, headSha)}
          style={{ left: `${card.left}px`, top: `${card.top}px` }}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
          onOpenCommit={onOpenCommit ? handleOpenFromCard : undefined}
        />
      )}
    </div>
  );
}
