import { describe, expect, it } from "vitest";
import { githubApiBaseUrl, parseGithubRemoteUrl } from "../review/githubRemote";

describe("githubRemote", () => {
  it("parses https and ssh GitHub remotes", () => {
    expect(parseGithubRemoteUrl("https://github.com/acme/app.git")).toEqual({
      host: "github.com",
      owner: "acme",
      repo: "app",
    });
    expect(parseGithubRemoteUrl("git@github.com:acme/app.git")).toEqual({
      host: "github.com",
      owner: "acme",
      repo: "app",
    });
  });

  it("resolves API base URL for github.com and enterprise hosts", () => {
    expect(githubApiBaseUrl("github.com")).toBe("https://api.github.com");
    expect(githubApiBaseUrl("github.example.com")).toBe(
      "https://github.example.com/api/v3",
    );
    expect(
      githubApiBaseUrl(
        "github.example.com",
        "https://github.example.com/api/v3/",
      ),
    ).toBe("https://github.example.com/api/v3");
    expect(
      githubApiBaseUrl("github.example.com", "https://api.github.com"),
    ).toBe("https://github.example.com/api/v3");
  });

  it("rejects insecure or unrelated configured API hosts", () => {
    expect(() =>
      githubApiBaseUrl("github.com", "http://api.github.com"),
    ).toThrow("must use HTTPS");
    expect(() =>
      githubApiBaseUrl("github.com", "https://collector.example/api"),
    ).toThrow(
      "GitHub API host collector.example must match Git remote host github.com",
    );
  });
});
