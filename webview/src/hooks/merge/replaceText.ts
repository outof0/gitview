export function replaceFirst(
  text: string,
  query: string,
  replacement: string,
): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) {
    return text;
  }
  return text.slice(0, idx) + replacement + text.slice(idx + query.length);
}

export function replaceAllIn(
  text: string,
  query: string,
  replacement: string,
): string {
  if (!query) {
    return text;
  }
  let out = "";
  let rest = text;
  const lowerQ = query.toLowerCase();
  let idx = rest.toLowerCase().indexOf(lowerQ);
  while (idx >= 0) {
    out += rest.slice(0, idx) + replacement;
    rest = rest.slice(idx + query.length);
    idx = rest.toLowerCase().indexOf(lowerQ);
  }
  return out + rest;
}