import { fileTypeGlyph } from "../../ui/FileTypeGlyph";
import { FileIcon } from "./ConflictsDialogIcons";

export function getDirectory(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "./";
}

export function getFilename(path: string) {
  const parts = path.split("/");
  // `!`: String.split always yields at least one element.
  return parts[parts.length - 1]!;
}

export function getFileIcon(fileName: string) {
  const glyph = fileTypeGlyph(fileName);
  if (glyph) {
    return (
      <span
        className={`inline-flex items-center justify-center w-4 h-4 mr-2 text-file-glyph font-bold ${glyph.bg} ${glyph.ink} rounded-vscode flex-shrink-0`}
      >
        {glyph.label}
      </span>
    );
  }
  return (
    <FileIcon className="w-4 h-4 mr-2 text-foreground/60 flex-shrink-0" />
  );
}
