import { describe, it, expect } from "vitest";
import { createFileService } from "../fileService";

describe("FileService", () => {
  describe("readFile", () => {
    it("detects LF line endings", async () => {
      const buf = Buffer.from("line1\nline2\nline3\n");
      const { readFile } = createFileService({
        readFileImpl: () => Promise.resolve(buf),
      });
      const result = await readFile("/fake/file.ts");
      expect(result.eol).toBe("lf");
      expect(result.hasFinalNewline).toBe(true);
      expect(result.encoding).toBe("utf8");
    });

    it("detects CRLF line endings", async () => {
      const buf = Buffer.from("line1\r\nline2\r\nline3\r\n");
      const { readFile } = createFileService({
        readFileImpl: () => Promise.resolve(buf),
      });
      const result = await readFile("/fake/file.ts");
      expect(result.eol).toBe("crlf");
      expect(result.hasFinalNewline).toBe(true);
    });

    it("detects no final newline", async () => {
      const buf = Buffer.from("line1\nline2\nline3");
      const { readFile } = createFileService({
        readFileImpl: () => Promise.resolve(buf),
      });
      const result = await readFile("/fake/file.ts");
      expect(result.eol).toBe("lf");
      expect(result.hasFinalNewline).toBe(false);
    });
  });

  describe("writeFile", () => {
    it("writes with LF and final newline", async () => {
      let written: Buffer = Buffer.alloc(0);
      const { writeFile } = createFileService({
        writeFileImpl: (_p, data) => {
          written = data;
          return Promise.resolve();
        },
      });
      await writeFile("/fake/out.ts", "a\nb\nc", {
        eol: "lf",
        hasFinalNewline: true,
      });
      expect(written.toString()).toBe("a\nb\nc\n");
    });

    it("writes with CRLF", async () => {
      let written: Buffer = Buffer.alloc(0);
      const { writeFile } = createFileService({
        writeFileImpl: (_p, data) => {
          written = data;
          return Promise.resolve();
        },
      });
      await writeFile("/fake/out.ts", "a\nb\nc", {
        eol: "crlf",
        hasFinalNewline: true,
      });
      expect(written.toString()).toBe("a\r\nb\r\nc\r\n");
    });

    it("writes without final newline", async () => {
      let written: Buffer = Buffer.alloc(0);
      const { writeFile } = createFileService({
        writeFileImpl: (_p, data) => {
          written = data;
          return Promise.resolve();
        },
      });
      await writeFile("/fake/out.ts", "a\nb\n", {
        eol: "lf",
        hasFinalNewline: false,
      });
      expect(written.toString()).toBe("a\nb");
    });

  });
});
