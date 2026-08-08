import type { ReviewFetch } from "./reviewFetch";

export type GithubFetch = ReviewFetch;

export type GithubPullRequest = {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  draft?: boolean;
  merged_at?: string | null;
  user?: { login?: string } | null;
  created_at: string;
  updated_at: string;
  head?: {
    ref?: string;
    sha?: string;
    repo?: { full_name?: string } | null;
  } | null;
  base?: {
    ref?: string;
    repo?: { full_name?: string } | null;
  } | null;
  html_url?: string;
  mergeable_state?: string;
  merged?: boolean;
};

export type GithubPullFile = {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
};

export type GithubIssueComment = {
  id: number;
  user?: { login?: string } | null;
  body?: string;
  created_at: string;
};

export type GithubIssue = {
  number: number;
  labels?: Array<{ name?: string }> | null;
  assignees?: Array<{ login?: string }> | null;
  milestone?: { title?: string } | null;
};

export type GithubReview = {
  id: number;
  user?: { login?: string } | null;
  body?: string | null;
  state: string;
  submitted_at?: string;
};

export type GithubPullReviewComment = {
  id: number;
  user?: { login?: string } | null;
  body?: string;
  path: string;
  line?: number | null;
  original_line?: number | null;
  start_line?: number | null;
  created_at: string;
};

export type GithubPullCommit = {
  sha: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string } | null;
  };
};
