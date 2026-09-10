import EditorWorker from "monaco-editor/editor/editor.worker?worker";

// Wire Monaco editor worker for Vite. Must run before the editor API loads.
let configured = false;

export function configureMonacoEnvironment(): void {
  if (configured) {
    return;
  }
  configured = true;

  const global = window as unknown as {
    MonacoEnvironment?: {
      getWorker: (workerId: string, label: string) => Worker;
    };
  };

  global.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker();
    },
  };
}
