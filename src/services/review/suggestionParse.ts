const SUGGESTION_BLOCK = /```suggestion\r?\n([\s\S]*?)```/;

export function parseSuggestionFromBody(body: string): string | null {
  const match = body.match(SUGGESTION_BLOCK);
  if (!match?.[1]) {
    return null;
  }
  const text = match[1];
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

export function hasSuggestionBlock(body: string): boolean {
  return SUGGESTION_BLOCK.test(body);
}