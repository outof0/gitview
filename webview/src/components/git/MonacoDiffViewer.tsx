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
import { resolveThemeColor } from "../../lib/webviewTheme";
import {
  buildDiffNavigationHunks,
  type DiffNavigationHunk,
} from "./diffNavigation";

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
    // `advanced` needs a real web worker (editorWorker) — our vscode-webview
    // uses a noop blob worker to avoid CSP, so `getLineChanges()` stays null
    // and the diff never paints. `legacy` runs on the main thread.
    diffAlgorithm: "legacy",
  } as Monaco.editor.IDiffEditorOptions;
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

function applyDiffDecorations(
  monaco: typeof import("monaco-editor/editor"),
  originalCollection: import("monaco-editor/editor").editor.IEditorDecorationsCollection | null,
  modifiedCollection: import("monaco-editor/editor").editor.IEditorDecorationsCollection | null,
  hunks: readonly DiffNavigationHunk[],
  activeHunkIndex: number,
  colors: DiffOverviewColors,
): number {
  const originalDecorations: import("monaco-editor/editor").editor.IModelDeltaDecoration[] = [];
  const modifiedDecorations: import("monaco-editor/editor").editor.IModelDeltaDecoration[] = [];

  const add = (
    decorations: import("monaco-editor/editor").editor.IModelDeltaDecoration[],
    startLine: number,
    endLine: number,
    hunk: DiffNavigationHunk,
    hunkIndex: number,
  ) => {
    const tone = `monaco-diff-${hunk.kind}`;
    const active = hunkIndex === activeHunkIndex ? "monaco-diff-active" : "";
    const classes = [tone, active].filter(Boolean).join(" ");
    const overviewColor = active
      ? colors.active
      : hunk.kind === "added"
        ? colors.added
        : hunk.kind === "removed"
          ? colors.removed
          : colors.modified;
    for (let line = startLine; line <= endLine; line += 1) {
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: classes,
          marginClassName: tone,
          overviewRuler: {
            color: overviewColor,
            // Monaco's public enum is not present in the lightweight editor
            // entry used by the webview; Full is the documented 1|2|4 lane.
            position: 7,
          },
          linesDecorationsClassName: [
            `${tone}-gutter`,
            active ? "monaco-diff-active-gutter" : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
      });
    }
  };

  for (const [index, hunk] of hunks.entries()) {
    add(
      originalDecorations,
      hunk.originalStartLine,
      hunk.originalEndLine,
      hunk,
      index,
    );
    add(
      modifiedDecorations,
      hunk.modifiedStartLine,
      hunk.modifiedEndLine,
      hunk,
      index,
    );
  }

  originalCollection?.set(originalDecorations);
  modifiedCollection?.set(modifiedDecorations);
  return hunks.length;
}

type DiffOverviewColors = {
  active: string;
  added: string;
  removed: string;
  modified: string;
};

function readDiffOverviewColors(element: Element): DiffOverviewColors {
  const modified =
    resolveThemeColor(element, "--nx-modified-bar") || "transparent";
  return {
    active: resolveThemeColor(element, "--ring") || modified,
    added: resolveThemeColor(element, "--nx-added-bar") || modified,
    removed: resolveThemeColor(element, "--nx-deleted-bar") || modified,
    modified,
  };
}

