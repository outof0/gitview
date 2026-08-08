import { Fragment } from "react";
import { tokenizeLine, syntaxClass } from "./syntax";
import type { CharRange } from "./wordDiff";

function overlapsRange(
  start: number,
  end: number,
  ranges: CharRange[],
): boolean {
  return ranges.some((r) => r.start < end && r.end > start);
}

function renderToken(
  text: string,
  start: number,
  end: number,
  type: ReturnType<typeof tokenizeLine>[number]["type"],
  wordRanges: CharRange[] | undefined,
  key: string,
) {
  const syntax = syntaxClass(type);
  const hasWord = wordRanges?.length && overlapsRange(start, end, wordRanges);

  if (!hasWord) {
    return syntax ? (
      <span key={key} className={syntax}>
        {text}
      </span>
    ) : (
      <span key={key}>{text}</span>
    );
  }

  const parts: Array<{
    text: string;
    start: number;
    end: number;
    word: boolean;
  }> = [];
  let pos = start;
  const sorted = [...wordRanges!].sort((a, b) => a.start - b.start);
  for (const range of sorted) {
    if (range.end <= start || range.start >= end) {
      continue;
    }
    const rs = Math.max(range.start, start);
    const re = Math.min(range.end, end);
    if (rs > pos) {
      parts.push({
        text: text.slice(pos - start, rs - start),
        start: pos,
        end: rs,
        word: false,
      });
    }
    parts.push({
      text: text.slice(rs - start, re - start),
      start: rs,
      end: re,
      word: true,
    });
    pos = re;
  }
  if (pos < end) {
    parts.push({ text: text.slice(pos - start), start: pos, end, word: false });
  }

  return (
    <>
      {parts.map((part, i) => {
        const cls = [syntax, part.word ? "nx-word" : ""]
          .filter(Boolean)
          .join(" ");
        return cls ? (
          <span key={`${key}-${i}`} className={cls}>
            {part.text}
          </span>
        ) : (
          <span key={`${key}-${i}`}>{part.text}</span>
        );
      })}
    </>
  );
}

// Render a line of code with lightweight syntax + optional word-level diff.
export function HighlightedText({
  text,
  wordRanges,
}: {
  text: string;
  wordRanges?: CharRange[];
}) {
  if (text === "") {
    return null;
  }
  return (
    <>
      {tokenizeLine(text).map((tok, i) => (
        <Fragment key={`tok-${i}`}>
          {renderToken(
            tok.value,
            tok.start,
            tok.end,
            tok.type,
            wordRanges,
            `t${i}`,
          )}
        </Fragment>
      ))}
    </>
  );
}