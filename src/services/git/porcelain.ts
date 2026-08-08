export function parsePorcelainStatus(output: string): Array<{
  xy: string;
  path: string;
}> {
  const records: Array<{ xy: string; path: string }> = [];
  const parts = output.split("\0");
  for (const part of parts) {
    if (part.length < 2) {
      continue;
    }
    const xy = part.substring(0, 2);
    const rest = part.substring(2);
    const spaceIdx = rest.search(/[\t ]/);
    if (spaceIdx !== -1) {
      records.push({ xy, path: rest.substring(spaceIdx + 1) });
    } else if (rest.length > 0) {
      records.push({ xy, path: rest });
    }
  }
  return records;
}

export function deriveSpecialKind(
  xy: string,
): "none" | "add_add" | "modify_delete" | "delete_modify" | "binary" {
  switch (xy) {
    case "AA":
      return "add_add";
    case "UD":
      return "modify_delete";
    case "DU":
      return "delete_modify";
    default:
      return "none";
  }
}

export function isUnmergedCode(xy: string): boolean {
  return ["UU", "AA", "UD", "DU", "DD", "AU", "UA"].includes(xy);
}