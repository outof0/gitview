import { create } from "zustand";
import type { FileDiffView } from "@gitview/types";

type DiffPreviewStore = {
  open: boolean;
  title: string;
  relativePath: string;
  diff: FileDiffView | null;
  openDiffPreview: (opts: {
    title: string;
    relativePath: string;
    diff: FileDiffView;
  }) => void;
  closeDiffPreview: () => void;
};

export const useDiffPreviewStore = create<DiffPreviewStore>((set) => ({
  open: false,
  title: "",
  relativePath: "",
  diff: null,
  openDiffPreview: ({ title, relativePath, diff }) =>
    set({ open: true, title, relativePath, diff }),
  closeDiffPreview: () =>
    set({ open: false, title: "", relativePath: "", diff: null }),
}));