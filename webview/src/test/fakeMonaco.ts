type FakeModel = {
  uri: { toString(): string };
  value: string;
  language: string;
  listeners: Array<(e: { isFlush: boolean }) => void>;
  render?: () => void;
  getValue: () => string;
  setValue: (next: string, opts?: { isFlush?: boolean }) => void;
  getLanguageId: () => string;
  getLineCount: () => number;
  getLineContent: (line: number) => string;
  getLineMaxColumn: (line: number) => number;
  onDidChangeContent: (
    listener: (e: { isFlush: boolean }) => void,
  ) => { dispose: () => void };
  dispose: () => void;
};

function makeModel(
  value: string,
  language: string,
  uri: { toString(): string },
): FakeModel {
  const listeners: Array<(e: { isFlush: boolean }) => void> = [];
  const model: FakeModel = {
    uri,
    value,
    language,
    listeners,
    getValue: () => model.value,
    setValue: (next: string, opts?: { isFlush?: boolean }) => {
      model.value = next;
      model.render?.();
      const isFlush = opts?.isFlush ?? true;
      for (const listener of listeners) {
        listener({ isFlush });
      }
    },
    getLanguageId: () => model.language,
    getLineCount: () => Math.max(1, model.value.split("\n").length),
    getLineContent: (line: number) => model.value.split("\n")[line - 1] ?? "",
    getLineMaxColumn: (line: number) =>
      (model.value.split("\n")[line - 1] ?? "").length + 1,
    onDidChangeContent: (listener) => {
      listeners.push(listener);
      return { dispose: () => {} };
    },
    dispose: () => {},
  };
  return model;
}

function renderModel(el: HTMLElement, model: FakeModel) {
  el.className = "monaco-editor";
  el.innerHTML = "";
  const lines = model.value === "" ? [""] : model.value.split("\n");
  for (const line of lines) {
    const viewLine = document.createElement("div");
    viewLine.className = "view-line";
    viewLine.textContent = line;
    el.appendChild(viewLine);
  }
}

