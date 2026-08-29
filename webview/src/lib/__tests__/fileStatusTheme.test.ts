import { describe, expect, it } from "vitest";
import {
  fileStatusPrefix,
  fileStatusTokenClass,
  splitWorkspacePath,
  visualStatusFromChangedLetter,
  visualStatusFromFileKind,
} from "../fileStatusTheme";

describe("fileStatusTheme", () => {
  it("maps workspace kinds onto design-system prefixes and token classes", () => {
    expect(fileStatusPrefix(visualStatusFromFileKind("added"))).toBe("A");
    expect(fileStatusPrefix(visualStatusFromFileKind("modified"))).toBe("M");
    expect(fileStatusPrefix(visualStatusFromFileKind("deleted"))).toBe("D");
    expect(fileStatusPrefix(visualStatusFromFileKind("unversioned"))).toBe("?");
    expect(fileStatusPrefix(visualStatusFromFileKind("conflicted"))).toBe("!");
    expect(fileStatusTokenClass(visualStatusFromFileKind("added"))).toBe(
      "nx-file-status-added",
    );
    expect(fileStatusTokenClass(visualStatusFromFileKind("modified"))).toBe(
      "nx-file-status-modified",
    );
    expect(fileStatusTokenClass(visualStatusFromFileKind("unversioned"))).toBe(
      "nx-file-status-untracked",
    );
    expect(fileStatusTokenClass(visualStatusFromFileKind("conflicted"))).toBe(
      "nx-file-status-conflict",
    );
  });

  it("maps history change letters onto the same token classes", () => {
    expect(fileStatusTokenClass(visualStatusFromChangedLetter("A"))).toBe(
      "nx-file-status-added",
    );
    expect(fileStatusTokenClass(visualStatusFromChangedLetter("M"))).toBe(
      "nx-file-status-modified",
    );
    expect(fileStatusTokenClass(visualStatusFromChangedLetter("D"))).toBe(
      "nx-file-status-deleted",
    );
  });

  it("splits a workspace path into file name and directory", () => {
    expect(splitWorkspacePath("src/services/repositoryService.ts")).toEqual({
      name: "repositoryService.ts",
      dir: "src/services",
    });
    expect(splitWorkspacePath("README.md")).toEqual({
      name: "README.md",
      dir: "",
    });
  });
});
