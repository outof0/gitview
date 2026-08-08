export type TagEntry = {
  repoId: string;
  name: string;
  sha: string;
  annotated: boolean;
  message?: string;
  tagger?: string;
  taggerTime?: number;
};

export type TagListSnapshot = {
  repoId: string;
  tags: TagEntry[];
  refreshedAt: number;
};