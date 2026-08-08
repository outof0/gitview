import type { EditorPaneSide } from "./EditorPaneHelpers";
import { cn } from "../../lib/cn";

const editorScroll =
  "font-editor text-[12.5px] leading-5 overflow-auto relative [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:var(--vscode-scrollbarSlider-background,rgba(121,121,121,0.4))_transparent] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-[5px] [&::-webkit-scrollbar-thumb]:bg-[var(--vscode-scrollbarSlider-background,rgba(121,121,121,0.4))] [&::-webkit-scrollbar-thumb:hover]:bg-[var(--vscode-scrollbarSlider-hoverBackground,rgba(121,121,121,0.6))] [&::-webkit-scrollbar-corner]:bg-transparent";

const gutterLine =
  "before:content-[''] before:absolute before:top-0 before:bottom-0 before:w-px before:bg-vscode-panel-border before:pointer-events-none before:z-[2]";

export function editorPaneClass(
  side: EditorPaneSide,
  showDetails?: boolean,
): string {
  if (side === "left") {
    return cn(
      "nx-editor",
      editorScroll,
      "after:content-[''] after:absolute after:top-0 after:bottom-0 after:w-px after:bg-vscode-panel-border after:pointer-events-none after:z-[2]",
      showDetails ? "after:right-[184px]" : "after:right-[84px]",
    );
  }
  if (side === "center") {
    return cn(
      "nx-editor nx-editor-center nx-monaco-center bg-vscode-editor-bg",
      editorScroll,
      gutterLine,
      showDetails ? "before:left-[130px]" : "before:left-[30px]",
    );
  }
  return cn(
    "nx-editor",
    editorScroll,
    gutterLine,
    showDetails ? "before:left-[184px]" : "before:left-[84px]",
  );
}

export function editorRowClass(
  side: EditorPaneSide,
  showDetails?: boolean,
): string {
  if (side === "left") {
    return cn(
      "nx-row grid items-center min-h-5 leading-5 whitespace-pre relative",
      showDetails
        ? "grid-cols-[minmax(0,1fr)_54px_30px_100px]"
        : "grid-cols-[minmax(0,1fr)_54px_30px_auto]",
    );
  }
  if (side === "right") {
    return cn(
      "nx-row grid items-center min-h-5 leading-5 whitespace-pre relative",
      showDetails
        ? "grid-cols-[100px_30px_54px_minmax(0,1fr)]"
        : "grid-cols-[30px_54px_minmax(0,1fr)]",
    );
  }
  return "nx-row flex items-center min-h-5 leading-5 whitespace-pre relative";
}

export const editorLnClass =
  "nx-ln w-[30px] text-right pr-1.5 text-vscode-line-number select-none flex justify-end items-center opacity-70";

export const editorTxtClass =
  "nx-txt py-0 px-2 min-w-0 overflow-hidden whitespace-pre [&[contenteditable=true]]:outline-none [&[contenteditable=true]]:cursor-text [&[contenteditable=true]]:whitespace-pre-wrap";

export const editorActClass =
  "nx-act w-[54px] flex items-center justify-center gap-1.5 select-none relative";

export const editorBlameClass =
  "nx-blame shrink-0 w-[100px] py-0 px-1.5 text-[10.5px] flex items-center overflow-hidden text-ellipsis whitespace-nowrap select-none text-vscode-description bg-[var(--vscode-editorGutter-background,rgba(43,45,48,0.6))] border-l border-vscode-panel-border";

export const editorStripeClass =
  "nx-stripe absolute left-0 top-0 bottom-0 w-0.5";

export const actBtnClass =
  "nx-act-btn w-[22px] h-[22px] rounded flex items-center justify-center cursor-pointer opacity-[0.82] text-[var(--vscode-icon-foreground,currentColor)] bg-transparent border-0 p-0 transition-[background-color,opacity] hover:opacity-100 hover:bg-toolbar-hover [&_svg]:block [&_svg]:shrink-0";