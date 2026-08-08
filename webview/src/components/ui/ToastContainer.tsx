import { useGitViewStore } from "../../stores/gitViewStore";

/** Blocking errors only — success/warnings use the bottom status line. */
export function ToastContainer() {
  const toasts = useGitViewStore((s) => s.toasts);
  const removeToast = useGitViewStore((s) => s.removeToast);

  const alerts = toasts.filter((t) => t.type === "error");
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div
      id="toastContainer"
      className="fixed bottom-14 right-4 flex flex-col gap-2 z-[10000] max-w-sm pointer-events-none"
    >
      {alerts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className="pointer-events-auto cursor-pointer rounded-vscode border px-3 py-2 text-xs shadow-lg font-sans"
          style={{
            background:
              "var(--vscode-inputValidation-errorBackground, rgba(89, 29, 29, 0.4))",
            borderColor:
              toast.type === "warning"
                ? "var(--vscode-inputValidation-warningBorder, #e0ad53)"
                : "var(--vscode-inputValidation-errorBorder, #cf5c56)",
            color: "var(--vscode-foreground)",
          }}
          role="alert"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
