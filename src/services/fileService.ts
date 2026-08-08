import * as fs from "fs/promises";
import { detectEol, hasFinalNewline } from "../core/lines";

export type FileServiceDeps = {
  readFileImpl?: (absolutePath: string) => Promise<Buffer>;
  writeFileImpl?: (absolutePath: string, data: Buffer) => Promise<void>;
};

export type FileReadResult = {
  content: string;
  eol: "lf" | "crlf";
  hasFinalNewline: boolean;
  encoding: "utf8";
};

export type FileWriteOptions = {
  eol: "lf" | "crlf";
  hasFinalNewline: boolean;
};

export interface FileService {
  readFile(absolutePath: string): Promise<FileReadResult>;
  writeFile(
    absolutePath: string,
    content: string,
    opts: FileWriteOptions,
  ): Promise<void>;
}

export function createFileService(deps?: FileServiceDeps): FileService {
  const readFileImpl = deps?.readFileImpl ?? ((p: string) => fs.readFile(p));
  const writeFileImpl =
    deps?.writeFileImpl ?? ((p: string, data: Buffer) => fs.writeFile(p, data));

  async function readFile(absolutePath: string) {
    const buffer = await readFileImpl(absolutePath);
    const content = buffer.toString("utf8");
    const eol = detectEol(content);
    const finalNl = hasFinalNewline(content);
    return {
      content,
      eol,
      hasFinalNewline: finalNl,
      encoding: "utf8" as const,
    };
  }

  async function writeFile(
    absolutePath: string,
    content: string,
    opts: FileWriteOptions,
  ): Promise<void> {
    let output = content;
    // Ensure consistent EOL
    const eolStr = opts.eol === "crlf" ? "\r\n" : "\n";
    if (opts.eol === "crlf") {
      output = output.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    } else {
      output = output.replace(/\r\n/g, "\n");
    }
    // Ensure final newline
    if (opts.hasFinalNewline && !output.endsWith(eolStr)) {
      output += eolStr;
    } else if (!opts.hasFinalNewline && output.endsWith(eolStr)) {
      output = output.slice(0, -eolStr.length);
    }

    await writeFileImpl(absolutePath, Buffer.from(output, "utf8"));
  }

  return { readFile, writeFile };
}
