/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        editor: [
          "var(--vscode-editor-font-family, ui-monospace, monospace)",
        ],
        sans: [
          '"Inter Tight"',
          "var(--vscode-font-family, system-ui, sans-serif)",
        ],
      },
      fontSize: {
        editor: "var(--vscode-editor-font-size, 12px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        ring: "var(--ring)",
        vscode: {
          description: "var(--vscode-descriptionForeground, #8b949e)",
          link: "var(--vscode-textLink-foreground, #3794ff)",
          error: "var(--vscode-errorForeground, #f48771)",
          "editor-bg": "var(--vscode-editor-background, var(--background))",
          "editor-fg": "var(--vscode-editor-foreground, var(--foreground))",
          "line-number":
            "var(--vscode-editorLineNumber-foreground, #888)",
          "panel-border": "var(--vscode-panel-border, var(--border))",
          "widget-bg":
            "var(--vscode-editorWidget-background, var(--background))",
          "sidebar-bg":
            "var(--vscode-sideBar-background, var(--background))",
          "titlebar-bg":
            "var(--vscode-titleBar-activeBackground, var(--background))",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          hover: "var(--secondary-hover)",
        },
        input: {
          DEFAULT: "var(--input)",
          foreground: "var(--input-foreground)",
          border: "var(--input-border)",
        },
        list: {
          hover: "var(--list-hover)",
          active: "var(--list-active)",
          activeForeground: "var(--list-active-foreground)",
        },
        menu: {
          bg: "var(--menu-bg)",
          fg: "var(--menu-fg)",
          border: "var(--menu-border)",
          selection: "var(--menu-selection)",
          selectionForeground: "var(--menu-selection-foreground)",
        },
        toolbar: {
          hover: "var(--toolbar-hover)",
        },
      },
      borderRadius: {
        vscode: "2px",
      },
      keyframes: {
        "blame-hover-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "blame-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.65" },
        },
      },
      animation: {
        "blame-hover-fade": "blame-hover-fade 0.08s ease-out",
        "blame-pulse": "blame-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
  // Disable Preflight to avoid conflicts with VS Code webview styles
  corePlugins: {
    preflight: false,
  },
};
