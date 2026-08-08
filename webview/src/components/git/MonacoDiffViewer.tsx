// Monaco DiffEditor for Git Compare — syntax highlight + native scroll-sync,
// same quality as Annotate (full Monaco models, not per-line colorize).

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import type * as Monaco from "monaco-editor/editor";
import { useTheme } from "../../hooks/useTheme";
import { applyGitViewMonacoTheme } from "../../lib/monacoTheme";
import { detectLanguage } from "../merge/syntax";
import { getMonacoIfLoaded, loadMonaco } from "../merge/monacoSetup";
import { cn } from "../../lib/cn";

export type DiffEditorContextMenuEvent = {
  x: number;
  y: number;
  /** 1-based line under the cursor. */
  lineNumber: number;
  side: "left" | "right";
};

/** Viewer options the diff toolbar drives. */
export type DiffViewerOptions = {
  /** Side-by-side viewer when true, unified viewer when false. */
  sideBySide: boolean;
  /** Ignores leading/trailing whitespace changes. */
  trimWhitespace: boolean;
  collapseUnchanged: boolean;
  softWrap: boolean;
};

export const DEFAULT_DIFF_VIEWER_OPTIONS: DiffViewerOptions = {
  sideBySide: true,
  trimWhitespace: false,
  collapseUnchanged: false,
  softWrap: false,
};

export type MonacoDiffViewerHandle = {
  /** Jump to the next/previous difference (F7 / Shift+F7). */
  goToDiff: (target: "next" | "previous") => void;
};

export type MonacoDiffViewerProps = {
  leftText: string;
  rightText: string;
  leftLabel?: string;
  rightLabel?: string;
  /** Repo-relative path — drives language mode. */
  filePath?: string | null;
  /** Hide per-pane headers (toolbar already shows labels). */
  hideHeaders?: boolean;
  className?: string;
  readOnly?: boolean;
  /** When set, replaces Monaco's default context menu (e.g. Annotate). */
  onEditorContextMenu?: (event: DiffEditorContextMenuEvent) => void;
  options?: DiffViewerOptions;
  /** Number of difference blocks, recomputed whenever Monaco finishes a diff. */
  onDiffCountChange?: (count: number) => void;
  handleRef?: Ref<MonacoDiffViewerHandle>;
};

let modelSeq = 0;

const LINE_HEIGHT = 20;
/** Width of the mirrored line-number strip on the original (left) pane. */
const MIRRORED_GUTTER_WIDTH = 44;

type MirroredGutter = {
  left: number;
  lines: Array<{ n: number; top: number }>;
};

function toDiffEditorOptions(
  options: DiffViewerOptions,
): Monaco.editor.IDiffEditorOptions {
  return {
    renderSideBySide: options.sideBySide,
    // Monaco otherwise drops to inline below 900px, which desyncs the panes
    // from the two-column header we draw ourselves.
    useInlineViewWhenSpaceIsLimited: false,
    ignoreTrimWhitespace: options.trimWhitespace,
    diffWordWrap: options.softWrap ? "on" : "off",
    hideUnchangedRegions: { enabled: options.collapseUnchanged },
  };
}

/**
 * Monaco can only draw a gutter on the left of an editor, so the original pane
 * runs with `lineNumbers: "off"` and we place the numbers ourselves. Positions
 * come from the view (not line × lineHeight) so collapsed regions and the view
 * zones the diff editor inserts for alignment stay correct.
 */
function readMirroredGutter(
  editor: Monaco.editor.ICodeEditor,
): MirroredGutter | null {
  if (
    typeof editor.getVisibleRanges !== "function" ||
    typeof editor.getTopForLineNumber !== "function" ||
    typeof editor.getLayoutInfo !== "function"
  ) {
    return null;
  }
  const scrollTop = editor.getScrollTop();
  const lines: MirroredGutter["lines"] = [];
  for (const range of editor.getVisibleRanges()) {
    for (let n = range.startLineNumber; n <= range.endLineNumber; n += 1) {
      lines.push({ n, top: editor.getTopForLineNumber(n) - scrollTop });
    }
  }
  return {
    left: Math.max(0, editor.getLayoutInfo().width - MIRRORED_GUTTER_WIDTH),
    lines,
  };
}

/** The strip owns the pane's right edge, so Monaco's gutter and slider stand down. */
function originalPaneOptions(sideBySide: boolean): Monaco.editor.IEditorOptions {
  return {
    lineNumbers: sideBySide ? "off" : "on",
    scrollbar: { vertical: sideBySide ? "hidden" : "auto" },
  };
}

