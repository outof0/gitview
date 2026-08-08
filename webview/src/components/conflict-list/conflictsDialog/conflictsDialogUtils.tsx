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
  if (fileName.endsWith(".tsx") || fileName.endsWith(".ts")) {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 mr-2 text-[8px] font-bold bg-[#4f7df3] text-white rounded-[2px] flex-shrink-0">
        TS
      </span>
    );
  }
  if (fileName.endsWith(".js")) {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 mr-2 text-[8px] font-bold bg-[#f4c84f] text-black rounded-[2px] flex-shrink-0">
        JS
      </span>
    );
  }
  if (fileName.endsWith(".json")) {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 mr-2 text-[8px] font-bold bg-[#83cd29]/90 text-white rounded-[2px] flex-shrink-0">
        JSON
      </span>
    );
  }
  return (
    <FileIcon className="w-4 h-4 mr-2 text-foreground/60 flex-shrink-0" />
  );
}