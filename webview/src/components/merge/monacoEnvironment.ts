// Wire Monaco editor worker for Vite. Must run before the editor API loads.
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