import { useMemo } from "react";
import { useGitViewStore } from "../../stores/gitViewStore";
import {
  searchMatchBlockIds,
  type BlockRows,
} from "../../components/merge/rows";
import { replaceAllIn, replaceFirst } from "./replaceText";

type UseMergeSearchOpts = {
  rows: BlockRows[];
  scrollToBlock: (blockId: string) => void;
  editBlock: (blockId: string, text: string) => void;
};

export function useMergeSearch({
  rows,
  scrollToBlock,
  editBlock,
}: UseMergeSearchOpts) {
  const searchOpen = useGitViewStore((s) => s.searchOpen);
  const searchQuery = useGitViewStore((s) => s.searchQuery);
  const searchActiveIndex = useGitViewStore((s) => s.searchActiveIndex);

  const matchIds = useMemo(
    () => (searchOpen ? searchMatchBlockIds(rows, searchQuery) : []),
    [rows, searchOpen, searchQuery],
  );
  const matchedSet = useMemo(() => new Set(matchIds), [matchIds]);

  const gotoMatch = (delta: number) => {
    if (matchIds.length === 0) {
      return;
    }
    const next =
      (searchActiveIndex + delta + matchIds.length) % matchIds.length;
    useGitViewStore.getState().setSearchActiveIndex(next);
    // `!`: `matchIds` is non-empty and `next` is taken modulo its length.
    scrollToBlock(matchIds[next]!);
  };

  const replaceCurrent = (replacement: string) => {
    if (matchIds.length === 0 || !searchQuery) {
      return;
    }
    // `!`: `matchIds` is non-empty and the index is clamped to both its ends —
    // replacing shrinks the match list, so the stored index can outrun it.
    const index = Math.max(0, Math.min(searchActiveIndex, matchIds.length - 1));
    const id = matchIds[index]!;
    const row = rows.find((r) => r.blockId === id);
    if (!row) {
      return;
    }
    const next = replaceFirst(row.centerText, searchQuery, replacement);
    if (next !== row.centerText) {
      editBlock(id, next);
    }
  };

  const replaceAll = (replacement: string) => {
    if (matchIds.length === 0 || !searchQuery) {
      return;
    }
    for (const id of matchIds) {
      const row = rows.find((r) => r.blockId === id);
      if (!row) {
        continue;
      }
      const next = replaceAllIn(row.centerText, searchQuery, replacement);
      if (next !== row.centerText) {
        editBlock(id, next);
      }
    }
  };

  return {
    searchOpen,
    searchQuery,
    searchActiveIndex,
    matchIds,
    matchedSet,
    gotoMatch,
    replaceCurrent,
    replaceAll,
  };
}