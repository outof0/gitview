import { describe, expect, it } from "vitest";
import {
  buildRemoteLink,
  detectRemoteHostKind,
  encodeRepoPath,
  parseGitRemoteUrl,
  remoteLinkMarkdownLabel,
  toRemoteLinkMarkdown,
} from "../remoteLink";

describe("parseGitRemoteUrl", () => {
  it("parses https remotes with .git suffix", () => {
    expect(parseGitRemoteUrl("https://github.com/owner/repo.git")).toEqual({
      host: "github.com",
      repoPath: "owner/repo",
    });
  });

  it("parses scp-like ssh remotes", () => {
    expect(parseGitRemoteUrl("git@github.com:owner/repo.git")).toEqual({
      host: "github.com",
      repoPath: "owner/repo",
    });
  });

  it("parses ssh scheme remotes with ports", () => {
    expect(
      parseGitRemoteUrl("ssh://git@gitlab.example.com:2222/group/sub/repo.git"),
    ).toEqual({ host: "gitlab.example.com", repoPath: "group/sub/repo" });
  });

  it("parses git scheme and credentialed remotes", () => {
    expect(parseGitRemoteUrl("git://host.example.com/owner/repo.git")).toEqual({
      host: "host.example.com",
      repoPath: "owner/repo",
    });
    expect(
      parseGitRemoteUrl("https://user:token@github.com/owner/repo.git"),
    ).toEqual({ host: "github.com", repoPath: "owner/repo" });
    expect(parseGitRemoteUrl("github.com/owner/repo.git")).toEqual({
      host: "github.com",
      repoPath: "owner/repo",
    });
  });

  it("lowercases hosts and strips uppercase suffixes", () => {
    expect(parseGitRemoteUrl("GIT@GitHub.COM:Owner/Repo.GIT")).toEqual({
      host: "github.com",
      repoPath: "Owner/Repo",
    });
  });

  it("keeps azure ssh v3 paths intact", () => {
    expect(
      parseGitRemoteUrl("git@ssh.dev.azure.com:v3/org/project/repo"),
    ).toEqual({
      host: "ssh.dev.azure.com",
      repoPath: "v3/org/project/repo",
    });
  });

  it("rejects blank and traversal inputs", () => {
    expect(parseGitRemoteUrl("")).toBeNull();
    expect(parseGitRemoteUrl("   ")).toBeNull();
    expect(parseGitRemoteUrl("https://github.com/../etc")).toBeNull();
    expect(parseGitRemoteUrl("not a url")).toBeNull();
    expect(parseGitRemoteUrl("git@/repo.git")).toBeNull();
    expect(parseGitRemoteUrl("git@host:")).toBeNull();
    expect(parseGitRemoteUrl("https://github.com/")).toBeNull();
    expect(parseGitRemoteUrl("https://:8080/owner/repo")).toBeNull();
  });

  it("rejects local filesystem remotes instead of faking an https host", () => {
    // POSIX: without the guard these gain a synthetic scheme and re-parse
    // with `tmp` as the hostname, producing `https://tmp/repo`.
    expect(parseGitRemoteUrl("/tmp/repo.git")).toBeNull();
    expect(parseGitRemoteUrl("/tmp/repo")).toBeNull();
    expect(parseGitRemoteUrl("/srv/git/owner/repo.git")).toBeNull();
    // Windows drive letters land in the scp-like branch, not the URL one.
    expect(parseGitRemoteUrl("C:/repo.git")).toBeNull();
    expect(parseGitRemoteUrl("C:\\repo.git")).toBeNull();
    expect(parseGitRemoteUrl("file:///tmp/repo.git")).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "/tmp/repo.git",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
  });

  it("rejects relative filesystem remotes instead of treating the first path segment as a host", () => {
    for (const remoteUrl of [
      "./repo.git",
      "../repo.git",
      "relative/repo.git",
      "nested/path/repo",
      "~/repo.git",
      "C:repo.git",
    ]) {
      expect(parseGitRemoteUrl(remoteUrl), remoteUrl).toBeNull();
    }
  });

  it("returns null for malformed percent encoding instead of throwing", () => {
    expect(parseGitRemoteUrl("https://github.com/owner/%ZZ")).toBeNull();
    expect(parseGitRemoteUrl("https://github.com/%E0%A4%A/repo")).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/%ZZ",
        target: { type: "repo" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
  });
});

describe("detectRemoteHostKind", () => {
  it.each([
    ["github.com", "github"],
    ["ghe.example.ghe.com", "github"],
    ["gitlab.com", "gitlab"],
    ["gitlab.example.com", "gitlab"],
    ["bitbucket.org", "bitbucketCloud"],
    ["bitbucket.example.com", "bitbucketServer"],
    ["dev.azure.com", "azure"],
    ["org.visualstudio.com", "azure"],
    ["gitea.example.com", "gitea"],
    ["gogs.example.com", "gogs"],
    ["gitee.com", "gitee"],
    ["git.sr.ht", "sourcehut"],
    ["gerrit.example.com", "gerrit"],
    ["chromium.googlesource.com", "chromium"],
    ["example.coding.net", "coding"],
    ["git.example.com", "unknown"],
  ] as const)("detects %s as %s", (host, expected) => {
    expect(detectRemoteHostKind(host)).toBe(expected);
  });
});

describe("buildRemoteLink", () => {
  it("builds a github file link with line range", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "git@github.com:owner/repo.git",
        target: { type: "file", path: "src/app.ts", startLine: 10, endLine: 20 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://github.com/owner/repo/blob/main/src/app.ts#L10-L20");
  });

  it("pins files to the commit sha when asked", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo.git",
        target: { type: "file", path: "src/app.ts", startLine: 3 },
        ref: { type: "commit", sha: "abc1234" },
      }),
    ).toBe("https://github.com/owner/repo/blob/abc1234/src/app.ts#L3");
  });

  it("builds github dir and commit links", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "dir", path: "src" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://github.com/owner/repo/tree/main/src");
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://github.com/owner/repo/commit/abc1234");
  });

  it("builds gitlab links with -/ segments", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitlab.com/group/sub/repo.git",
        target: { type: "file", path: "src/app.ts", startLine: 1, endLine: 2 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://gitlab.com/group/sub/repo/-/blob/main/src/app.ts#L1-2",
    );
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitlab.com/group/sub/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gitlab.com/group/sub/repo/-/commit/abc1234");
  });

  it("builds bitbucket cloud links with lines-N anchors", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.org/team/repo.git",
        target: { type: "file", path: "src/app.ts", startLine: 5, endLine: 9 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://bitbucket.org/team/repo/src/main/src/app.ts#lines-5:9",
    );
  });

  it("builds bitbucket server project/repo links", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.example.com/scm/proj/repo.git",
        target: { type: "file", path: "src/app.ts", startLine: 5 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://bitbucket.example.com/projects/proj/repos/repo/browse/src/app.ts?at=main#5",
    );
  });

  it("falls back to github-style links for unknown hosts", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://git.example.com/owner/repo/blob/main/a.ts");
  });

  it("renders the custom template for unknown hosts", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts", startLine: 2, endLine: 4 },
        ref: { type: "branch", name: "main" },
        customTemplate: "{base}/code/{repo}?ref={ref}&file={path}#L{startLine}-{endLine}",
      }),
    ).toBe(
      "https://git.example.com/code/owner/repo?ref=main&file=a.ts#L2-4",
    );
  });

  it("rejects non-browser schemes from custom templates", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
        customTemplate: "javascript:alert('{repo}')",
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
        customTemplate: "file:///etc/{repo}",
      }),
    ).toBeNull();
  });

  it("validates operands before rendering custom templates", () => {
    const template = "{base}/{repo}@{ref}/{path}";
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "commit", sha: "zzz" },
        ref: { type: "branch", name: "main" },
        customTemplate: template,
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "file", path: "  " },
        ref: { type: "branch", name: "main" },
        customTemplate: template,
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "  " },
        customTemplate: template,
      }),
    ).toBeNull();
  });

  it("returns null for invalid inputs", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "not a url",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "commit", sha: "zzz" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "file", path: "" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
  });

  it("ignores invalid line selections", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "file", path: "a.ts", startLine: -1 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://github.com/owner/repo/blob/main/a.ts");
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "file", path: "a.ts", startLine: 9, endLine: 2 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://github.com/owner/repo/blob/main/a.ts#L9");
  });

  it("links the repository root", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "git@github.com:owner/repo.git",
        target: { type: "repo" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://github.com/owner/repo");
  });

  it("preserves an explicit self-hosted browser scheme and port", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "http://git.example.com:8080/team/repo.git",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("http://git.example.com:8080/team/repo/blob/main/a.ts");
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com:9443/team/repo.git",
        target: { type: "repo" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://git.example.com:9443/team/repo");
  });

  it("uses provider-specific repository root routes", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.example.com/scm/proj/repo.git",
        target: { type: "repo" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://bitbucket.example.com/projects/proj/repos/repo");
    expect(
      buildRemoteLink({
        remoteUrl: "git@ssh.dev.azure.com:v3/org/project/repo",
        target: { type: "repo" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://dev.azure.com/org/project/_git/repo");
  });

  it("builds gitea branch and commit links", () => {
    // Gitea docs + file-view template: /src/branch/<branch>/… and
    // /src/commit/<sha>/… with GitHub-style #L anchors.
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitea.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts", startLine: 1, endLine: 3 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gitea.example.com/owner/repo/src/branch/main/a.ts#L1-L3");
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitea.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts", startLine: 2 },
        ref: { type: "commit", sha: "abc1234" },
      }),
    ).toBe("https://gitea.example.com/owner/repo/src/commit/abc1234/a.ts#L2");
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitea.example.com/owner/repo.git",
        target: { type: "dir", path: "src" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gitea.example.com/owner/repo/src/branch/main/src");
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitea.example.com/owner/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gitea.example.com/owner/repo/commit/abc1234");
  });

  it("builds gogs links with a single ref segment", () => {
    // gogs/gogs Home() handler: branchLink = RepoLink + "/src/" + BranchName.
    // Line spans render as <span id="L<n>"> — single anchors only.
    expect(
      buildRemoteLink({
        remoteUrl: "https://gogs.example.com/owner/repo.git",
        target: { type: "file", path: "a.ts", startLine: 1, endLine: 3 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gogs.example.com/owner/repo/src/main/a.ts#L1");
    expect(
      buildRemoteLink({
        remoteUrl: "https://gogs.example.com/owner/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gogs.example.com/owner/repo/commit/abc1234");
  });

  it("builds gitee links with github-style blob urls", () => {
    // Gitee mirrors the GitHub web UI (/blob/<ref>/…, /commit/<sha>, #L).
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitee.com/owner/repo.git",
        target: { type: "file", path: "a.ts", startLine: 1, endLine: 3 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gitee.com/owner/repo/blob/main/a.ts#L1-L3");
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitee.com/owner/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gitee.com/owner/repo/commit/abc1234");
  });

  it("builds sourcehut links with tree/item urls", () => {
    // Live git.sr.ht pages + Flask routes: /tree/<ref>/item/<path>,
    // /commit/<sha>, #L<n> / #L<n>-<m> fragments.
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.sr.ht/~owner/repo",
        target: { type: "file", path: "a.ts", startLine: 1, endLine: 3 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://git.sr.ht/~owner/repo/tree/main/item/a.ts#L1-3");
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.sr.ht/~owner/repo",
        target: { type: "file", path: "a.ts", startLine: 2 },
        ref: { type: "commit", sha: "abc1234" },
      }),
    ).toBe("https://git.sr.ht/~owner/repo/tree/abc1234/item/a.ts#L2");
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.sr.ht/~owner/repo",
        target: { type: "dir", path: "src" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://git.sr.ht/~owner/repo/tree/main/item/src");
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.sr.ht/~owner/repo",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://git.sr.ht/~owner/repo/commit/abc1234");
  });

  it("builds gitlab directory links", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://gitlab.com/group/repo.git",
        target: { type: "dir", path: "src" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gitlab.com/group/repo/-/tree/main/src");
  });

  it("builds bitbucket cloud commit and directory links", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.org/team/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://bitbucket.org/team/repo/commits/abc1234");
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.org/team/repo.git",
        target: { type: "dir", path: "src" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://bitbucket.org/team/repo/src/main/src");
  });

  it("builds bitbucket server commit links and rejects bare paths", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.example.com/scm/proj/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://bitbucket.example.com/projects/proj/repos/repo/commit/abc1234",
    );
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.example.com/single.git",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://bitbucket.example.com/single.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
  });

  it("builds azure file and commit links", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "git@ssh.dev.azure.com:v3/org/project/repo",
        target: { type: "file", path: "src/a.ts", startLine: 2, endLine: 5 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://dev.azure.com/org/project/_git/repo?path=/src/a.ts&version=GBmain&line=2&lineEnd=5&lineStartColumn=1&lineEndColumn=1",
    );
    expect(
      buildRemoteLink({
        remoteUrl: "https://dev.azure.com/org/project/_git/repo",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://dev.azure.com/org/project/_git/repo/commit/abc1234");
    expect(
      buildRemoteLink({
        remoteUrl: "https://dev.azure.com/org/project/_git/repo",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://dev.azure.com/org/project/_git/repo?path=/a.ts&version=GBmain",
    );
  });

  it("rejects azure remotes without an org/project/repo path", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://dev.azure.com/org/repo",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://dev.azure.com/org/repo",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
  });

  it("builds legacy visualstudio.com azure links from the org subdomain", () => {
    // The organization lives in the hostname, not the path: reading the
    // path as org/project/name used to emit `/Project/_git/_git/Repo`.
    expect(
      buildRemoteLink({
        remoteUrl: "https://acme.visualstudio.com/Project/_git/Repo",
        target: { type: "file", path: "src/a.ts", startLine: 2, endLine: 5 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://acme.visualstudio.com/Project/_git/Repo?path=/src/a.ts&version=GBmain&line=2&lineEnd=5&lineStartColumn=1&lineEndColumn=1",
    );
    expect(
      buildRemoteLink({
        remoteUrl: "https://acme.visualstudio.com/Project/_git/Repo",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://acme.visualstudio.com/Project/_git/Repo/commit/abc1234");
  });

  it("keeps the collection segment of legacy azure urls", () => {
    expect(
      buildRemoteLink({
        remoteUrl:
          "https://acme.visualstudio.com/DefaultCollection/Project/_git/Repo",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe(
      "https://acme.visualstudio.com/DefaultCollection/Project/_git/Repo/commit/abc1234",
    );
  });

  it("rejects legacy azure ssh remotes with no recoverable organization", () => {
    // `vs-ssh.visualstudio.com` is shared by every organization, so no org
    // can be derived from it — a link would point at an org called `vs-ssh`.
    expect(detectRemoteHostKind("vs-ssh.visualstudio.com")).toBe("azure");
    expect(
      buildRemoteLink({
        remoteUrl: "ssh://acme@vs-ssh.visualstudio.com:22/Project/_git/Repo",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBeNull();
  });

  it("builds gerrit, chromium, and coding links", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "ssh://user@gerrit.example.com:29418/project",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://gerrit.example.com/c/project/+/abc1234");
    expect(
      buildRemoteLink({
        remoteUrl: "https://chromium.googlesource.com/chromium/src.git",
        target: { type: "file", path: "a.cc", startLine: 7 },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://chromium.googlesource.com/chromium/src/+/main/a.cc#7");
    expect(
      buildRemoteLink({
        remoteUrl: "https://chromium.googlesource.com/chromium/src.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
      }),
    ).toBe("https://chromium.googlesource.com/chromium/src/+/abc1234");
    expect(
      buildRemoteLink({
        remoteUrl: "https://example.coding.net/owner/project/repo.git",
        target: { type: "file", path: "a.ts", startLine: 1, endLine: 2 },
        ref: { type: "branch", name: "master" },
      }),
    ).toBe(
      "https://example.coding.net/owner/project/repo/git/blob/master/a.ts#L1-L2",
    );
    expect(
      buildRemoteLink({
        remoteUrl: "https://example.coding.net/owner/project/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "master" },
      }),
    ).toBe(
      "https://example.coding.net/owner/project/repo/git/commit/abc1234",
    );
  });

  it("rejects empty refs and invalid commit refs", () => {
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "file", path: "a.ts" },
        ref: { type: "branch", name: "  " },
      }),
    ).toBeNull();
    expect(
      buildRemoteLink({
        remoteUrl: "https://github.com/owner/repo",
        target: { type: "file", path: "a.ts" },
        ref: { type: "commit", sha: "zzz" },
      }),
    ).toBeNull();
  });

  it("renders custom templates for commit and repo targets", () => {
    const template = "{base}/r/{repo}@{ref}:{path}:{sha}:{startLine}-{endLine}";
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "commit", sha: "abc1234" },
        ref: { type: "branch", name: "main" },
        customTemplate: template,
      }),
    ).toBe("https://git.example.com/r/owner/repo@main:::-");
    expect(
      buildRemoteLink({
        remoteUrl: "https://git.example.com/owner/repo.git",
        target: { type: "repo" },
        ref: { type: "commit", sha: "abc1234" },
        customTemplate: template,
      }),
    ).toBe("https://git.example.com/r/owner/repo@abc1234::abc1234:-");
  });
});

describe("encodeRepoPath", () => {
  it("encodes segments while keeping slashes", () => {
    expect(encodeRepoPath("src/my file/a.ts")).toBe("src/my%20file/a.ts");
  });

  it("normalises separators and drops dot segments", () => {
    expect(encodeRepoPath("src\\sub/./a.ts")).toBe("src/sub/a.ts");
    expect(encodeRepoPath("///")).toBe("");
  });
});

describe("markdown", () => {
  it("labels files with lines and commits with short sha", () => {
    expect(
      remoteLinkMarkdownLabel(
        { type: "file", path: "a.ts", startLine: 1, endLine: 2 },
        "owner/repo",
      ),
    ).toBe("a.ts#L1-L2");
    expect(
      remoteLinkMarkdownLabel({ type: "commit", sha: "abc1234def" }, "o/r"),
    ).toBe("abc1234");
    expect(
      remoteLinkMarkdownLabel({ type: "dir", path: "src" }, "o/r"),
    ).toBe("src");
    expect(
      remoteLinkMarkdownLabel({ type: "file", path: "a.ts" }, "o/r"),
    ).toBe("a.ts");
    expect(remoteLinkMarkdownLabel({ type: "repo" }, "owner/repo")).toBe(
      "owner/repo",
    );
  });

  it("renders markdown links", () => {
    expect(toRemoteLinkMarkdown("a.ts", "https://example.com")).toBe(
      "[a.ts](https://example.com)",
    );
  });
});
