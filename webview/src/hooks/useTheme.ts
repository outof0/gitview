import { useEffect, useState } from "react";

export type ThemeKind =
  | "light"
  | "dark"
  | "high-contrast"
  | "high-contrast-light";

function detectTheme(): ThemeKind {
  const body = document.body;
  if (body.classList.contains("vscode-high-contrast-light")) {
    return "high-contrast-light";
  }
  if (body.classList.contains("vscode-high-contrast")) {
    return "high-contrast";
  }
  if (body.classList.contains("vscode-light")) {
    return "light";
  }
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeKind>(detectTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(detectTheme());
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