/** The strip owns the pane's right edge, so Monaco's gutter and slider stand down. */
function originalPaneOptions(sideBySide: boolean): Monaco.editor.IEditorOptions {
  return {
    lineNumbers: sideBySide ? "off" : "on",
    scrollbar: {
      vertical: sideBySide ? "hidden" : "auto",
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
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
  const originalDecorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const modifiedDecorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const navigationHunksRef = useRef<DiffNavigationHunk[]>([]);
  const activeHunkIndexRef = useRef(-1);
  const repaintDiffRef = useRef<() => void>(() => {});
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
      overviewRulerLanes: 3,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      renderIndicators: true,
      renderMarginRevertIcon: false,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 12.5,
      lineHeight: 20,
      fontFamily:
        "var(--nx-font-code)",
      renderLineHighlight: "none",
      occurrencesHighlight: "off",
      selectionHighlight: false,
      // Custom Annotate menu when parent wires onEditorContextMenu
      contextmenu: !useCustomMenu,
      links: false,
      folding: true,
      wordWrap: "off",
      glyphMargin: false,
      lineDecorationsWidth: 4,
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      padding: { top: 0, bottom: 0 },
      scrollbar: {
        vertical: "auto",
        horizontal: "auto",
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
        useShadows: false,
      },
      renderGutterMenu: false,
      ...toDiffEditorOptions(optionsRef.current),
    });

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
    // Main-thread diff decorations — do not rely on Monaco's worker (noop in
    // vscode-webview). This guarantees highlight for M/A/D even when
    // `getLineChanges()` stays null.
    const origEditor = editor.getOriginalEditor() as unknown as {
      createDecorationsCollection?: () => Monaco.editor.IEditorDecorationsCollection;
      deltaDecorations?: (
        oldDecorations: string[],
        newDecorations: Monaco.editor.IModelDeltaDecoration[],
      ) => string[];
    };
    const modEditor = editor.getModifiedEditor() as unknown as {
      createDecorationsCollection?: () => Monaco.editor.IEditorDecorationsCollection;
      deltaDecorations?: (
        oldDecorations: string[],
        newDecorations: Monaco.editor.IModelDeltaDecoration[],
      ) => string[];
    };
    const makeCollection = (
      ed: typeof origEditor,
    ): Monaco.editor.IEditorDecorationsCollection => {
      if (typeof ed.createDecorationsCollection === "function") {
        return ed.createDecorationsCollection();
      }
      let ids: string[] = [];
      return {
        set: (decorations: Monaco.editor.IModelDeltaDecoration[]) => {
          ids = ed.deltaDecorations?.(ids, decorations) ?? [];
        },
        clear: () => {
          if (ids.length) {
            ed.deltaDecorations?.(ids, []);
            ids = [];
          }
        },
        dispose: () => {
          if (ids.length) {
            ed.deltaDecorations?.(ids, []);
            ids = [];
          }
        },
      } as unknown as Monaco.editor.IEditorDecorationsCollection;
    };
    originalDecorationsRef.current = makeCollection(origEditor);
    modifiedDecorationsRef.current = makeCollection(modEditor);
    const applyOwnDiff = (left: string, right: string) => {
      const hunks = buildDiffNavigationHunks(left, right);
      navigationHunksRef.current = hunks;
      if (activeHunkIndexRef.current >= hunks.length) {
        activeHunkIndexRef.current = -1;
      }
      const count = applyDiffDecorations(
        monaco,
        originalDecorationsRef.current,
        modifiedDecorationsRef.current,
        hunks,
        activeHunkIndexRef.current,
        readDiffOverviewColors(hostRef.current!),
      );
      onDiffCountChangeRef.current?.(count);
      return count;
    };
    repaintDiffRef.current = () => {
      applyDiffDecorations(
        monaco,
        originalDecorationsRef.current,
        modifiedDecorationsRef.current,
        navigationHunksRef.current,
        activeHunkIndexRef.current,
        readDiffOverviewColors(hostRef.current!),
      );
    };
    const findHunkAtLine = (
      side: "left" | "right",
      lineNumber: number,
    ): number => {
      const start = (hunk: DiffNavigationHunk) =>
        side === "left" ? hunk.originalStartLine : hunk.modifiedStartLine;
      const end = (hunk: DiffNavigationHunk) =>
        side === "left" ? hunk.originalEndLine : hunk.modifiedEndLine;
      return navigationHunksRef.current.findIndex(
        (hunk) => lineNumber >= start(hunk) && lineNumber <= end(hunk),
      );
    };
    const revealHunk = (hunkIndex: number) => {
      const hunk = navigationHunksRef.current[hunkIndex];
      if (!hunk) {
        return;
      }
      activeHunkIndexRef.current = hunkIndex;
      repaintDiffRef.current();
      editor.getModifiedEditor().revealLineInCenter(hunk.modifiedStartLine);
      editor.getOriginalEditor().revealLineInCenter(hunk.originalStartLine);
    };
    const isDiffMarker = (element: unknown): boolean => {
      const candidate = element as {
        closest?: (selector: string) => unknown;
      } | null;
      return Boolean(
        candidate?.closest?.(
          ".monaco-diff-added-gutter, .monaco-diff-removed-gutter, .monaco-diff-changed-gutter",
        ),
      );
    };
    const bindDiffMarkerNavigation = (
      sideEditor: Monaco.editor.ICodeEditor,
      side: "left" | "right",
    ) =>
      sideEditor.onMouseDown((event) => {
        const lineNumber = event.target.position?.lineNumber;
        if (!lineNumber || !isDiffMarker(event.target.element)) {
          return;
        }
        const hunkIndex = findHunkAtLine(side, lineNumber);
        if (hunkIndex >= 0) {
          revealHunk(hunkIndex);
        }
      });
    disposables.push(
      bindDiffMarkerNavigation(editor.getOriginalEditor(), "left"),
      bindDiffMarkerNavigation(editor.getModifiedEditor(), "right"),
    );
    const notifyDiffCount = () => {
      const changes = editor.getLineChanges();
      if (changes !== null && changes !== undefined) {
        // Prefer Monaco's count when available, but keep our decorations as
        // fallback — they are already applied via applyOwnDiff.
        onDiffCountChangeRef.current?.(changes.length);
        return true;
      }
      return false;
    };
    disposables.push(
      editor.onDidUpdateDiff(() => {
        notifyDiffCount();
      }),
    );

    editor.setModel({ original, modified });
    editorRef.current = editor;
    // Apply our diff immediately so highlight and count appear even if Monaco's
    // worker never responds. This also fixes the "1 difference" but no color.
    applyOwnDiff(leftText, rightText);
    // Still poll Monaco's native diff to keep count in sync if it later reports.
    let pollId: number | null = null;
    let rafId: number | null = null;
    const cancelPoll = () => {
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    disposables.push({ dispose: cancelPoll });
    const schedulePoll = () => {
      if (notifyDiffCount()) {
        cancelPoll();
        return;
      }
      let attempts = 0;
      pollId = window.setInterval(() => {
        attempts += 1;
        if (notifyDiffCount()) {
          cancelPoll();
          return;
        }
        if (attempts > 40) {
          cancelPoll();
        }
      }, 50);
      rafId = window.requestAnimationFrame(() => {
        if (notifyDiffCount()) {
          cancelPoll();
        }
      });
    };
    queueMicrotask(schedulePoll);
    requestAnimationFrame(schedulePoll);

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

    const host = hostRef.current;
    const resizeObserver =
      typeof ResizeObserver === "function" && host
        ? new ResizeObserver(() => {
            editor.layout();
          })
        : null;
    resizeObserver?.observe(host);
    requestAnimationFrame(() => {
      editor.layout();
      syncGutter();
    });

    return () => {
      resizeObserver?.disconnect();
      for (const d of disposables) {
        d.dispose();
      }
      originalDecorationsRef.current?.clear();
      modifiedDecorationsRef.current?.clear();
      originalDecorationsRef.current = null;
      modifiedDecorationsRef.current = null;
      navigationHunksRef.current = [];
      activeHunkIndexRef.current = -1;
      repaintDiffRef.current = () => {};
      editor.dispose();
      editorRef.current = null;
      original.dispose();
      modified.dispose();
      originalModelRef.current = null;
      modifiedModelRef.current = null;
    };
    // Recreated only when monaco/language mounts or a construction option
    // changes; text and theme are synced by the effect below.
    // `Boolean(onEditorContextMenu)` stands in for the callback itself, whose
    // identity changes on every render and would rebuild the editor each time.
  }, [monacoApi, language, readOnly, Boolean(onEditorContextMenu)]);

  // Sync text + theme without full recreate
  useEffect(() => {
    const editor = editorRef.current;
    const original = originalModelRef.current;
    const modified = modifiedModelRef.current;
    if (!editor || !original || !modified || !monacoApi) {
      return;
    }
    let textChanged = false;
    if (original.getValue() !== leftText) {
      original.setValue(leftText);
      textChanged = true;
    }
    if (modified.getValue() !== rightText) {
      modified.setValue(rightText);
      textChanged = true;
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
    if (textChanged) {
      const hunks = buildDiffNavigationHunks(leftText, rightText);
      navigationHunksRef.current = hunks;
      if (activeHunkIndexRef.current >= hunks.length) {
        activeHunkIndexRef.current = -1;
      }
      onDiffCountChangeRef.current?.(hunks.length);
    }
    applyDiffDecorations(
      monacoApi,
      originalDecorationsRef.current,
      modifiedDecorationsRef.current,
      navigationHunksRef.current,
      activeHunkIndexRef.current,
      readDiffOverviewColors(hostRef.current!),
    );
    // Text changed → Monaco recomputes diff async. getLineChanges() is null
    // until then, so poll until onDidUpdateDiff fires, otherwise toolbar
    // stays "Comparing…" when clicking rapidly between files (same language).
    if (textChanged && onDiffCountChangeRef.current) {
      let attempts = 0;
      let interval: number | null = null;
      let raf: number | null = null;
      const tryNotify = () => {
        const changes = editor.getLineChanges();
        if (changes !== null && changes !== undefined) {
          onDiffCountChangeRef.current?.(changes.length);
          return true;
        }
        return false;
      };
      if (tryNotify()) {
        return undefined;
      }
      interval = window.setInterval(() => {
        attempts += 1;
        if (tryNotify()) {
          if (interval !== null) {
            window.clearInterval(interval);
          }
          if (raf !== null) {
            window.cancelAnimationFrame(raf);
          }
          return;
        }
        if (attempts > 40) {
          if (interval !== null) {
            window.clearInterval(interval);
          }
          if (raf !== null) {
            window.cancelAnimationFrame(raf);
          }
          onDiffCountChangeRef.current?.(
            navigationHunksRef.current.length,
          );
        }
      }, 50);
      raf = window.requestAnimationFrame(() => {
        if (tryNotify()) {
          if (interval !== null) {
            window.clearInterval(interval);
          }
          window.cancelAnimationFrame(raf!);
        }
      });
      return () => {
        if (interval !== null) {
          window.clearInterval(interval);
        }
        if (raf !== null) {
          window.cancelAnimationFrame(raf);
        }
      };
    }
    return undefined;
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
      goToDiff: (target) => {
        const editor = editorRef.current;
        const hunks = navigationHunksRef.current;
        if (!editor || hunks.length === 0) {
          return;
        }

        const modifiedEditor = editor.getModifiedEditor();
        const originalEditor = editor.getOriginalEditor();
        const currentLine = modifiedEditor.getPosition()?.lineNumber ?? 1;
        let nextIndex = activeHunkIndexRef.current;

        if (nextIndex < 0) {
          if (target === "next") {
            nextIndex = hunks.findIndex(
              (hunk) => hunk.modifiedEndLine >= currentLine,
            );
            if (nextIndex < 0) {
              nextIndex = 0;
            }
          } else {
            for (let index = hunks.length - 1; index >= 0; index -= 1) {
              if (hunks[index]!.modifiedStartLine <= currentLine) {
                nextIndex = index;
                break;
              }
            }
            if (nextIndex < 0) {
              nextIndex = hunks.length - 1;
            }
          }
        } else {
          const offset = target === "next" ? 1 : -1;
          nextIndex = (nextIndex + offset + hunks.length) % hunks.length;
        }

        const hunk = hunks[nextIndex]!;
        activeHunkIndexRef.current = nextIndex;
        repaintDiffRef.current();
        modifiedEditor.revealLineInCenter(hunk.modifiedStartLine);
        originalEditor.revealLineInCenter(hunk.originalStartLine);
      },
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
          <div className="h-7 px-3 flex items-center text-ui-sm font-semibold text-vscode-description border-r border-vscode-panel-border">
            {leftLabel ?? "Original"}
          </div>
          <div className="h-7 px-3 flex items-center text-ui-sm font-semibold text-vscode-description">
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
