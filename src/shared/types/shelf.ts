export type ShelfEntry = {
  id: string;
  repoId: string;
  name: string;
  createdAt: number;
  paths: string[];
  changelistId?: string | null;
};

export type ShelfListSnapshot = {
  repoId: string;
  shelves: ShelfEntry[];
  refreshedAt: number;
};