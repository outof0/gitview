import { create } from "zustand";
import type { BlameLine, BlameSide } from "@gitview/types";

type SideBlameState = {
  relativePath: string | null;
  loading: boolean;
  error: string | null;
  lines: BlameLine[] | null;
  truncated?: boolean;
};

const emptySide = (): SideBlameState => ({
  relativePath: null,
  loading: false,
  error: null,
  lines: null,
});

type BlameStore = {
  ours: SideBlameState;
  theirs: SideBlameState;
  reset: () => void;
  setLoading: (side: BlameSide, relativePath: string) => void;
  setResult: (payload: {
    relativePath: string;
    side: BlameSide;
    lines?: BlameLine[];
    truncated?: boolean;
    error?: { message: string };
  }) => void;
};

export const useBlameStore = create<BlameStore>((set, get) => ({
  ours: emptySide(),
  theirs: emptySide(),

  reset: () => set({ ours: emptySide(), theirs: emptySide() }),

  setLoading: (side, relativePath) => {
    const key = side === "ours" ? "ours" : "theirs";
    set({
      [key]: {
        relativePath,
        loading: true,
        error: null,
        lines: null,
      },
    } as Pick<BlameStore, typeof key>);
  },

  setResult: (payload) => {
    const key = payload.side === "ours" ? "ours" : "theirs";
    const current = get()[key];
    if (current.relativePath !== payload.relativePath) {
      return;
    }

    if (payload.error) {
      set({
        [key]: {
          ...current,
          loading: false,
          error: payload.error.message,
          lines: null,
        },
      } as Pick<BlameStore, typeof key>);
      return;
    }

    set({
      [key]: {
        ...current,
        loading: false,
        error: null,
        lines: payload.lines ?? [],
        truncated: payload.truncated,
      },
    } as Pick<BlameStore, typeof key>);
  },
}));