export function createFakeMonaco() {
  const models = new Map<string, FakeModel>();

  return {
    Uri: {
      parse: (uri: string) => ({ toString: () => uri }),
    },
    Range: class {
      constructor(
        public startLineNumber: number,
        public startColumn: number,
        public endLineNumber: number,
        public endColumn: number,
      ) {}
    },
    editor: {
      setTheme: () => {},
      defineTheme: () => {},
      setModelLanguage: (model: FakeModel, language: string) => {
        model.language = language;
      },
      getModel: (uri: { toString(): string }) =>
        models.get(uri.toString()) ?? null,
      createModel: (
        value: string,
        language: string,
        uri: { toString(): string },
      ) => {
        const model = makeModel(value, language, uri);
        models.set(uri.toString(), model);
        return model;
      },
      create: (
        el: HTMLElement,
        opts: { model: FakeModel; readOnly?: boolean },
      ) => {
        const model = opts.model;
        model.render = () => renderModel(el, model);
        model.render();
        if (!opts.readOnly) {
          model.onDidChangeContent((e) => {
            if (!e.isFlush) {
              model.render?.();
            }
          });
        }
        let scrollTop = 0;
        const scrollListeners: Array<
          (e: { scrollTop: number; scrollTopChanged: boolean }) => void
        > = [];

        return {
          getModel: () => model,
          layout: () => {},
          dispose: () => {},
          onMouseDown: () => ({ dispose: () => {} }),
          addCommand: () => null,
          revealLineInCenter: (line: number) => {
            scrollTop = Math.max(0, (line - 1) * 20);
          },
          setPosition: () => {},
          getPosition: () => ({ lineNumber: 1, column: 1 }),
          focus: () => {},
          updateOptions: () => {},
          setHiddenAreas: () => {},
          changeViewZones: (
            cb: (accessor: {
              addZone: (zone: unknown) => string;
              removeZone: (id: string) => void;
            }) => void,
          ) => {
            let n = 0;
            cb({
              addZone: () => `zone-${n++}`,
              removeZone: () => {},
            });
          },
          onDidScrollChange: (
            listener: (e: {
              scrollTop: number;
              scrollTopChanged: boolean;
            }) => void,
          ) => {
            scrollListeners.push(listener);
            return { dispose: () => {} };
          },
          getScrollTop: () => scrollTop,
          setScrollTop: (top: number) => {
            scrollTop = top;
            for (const listener of scrollListeners) {
              listener({ scrollTop, scrollTopChanged: true });
            }
          },
          createDecorationsCollection: () => ({ clear: () => {} }),
        };
      },
      createDiffEditor: (
        el: HTMLElement,
        options?: Record<string, unknown>,
      ) => {
        el.classList.add("monaco-diff-editor");
        el.setAttribute("data-fake-monaco-diff", "true");
        let original: FakeModel | null = null;
        let modified: FakeModel | null = null;
        let diffListeners: Array<() => void> = [];
        const diffOptions: Record<string, unknown> = { ...options };
        const publishOptions = () => {
          el.setAttribute(
            "data-fake-diff-options",
            JSON.stringify(diffOptions),
          );
        };
        publishOptions();
        const computeLineChanges = () => {
          if (!original || !modified) {
            return [];
          }
          const left = original.getValue().split("\n");
          const right = modified.getValue().split("\n");
          const changes: Array<{ originalStartLineNumber: number }> = [];
          const max = Math.max(left.length, right.length);
          let i = 0;
          while (i < max) {
            if (left[i] === right[i]) {
              i += 1;
              continue;
            }
            changes.push({ originalStartLineNumber: i + 1 });
            while (i < max && left[i] !== right[i]) {
              i += 1;
            }
          }
          return changes;
        };
        const render = () => {
          el.innerHTML = "";
          const left = document.createElement("div");
          left.className = "monaco-editor";
          left.setAttribute("data-testid", "git-diff-left-scroll");
          const right = document.createElement("div");
          right.className = "monaco-editor";
          right.setAttribute("data-testid", "git-diff-right-scroll");
          if (original) {
            renderModel(left, original);
          }
          if (modified) {
            renderModel(right, modified);
          }
          el.appendChild(left);
          el.appendChild(right);
          for (const listener of diffListeners) {
            listener();
          }
        };
        const sideOptions: Record<string, unknown> = {};
        const sideEditor = () => ({
          onContextMenu: () => ({ dispose: () => {} }),
          onDidScrollChange: () => ({ dispose: () => {} }),
          onDidLayoutChange: () => ({ dispose: () => {} }),
          updateOptions: (next: Record<string, unknown>) => {
            Object.assign(sideOptions, next);
            el.setAttribute(
              "data-fake-original-options",
              JSON.stringify(sideOptions),
            );
          },
          getScrollTop: () => 0,
          getLayoutInfo: () => ({ width: 400 }),
          getVisibleRanges: () => [
            {
              startLineNumber: 1,
              endLineNumber: Math.max(1, original?.getLineCount() ?? 1),
            },
          ],
          getTopForLineNumber: (line: number) => (line - 1) * 20,
        });
        return {
          setModel: (m: {
            original: FakeModel;
            modified: FakeModel;
          }) => {
            original = m.original;
            modified = m.modified;
            original.render = render;
            modified.render = render;
            render();
          },
          getModel: () =>
            original && modified ? { original, modified } : null,
          getOriginalEditor: sideEditor,
          getModifiedEditor: sideEditor,
          onDidUpdateDiff: (listener: () => void) => {
            diffListeners.push(listener);
            // Real Monaco computes the diff asynchronously, so subscribers that
            // attach right after setModel still get the first result.
            if (original && modified) {
              queueMicrotask(() => {
                if (diffListeners.includes(listener)) {
                  listener();
                }
              });
            }
            return {
              dispose: () => {
                diffListeners = diffListeners.filter((l) => l !== listener);
              },
            };
          },
          getLineChanges: () => computeLineChanges(),
          goToDiff: (target: "next" | "previous") => {
            el.setAttribute("data-fake-goto-diff", target);
          },
          layout: () => {},
          dispose: () => {
            el.innerHTML = "";
          },
          updateOptions: (next: Record<string, unknown>) => {
            Object.assign(diffOptions, next);
            publishOptions();
          },
        };
      },
      colorize: async (text: string) =>
        text
          .split("\n")
          .map((line) => `<span>${line}</span>`)
          .join("<br/>"),
    },
    KeyMod: { CtrlCmd: 2048 },
    KeyCode: { KeyS: 49 },
  };
}