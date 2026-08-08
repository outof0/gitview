// Single Monaco editor for the entire Result (center) merge pane.
// One model, continuous line numbers; decorations/edits mapped via block spans.

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  createElement,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { useGitViewStore, type HighlightingMode } from "../../stores/gitViewStore";
import type { BlockRows } from "./rows";
import { useTheme } from "../../hooks/useTheme";
import { applyGitViewMonacoTheme } from "../../lib/monacoTheme";
import {
  monacoLineDecorationClass,
  monacoStripeDecorationClass,
  type RowHighlightContext,
} from "./rowHighlight";
import {
  applyMonacoChangesToSpans,
  buildCenterSpans,
  CENTER_LINE_HEIGHT,
  extractSpanText,
  joinCenterText,
  spanAtLine,
  type CenterBlockSpan,
} from "./centerDocument";
import { CollapsedRegionBanner } from "./CollapsedRegionBanner";
import type * as Monaco from "monaco-editor/editor";
import { getMonacoIfLoaded, loadMonaco } from "./monacoSetup";
import { cn } from "../../lib/cn";
import { actBtnClass, editorPaneClass } from "./editorPaneClasses";

type MonacoCenterPaneProps = {
  blocks: BlockRows[];
  activeBlockId: string | null;
  highlightingMode?: HighlightingMode;
  language: string;
  editorRef?: (el: HTMLDivElement | null) => void;
  onScroll?: () => void;
  onSelectBlock: (blockId: string) => void;
  onEditBlock?: (blockId: string, text: string) => void;
  onRevertBlock?: (blockId: string) => void;
  matchedBlockIds?: Set<string>;
  rowRef?: (blockId: string, el: HTMLDivElement | null) => void;
  collapsedBlockIds?: Set<string>;
  onExpandBlock?: (blockId: string) => void;
};

