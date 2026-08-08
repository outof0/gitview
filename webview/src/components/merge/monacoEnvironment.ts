// Wire Monaco editor worker for Vite. Must run before the editor API loads.
// Syntax colors use Monarch tokenizers on the main thread; a no-op worker is
// enough for bracket/comment helpers and avoids ?worker URL issues in webviews.
let configured = false;

function createNoopWorker(): Worker {
  const source = "self.onmessage=function(){}";
  return new Worker(
    URL.createObjectURL(new Blob([source], { type: "application/javascript" })),
  );
}

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
      return createNoopWorker();
    },
  };
}