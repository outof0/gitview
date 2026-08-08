export type GitlabMergeRequest = {
  id: number;
  iid: number;
  title: string;
  state: "opened" | "closed" | "merged" | "locked";
  draft?: boolean;
  work_in_progress?: boolean;
  merged_at?: string | null;
  author?: { username?: string } | null;
  created_at: string;
  updated_at: string;
  source_branch?: string;
  target_branch?: string;
  web_url?: string;
  merge_status?: string;
  detailed_merge_status?: string;
  source_project_id?: number;
  target_project_id?: number;
  has_conflicts?: boolean;
  labels?: string[];
  assignees?: Array<{ username?: string }> | null;
  milestone?: { title?: string } | null;
  diff_refs?: {
    base_sha?: string;
    start_sha?: string;
    head_sha?: string;
  } | null;
};

export type GitlabMergeRequestChange = {
  old_path: string;
  new_path: string;
  new_file?: boolean;
  renamed_file?: boolean;
  deleted_file?: boolean;
  diff?: string;
};

export type GitlabMergeRequestChanges = {
  changes: GitlabMergeRequestChange[];
};

export type GitlabCommit = {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name?: string;
  created_at: string;
};

export type GitlabNote = {
  id: number;
  author?: { username?: string } | null;
  body?: string;
  created_at: string;
  system?: boolean;
  type?: string | null;
};

export type GitlabDiscussion = {
  id: string;
  notes: Array<
    GitlabNote & {
      position?: {
        new_path?: string;
        new_line?: number | null;
        old_line?: number | null;
      } | null;
    }
  >;
};