export function MonacoCenterPane({
  blocks,
  activeBlockId,
  highlightingMode = "lines",
  language,
  editorRef,
  onScroll,
  onSelectBlock,
  onEditBlock,
  onRevertBlock,
  matchedBlockIds,
  rowRef,
  collapsedBlockIds,
  onExpandBlock,
}: MonacoCenterPaneProps) {
  const [monacoApi, setMonacoApi] = useState<typeof Monaco | null>(
    getMonacoIfLoaded(),
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRefInternal =
    useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const decorationsRef =
    useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const spansRef = useRef<CenterBlockSpan[]>([]);
  const blocksByIdRef = useRef<Map<string, BlockRows>>(new Map());
  const applyingExternalRef = useRef(false);
  /** Model value at the moment we last pushed an edit up to the store. */
  const emittedModelTextRef = useRef<string | null>(null);
  const zoneIdsRef = useRef<string[]>([]);
  const zoneRootsRef = useRef<Map<string, Root>>(new Map());
  const onEditBlockRef = useRef(onEditBlock);
  const onSelectBlockRef = useRef(onSelectBlock);
  const onExpandBlockRef = useRef(onExpandBlock);
  onEditBlockRef.current = onEditBlock;
  onSelectBlockRef.current = onSelectBlock;
  onExpandBlockRef.current = onExpandBlock;

  const themeKind = useTheme();
  const monacoTheme = monacoApi
    ? applyGitViewMonacoTheme(monacoApi, themeKind)
    : "gitview-dark";
  const whitespacePolicy = useGitViewStore((s) => s.whitespacePolicy);
  const compareMode = useGitViewStore((s) => s.compareMode);
  const highlightCtx: RowHighlightContext = useMemo(
    () => ({ whitespacePolicy, compareMode }),
    [whitespacePolicy, compareMode],
  );

  const text = useMemo(() => joinCenterText(blocks), [blocks]);
  const spans = useMemo(() => buildCenterSpans(blocks), [blocks]);
  const lineCount = text === "" ? 1 : text.split("\n").length;
  const contentHeight = lineCount * CENTER_LINE_HEIGHT;

  const blocksById = useMemo(() => {
    const m = new Map<string, BlockRows>();
    for (const b of blocks) {
      m.set(b.blockId, b);
    }
    return m;
  }, [blocks]);

  spansRef.current = spans;
  blocksByIdRef.current = blocksById;

  const [monacoError, setMonacoError] = useState<string | null>(null);

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
        const message =
          err instanceof Error ? err.message : "Monaco failed to load";
        setMonacoError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [monacoApi, themeKind]);

  const setScrollEl = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el;
      editorRef?.(el);
    },
    [editorRef],
  );

  const applyDecorations = useCallback(
    (
      editor: Monaco.editor.IStandaloneCodeEditor,
      monaco: typeof Monaco,
      nextSpans: CenterBlockSpan[],
      nextBlocks: Map<string, BlockRows>,
    ) => {
      const model = editor.getModel();
      if (!model) {
        return;
      }

      decorationsRef.current?.clear();
      decorationsRef.current = null;

      const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
      const modelLineCount = model.getLineCount();

      for (const span of nextSpans) {
        if (span.lineCount <= 0) {
          continue;
        }
        const block = nextBlocks.get(span.blockId);
        if (!block) {
          continue;
        }
        const isActive = activeBlockId === span.blockId;
        const isMatched = !!matchedBlockIds?.has(span.blockId);

        for (
          let lineNo = span.startLine;
          lineNo <= span.endLine && lineNo <= modelLineCount;
          lineNo++
        ) {
          const localIdx = lineNo - span.startLine;
          const lineText = model.getLineContent(lineNo);
          const lineClass =
            highlightingMode === "lines"
              ? monacoLineDecorationClass(
                  block,
                  localIdx,
                  lineText,
                  highlightCtx,
                )
              : "";
          const stripeClass =
            highlightingMode === "none"
              ? ""
              : monacoStripeDecorationClass(
                  block,
                  localIdx,
                  lineText,
                  highlightCtx,
                );

          const extra: string[] = [];
          if (isActive) {
            extra.push("nx-monaco-active-line");
          }
          if (isMatched) {
            extra.push("nx-monaco-match-line");
          }
          const className = [lineClass, ...extra].filter(Boolean).join(" ");
          if (!className && !stripeClass) {
            continue;
          }

          decorations.push({
            range: new monaco.Range(
              lineNo,
              1,
              lineNo,
              model.getLineMaxColumn(lineNo),
            ),
            options: {
              isWholeLine: true,
              className: className || undefined,
              linesDecorationsClassName: stripeClass || undefined,
            },
          });
        }
      }

      if (decorations.length > 0) {
        decorationsRef.current =
          editor.createDecorationsCollection(decorations);
      }
    },
    [activeBlockId, matchedBlockIds, highlightingMode, highlightCtx],
  );

  const clearViewZones = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      if (zoneIdsRef.current.length > 0) {
        editor.changeViewZones((accessor) => {
          for (const id of zoneIdsRef.current) {
            accessor.removeZone(id);
          }
        });
        zoneIdsRef.current = [];
      }
      for (const root of zoneRootsRef.current.values()) {
        root.unmount();
      }
      zoneRootsRef.current.clear();
    },
    [],
  );

  const applyCollapsedZones = useCallback(
    (
      editor: Monaco.editor.IStandaloneCodeEditor,
      monaco: typeof Monaco,
      nextSpans: CenterBlockSpan[],
      collapsed: Set<string> | undefined,
    ) => {
      clearViewZones(editor);

      const hidden: Monaco.IRange[] = [];
      const collapsedList = nextSpans.filter(
        (s) => collapsed?.has(s.blockId) && s.lineCount > 0,
      );

      for (const span of collapsedList) {
        hidden.push(new monaco.Range(span.startLine, 1, span.endLine, 1));
      }
      // setHiddenAreas exists at runtime on ICodeEditor; typings vary by monaco version.
      const withHidden = editor as Monaco.editor.IStandaloneCodeEditor & {
        setHiddenAreas?: (ranges: Monaco.IRange[]) => void;
      };
      withHidden.setHiddenAreas?.(hidden);

      if (collapsedList.length === 0) {
        return;
      }

      editor.changeViewZones((accessor) => {
        for (const span of collapsedList) {
          const dom = document.createElement("div");
          dom.className = "nx-monaco-collapse-zone";
          const root = createRoot(dom);
          zoneRootsRef.current.set(span.blockId, root);
          root.render(
            createElement(CollapsedRegionBanner, {
              hiddenLineCount: span.lineCount,
              onExpand: () => onExpandBlockRef.current?.(span.blockId),
            }),
          );
          const id = accessor.addZone({
            afterLineNumber: Math.max(0, span.startLine - 1),
            heightInPx: CENTER_LINE_HEIGHT + 4,
            domNode: dom,
            suppressMouseDown: false,
          });
          zoneIdsRef.current.push(id);
        }
      });
    },
    [clearViewZones],
  );

  // Create / dispose the single editor once per language mount.
  useEffect(() => {
    if (!monacoApi || !hostRef.current) {
      return;
    }

    const monaco = monacoApi;
    const uri = monaco.Uri.parse("inmemory://merge-center/result");
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(text, language, uri);
    } else {
      if (model.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(model, language);
      }
      applyingExternalRef.current = true;
      if (model.getValue() !== text) {
        model.setValue(text);
      }
      applyingExternalRef.current = false;
    }
    modelRef.current = model;

    const editor = monaco.editor.create(hostRef.current, {
      model,
      theme: monacoTheme,
      readOnly: false,
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      glyphMargin: true,
      folding: false,
      lineDecorationsWidth: 4,
      renderLineHighlight: "none",
      renderLineHighlightOnlyWhenFocus: false,
      scrollBeyondLastLine: false,
      wordWrap: "off",
      minimap: { enabled: false },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: "hidden",
        horizontal: "hidden",
        handleMouseWheel: false,
      },
      fixedOverflowWidgets: true,
      automaticLayout: true,
      fontSize: 12.5,
      lineHeight: CENTER_LINE_HEIGHT,
      fontFamily:
        "var(--vscode-editor-font-family, ui-monospace, 'Cascadia Code', Consolas, monospace)",
      contextmenu: false,
      links: false,
      occurrencesHighlight: "off",
      selectionHighlight: false,
      renderWhitespace: "none",
      guides: { indentation: false, bracketPairs: false },
      padding: { top: 0, bottom: 0 },
    });

    editorRefInternal.current = editor;
    applyDecorations(editor, monaco, spansRef.current, blocksByIdRef.current);
    applyCollapsedZones(editor, monaco, spansRef.current, collapsedBlockIds);

    const changeDisposable = model.onDidChangeContent((e) => {
      if (e.isFlush || applyingExternalRef.current) {
        return;
      }
      if (!onEditBlockRef.current) {
        return;
      }

      const changes = [...e.changes].sort(
        (a, b) => b.rangeOffset - a.rangeOffset,
      );
      const { spans: nextSpans, affectedBlockIds } = applyMonacoChangesToSpans(
        spansRef.current,
        changes,
      );
      spansRef.current = nextSpans;

      const modelNow = modelRef.current;
      if (!modelNow || affectedBlockIds.length === 0) {
        return;
      }

      const total = modelNow.getLineCount();
      const value = modelNow.getValue();
      for (const blockId of affectedBlockIds) {
        const span = nextSpans.find((s) => s.blockId === blockId);
        if (!span) {
          continue;
        }
        const newText = extractSpanText(
          (ln) => modelNow.getLineContent(ln),
          total,
          value,
          span,
        );
        const prev = blocksByIdRef.current.get(blockId)?.centerText ?? "";
        if (newText !== prev) {
          emittedModelTextRef.current = value;
          onEditBlockRef.current(blockId, newText);
        }
      }
    });

    const mouseDisposable = editor.onMouseDown((ev) => {
      const pos = ev.target.position;
      if (!pos) {
        return;
      }
      const span = spanAtLine(spansRef.current, pos.lineNumber);
      if (span?.navigable) {
        onSelectBlockRef.current(span.blockId);
      }
    });

    return () => {
      changeDisposable.dispose();
      mouseDisposable.dispose();
      clearViewZones(editor);
      decorationsRef.current?.clear();
      decorationsRef.current = null;
      editor.dispose();
      editorRefInternal.current = null;
      // Keep the model for fast remount; dispose only if no other refs
      // (we dispose explicitly so language switches don't leak).
      modelRef.current?.dispose();
      modelRef.current = null;
    };
    // Content/theme/collapse synced in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monacoApi, language]);

  // Sync model text, decorations, collapse, layout from React state.
  useEffect(() => {
    const editor = editorRefInternal.current;
    const model = modelRef.current;
    if (!editor || !model || !monacoApi) {
      return;
    }

    if (model.getLanguageId() !== language) {
      monacoApi.editor.setModelLanguage(model, language);
    }

    const modelValue = model.getValue();
    // While `text` is only the store's recomposition of an edit the user is
    // still typing, writing it back would drop keystrokes landed since the emit.
    const isOwnPendingEdit = emittedModelTextRef.current === modelValue;
    if (modelValue !== text && !isOwnPendingEdit) {
      emittedModelTextRef.current = null;
      applyingExternalRef.current = true;
      const pos = editor.getPosition();
      model.setValue(text);
      if (pos) {
        const maxLine = model.getLineCount();
        editor.setPosition({
          lineNumber: Math.min(pos.lineNumber, maxLine),
          column: Math.min(
            pos.column,
            model.getLineMaxColumn(Math.min(pos.lineNumber, maxLine)),
          ),
        });
      }
      applyingExternalRef.current = false;
    } else if (modelValue === text) {
      emittedModelTextRef.current = null;
    }

    spansRef.current = spans;
    applyDecorations(editor, monacoApi, spans, blocksById);
    applyCollapsedZones(editor, monacoApi, spans, collapsedBlockIds);
    editor.layout();
  }, [
    text,
    spans,
    blocksById,
    language,
    monacoApi,
    applyDecorations,
    applyCollapsedZones,
    collapsedBlockIds,
    contentHeight,
  ]);

  useEffect(() => {
    if (!monacoApi) {
      return;
    }
    monacoApi.editor.setTheme(monacoTheme);
  }, [monacoApi, monacoTheme]);

  // Wheel → outer scroll container (scroll-sync with side panes)
  useEffect(() => {
    const el = scrollRef.current;
    const host = hostRef.current;
    if (!el) {
      return;
    }

    const onWheel: EventListener = (event) => {
      const e = event as WheelEvent;
      if (el.scrollHeight <= el.clientHeight + 1) {
        return;
      }
      el.scrollTop += e.deltaY;
      e.preventDefault();
      e.stopPropagation();
      onScroll?.();
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    host?.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      host?.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [monacoApi, onScroll, contentHeight]);

  const activeSpan = activeBlockId
    ? spans.find((s) => s.blockId === activeBlockId)
    : null;
  const showRevert =
    !!onRevertBlock &&
    !!activeSpan &&
    activeSpan.navigable &&
    activeSpan.resolved &&
    activeSpan.kind !== "unchanged" &&
    !collapsedBlockIds?.has(activeSpan.blockId);

  const revertTop =
    showRevert && activeSpan && activeSpan.startLine > 0
      ? (activeSpan.startLine - 1) * CENTER_LINE_HEIGHT + 2
      : 0;

  if (!monacoApi) {
    return (
      <div
        ref={setScrollEl}
        className={cn(
          editorPaneClass("center"),
          "flex-1 min-h-0 min-w-0 h-full flex items-center justify-center text-vscode-description text-xs",
        )}
        onScroll={onScroll}
        data-testid="pane-center"
        data-monaco-ready="false"
        aria-busy={monacoError ? "false" : "true"}
      >
        {monacoError ? (
          <span data-testid="monaco-center-error">{monacoError}</span>
        ) : (
          <span data-testid="monaco-center-loading">Loading editor…</span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setScrollEl}
      className={cn(
        editorPaneClass("center"),
        "flex-1 min-h-0 min-w-0 h-full relative",
      )}
      onScroll={onScroll}
      data-testid="pane-center"
      data-monaco-ready="true"
    >
      <div
        className="nx-monaco-result relative w-full"
        style={{ height: contentHeight, minHeight: "100%" }}
        data-testid="monaco-result-root"
      >
        <div
          ref={hostRef}
          className="nx-monaco-host w-full"
          style={{ height: contentHeight, minHeight: "100%" }}
        />

        {/* Block anchors: scroll-into-view, context menu, e2e */}
        {spans.map((span) => {
          const top =
            span.lineCount > 0
              ? (span.startLine - 1) * CENTER_LINE_HEIGHT
              : 0;
          const height =
            span.lineCount > 0
              ? span.lineCount * CENTER_LINE_HEIGHT
              : CENTER_LINE_HEIGHT;
          return (
            <div
              key={span.blockId}
              className="nx-block nx-monaco-block-wrap absolute left-0 w-full pointer-events-none"
              data-block={span.blockId}
              data-type={span.changeType}
              style={{ top, height }}
              ref={(el) => rowRef?.(span.blockId, el)}
            />
          );
        })}

        {showRevert && activeSpan ? (
          <div
            className="nx-monaco-revert pointer-events-auto"
            style={{ top: revertTop }}
          >
            <button
              type="button"
              className={actBtnClass}
              title="Revert"
              aria-label="revert-center"
              onClick={(e) => {
                e.stopPropagation();
                onRevertBlock?.(activeSpan.blockId);
              }}
            >
              Revert
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
