import { diffLines } from "../../../../src/core/lcs";
import { normalizeLineForCompare } from "../merge/whitespace";
import type { WhitespacePolicy } from "../../stores/gitViewStore";

export type DiffLineHighlight = "none" | "removed" | "added" | "changed";

export type BuildDiffDisplayRowsOptions = {
  whitespacePolicy?: WhitespacePolicy;
};

export type DiffDisplayRow = {
  leftNum: number | null;
  rightNum: number | null;
  leftText: string;
  rightText: string;
  leftHighlight: DiffLineHighlight;
  rightHighlight: DiffLineHighlight;
};

export function buildDiffDisplayRows(
  left: string,
  right: string,
  options?: BuildDiffDisplayRowsOptions,
): DiffDisplayRow[] {
  const policy = options?.whitespacePolicy ?? "doNotIgnore";
  const a = left.split("\n");
  const b = right.split("\n");
  const aCompare =
    policy === "doNotIgnore"
      ? a
      : a.map((line) => normalizeLineForCompare(line, policy));
  const bCompare =
    policy === "doNotIgnore"
      ? b
      : b.map((line) => normalizeLineForCompare(line, policy));
  const ops = diffLines(aCompare, bCompare);
  const rows: DiffDisplayRow[] = [];
  let leftNum = 1;
  let rightNum = 1;

  for (const op of ops) {
    switch (op.type) {
      case "equal":
        for (let i = op.aStart; i < op.aEnd; i++) {
          const j = op.bStart + (i - op.aStart);
          rows.push({
            leftNum: leftNum++,
            rightNum: rightNum++,
            leftText: a[i] ?? "",
            rightText: b[j] ?? "",
            leftHighlight: "none",
            rightHighlight: "none",
          });
        }
        break;
      case "delete":
        for (let i = op.aStart; i < op.aEnd; i++) {
          rows.push({
            leftNum: leftNum++,
            rightNum: null,
            leftText: a[i] ?? "",
            rightText: "",
            leftHighlight: "removed",
            rightHighlight: "none",
          });
        }
        break;
      case "insert":
        for (let j = op.bStart; j < op.bEnd; j++) {
          rows.push({
            leftNum: null,
            rightNum: rightNum++,
            leftText: "",
            rightText: b[j] ?? "",
            leftHighlight: "none",
            rightHighlight: "added",
          });
        }
        break;
      case "replace": {
        const aLen = op.aEnd - op.aStart;
        const bLen = op.bEnd - op.bStart;
        const max = Math.max(aLen, bLen);
        for (let k = 0; k < max; k++) {
          const hasLeft = k < aLen;
          const hasRight = k < bLen;
          rows.push({
            leftNum: hasLeft ? leftNum++ : null,
            rightNum: hasRight ? rightNum++ : null,
            leftText: hasLeft ? (a[op.aStart + k] ?? "") : "",
            rightText: hasRight ? (b[op.bStart + k] ?? "") : "",
            leftHighlight: hasLeft ? "changed" : "none",
            rightHighlight: hasRight ? "changed" : "none",
          });
        }
        break;
      }
    }
  }

  return rows;
}
