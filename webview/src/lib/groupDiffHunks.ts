import type { DiffDisplayRow } from "../components/git/buildDiffDisplayRows";

export type DiffHunkGroup = {
  id: number;
  startRow: number;
  endRow: number;
};

function rowHasChange(row: DiffDisplayRow): boolean {
  return row.leftHighlight !== "none" || row.rightHighlight !== "none";
}

export function groupDiffHunks(rows: DiffDisplayRow[]): DiffHunkGroup[] {
  const hunks: DiffHunkGroup[] = [];
  let current: DiffHunkGroup | null = null;

  for (let i = 0; i < rows.length; i++) {
    if (rowHasChange(rows[i]!)) {
      if (!current) {
        current = { id: hunks.length, startRow: i, endRow: i };
      } else {
        current.endRow = i;
      }
    } else if (current) {
      hunks.push(current);
      current = null;
    }
  }

  if (current) {
    hunks.push(current);
  }

  return hunks;
}