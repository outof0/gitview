import { describe, expect, it } from "vitest";
import { filterReviewItems, type ReviewItem } from "../review";

const items: ReviewItem[] = [
  {
    id: "1",
    number: 1,
    title: "Fix login",
    state: "open",
    author: "alice",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    sourceBranch: "feature/login",
    targetBranch: "main",
    labels: ["bug", "priority"],
    assignees: ["alice", "carol"],
    milestone: "v1.0",
  },
  {
    id: "2",
    number: 2,
    title: "Docs",
    state: "closed",
    author: "bob",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    sourceBranch: "docs",
    targetBranch: "main",
    labels: ["documentation"],
    assignees: ["bob"],
    milestone: "docs",
  },
];

describe("filterReviewItems", () => {
  it("filters by author substring", () => {
    const filtered = filterReviewItems(items, { author: "ali" });
    expect(filtered.map((item) => item.id)).toEqual(["1"]);
  });

  it("filters by label substring", () => {
    const filtered = filterReviewItems(items, { label: "doc" });
    expect(filtered.map((item) => item.id)).toEqual(["2"]);
  });

  it("matches labels in search query", () => {
    const filtered = filterReviewItems(items, { search: "priority" });
    expect(filtered.map((item) => item.id)).toEqual(["1"]);
  });

  it("filters by assignee substring", () => {
    const filtered = filterReviewItems(items, { assignee: "car" });
    expect(filtered.map((item) => item.id)).toEqual(["1"]);
  });

  it("filters by milestone substring", () => {
    const filtered = filterReviewItems(items, { milestone: "v1" });
    expect(filtered.map((item) => item.id)).toEqual(["1"]);
  });
});