export function MonacoDiffViewer({
  leftText,
  rightText,
  leftLabel,
  rightLabel,
  filePath,
  hideHeaders = false,
  className,
  readOnly = true,
  onEditorContextMenu,
  options = DEFAULT_DIFF_VIEWER_OPTIONS,
  onDiffCountChange,
  handleRef,
}: MonacoDiffViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);
  const originalModelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const modifiedModelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const onContextMenuRef = useRef(onEditorContextMenu);
  onContextMenuRef.current = onEditorContextMenu;
  const onDiffCountChangeRef = useRef(onDiffCountChange);
  onDiffCountChangeRef.current = onDiffCountChange;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [monacoApi, setMonacoApi] = useState<typeof Monaco | null>(
    getMonacoIfLoaded(),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gutter, setGutter] = useState<MirroredGutter | null>(null);
  const themeKind = useTheme();
  const language = filePath ? detectLanguage(filePath) : "plaintext";

  useEffect(() => {
    if (monacoApi) {
      applyGitViewMonacoTheme(monacoApi, themeKind);
      return;
    }
    // Monaco resolves long after a short-lived mount (tests, fast tab switches);
    // settling state then would touch a torn-down tree.
    let cancelled = false;
    void loadMonaco()
      .then((api) => {
        if (cancelled) {
          return;
        }
        applyGitViewMonacoTheme(api, themeKind);
        setMonacoApi(api);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Monaco failed");
      });
    return () => {
      cancelled = true;
    };
  }, [monacoApi, themeKind]);

  useEffect(() => {
    if (!monacoApi || !hostRef.current) {
      return;
    }

    const monaco = monacoApi;
    const monacoTheme = applyGitViewMonacoTheme(monaco, themeKind);
    const seq = ++modelSeq;
    const originalUri = monaco.Uri.parse(
      `inmemory://gitview/${seq}/original`,
    );
    const modifiedUri = monaco.Uri.parse(
      `inmemory://gitview/${seq}/modified`,
    );

    // Dispose any stale models with the same URI (shouldn't happen with seq).
    monaco.editor.getModel(originalUri)?.dispose();
    monaco.editor.getModel(modifiedUri)?.dispose();

    const original = monaco.editor.createModel(
      leftText,
      language ?? "plaintext",
      originalUri,
    );
    const modified = monaco.editor.createModel(
      rightText,
      language ?? "plaintext",
      modifiedUri,
    );
    originalModelRef.current = original;
    modifiedModelRef.current = modified;

    const useCustomMenu = typeof onContextMenuRef.current === "function";
    const editor = monaco.editor.createDiffEditor(hostRef.current, {
      theme: monacoTheme,
      readOnly,
      originalEditable: false,
      enableSplitViewResizing: true,
      renderOverviewRuler: true,
      renderIndicators: true,
      renderMarginRevertIcon: false,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 12.5,
      lineHeight: 20,
      fontFamily:
        "var(--vscode-editor-font-family, ui-monospace, 'Cascadia Code', Consolas, monospace)",
      renderLineHighlight: "none",
      occurrencesHighlight: "off",
      selectionHighlight: false,
      // Custom Annotate menu when parent wires onEditorContextMenu
      contextmenu: !useCustomMenu,
      links: false,
      folding: true,
      wordWrap: "off",
      glyphMargin: false,
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      padding: { top: 0, bottom: 0 },
      scrollbar: {
        vertical: "auto",
        horizontal: "auto",
        useShadows: false,
      },
      renderGutterMenu: false,
      ...toDiffEditorOptions(optionsRef.current),
    });

    editor.setModel({ original, modified });
    editorRef.current = editor;

    const bindContextMenu = (
      sideEditor: Monaco.editor.ICodeEditor,
      side: "left" | "right",
    ) =>
      sideEditor.onContextMenu((e) => {
        const handler = onContextMenuRef.current;
        if (!handler) {
          return;
        }
        const pos = e.target.position;
        if (!pos) {
          return;
        }
        e.event.preventDefault();
        e.event.stopPropagation();
        handler({
          x: e.event.posx,
          y: e.event.posy,
          lineNumber: pos.lineNumber,
          side,
        });
      });

    const disposables: Monaco.IDisposable[] = [];
    if (useCustomMenu) {
      disposables.push(bindContextMenu(editor.getOriginalEditor(), "left"));
      disposables.push(bindContextMenu(editor.getModifiedEditor(), "right"));
    }
    disposables.push(
      editor.onDidUpdateDiff(() => {
        onDiffCountChangeRef.current?.(editor.getLineChanges()?.length ?? 0);
      }),
    );

    const originalEditor = editor.getOriginalEditor();
    const syncGutter = () => {
      setGutter(
        optionsRef.current.sideBySide
          ? readMirroredGutter(originalEditor)
          : null,
      );
    };
    originalEditor.updateOptions(
      originalPaneOptions(optionsRef.current.sideBySide),
    );
    syncGutter();
    for (const subscribe of [
      originalEditor.onDidScrollChange,
      originalEditor.onDidLayoutChange,
    ]) {
      if (typeof subscribe === "function") {
        disposables.push(subscribe.call(originalEditor, syncGutter));
      }
    }
    disposables.push(editor.onDidUpdateDiff(syncGutter));

    return () => {
      for (const d of disposables) {
        d.dispose();
      }
      editor.dispose();
      editorRef.current = null;
      original.dispose();
      modified.dispose();
      originalModelRef.current = null;
      modifiedModelRef.current = null;
    };
    // Recreate only when monaco/language mounts; content synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monacoApi, language, readOnly, Boolean(onEditorContextMenu)]);

  // Sync text + theme without full recreate
  useEffect(() => {
    const editor = editorRef.current;
    const original = originalModelRef.current;
    const modified = modifiedModelRef.current;
    if (!editor || !original || !modified || !monacoApi) {
      return;
    }
    if (original.getValue() !== leftText) {
      original.setValue(leftText);
    }
    if (modified.getValue() !== rightText) {
      modified.setValue(rightText);
    }
    const lang = language ?? "plaintext";
    if (original.getLanguageId() !== lang) {
      monacoApi.editor.setModelLanguage(original, lang);
    }
    if (modified.getLanguageId() !== lang) {
      monacoApi.editor.setModelLanguage(modified, lang);
    }
    monacoApi.editor.setTheme(applyGitViewMonacoTheme(monacoApi, themeKind));
    editor.layout();
  }, [leftText, rightText, language, monacoApi, themeKind]);

  const { sideBySide, trimWhitespace, collapseUnchanged, softWrap } = options;
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.updateOptions(
      toDiffEditorOptions({
        sideBySide,
        trimWhitespace,
        collapseUnchanged,
        softWrap,
      }),
    );
    // The diff editor pushes shared options down to both panes, so the
    // original's suppressed line numbers have to be re-asserted afterwards.
    const originalEditor = editor.getOriginalEditor();
    originalEditor.updateOptions(originalPaneOptions(sideBySide));
    setGutter(sideBySide ? readMirroredGutter(originalEditor) : null);
  }, [sideBySide, trimWhitespace, collapseUnchanged, softWrap]);

  useImperativeHandle(
    handleRef,
    () => ({
      goToDiff: (target) => editorRef.current?.goToDiff(target),
    }),
    [],
  );

  if (loadError) {
    return (
      <div
        className={cn(
          "flex-1 min-h-0 flex items-center justify-center text-xs text-vscode-error p-3",
          className,
        )}
        data-testid="git-diff-split"
        data-monaco-ready="false"
      >
        {loadError}
      </div>
    );
  }

  if (!monacoApi) {
    return (
      <div
        className={cn(
          "flex-1 min-h-0 flex items-center justify-center text-xs text-vscode-description",
          className,
        )}
        data-testid="git-diff-split"
        data-monaco-ready="false"
      >
        Loading editor…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col overflow-hidden bg-vscode-editor-bg",
        className,
      )}
      data-testid="git-diff-split"
      data-monaco-ready="true"
    >
      {!hideHeaders && (leftLabel || rightLabel) ? (
        <div className="shrink-0 grid grid-cols-2 border-b border-vscode-panel-border">
          <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-vscode-description border-r border-vscode-panel-border">
            {leftLabel ?? "Original"}
          </div>
          <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-vscode-description">
            {rightLabel ?? "Modified"}
          </div>
        </div>
      ) : null}
      <div className="relative flex-1 min-h-0 w-full">
        <div
          ref={hostRef}
          className="absolute inset-0 nx-monaco-diff-host"
          data-testid="monaco-diff-host"
        />
        {gutter ? (
          <div
            className="nx-mirrored-gutter absolute top-0 bottom-0 overflow-hidden pointer-events-none select-none border-l border-vscode-panel-border"
            style={{ left: gutter.left, width: MIRRORED_GUTTER_WIDTH }}
            data-testid="monaco-diff-left-line-numbers"
            aria-hidden
          >
            {gutter.lines.map((line) => (
              <div
                key={line.n}
                className="absolute right-0 w-full pr-2 text-right"
                style={{ top: line.top, height: LINE_HEIGHT }}
              >
                {line.n}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
