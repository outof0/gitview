import { useEffect } from "react";

/**
 * VS Code webviews show a default Copy/Paste menu unless contextmenu default
 * is prevented at the document level. Per-element React handlers are not enough.
 */
export function useWebviewContextMenuGuard() {
  useEffect(() => {
    const guard = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", guard);
    return () => document.removeEventListener("contextmenu", guard);
  }, []);
}
