import { describe, expect, it } from "vitest";
import { githubApiBaseUrl, parseGithubRemoteUrl } from "../review/githubRemote";
import { detectHostedRemote, remoteHostname } from "../review/remoteDetect";

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

  it("resolves API base URL for github.com and configured enterprise hosts", () => {
    expect(githubApiBaseUrl("github.com")).toBe("https://api.github.com");
    expect(githubApiBaseUrl("github.com", "https://api.github.com/")).toBe(
      "https://api.github.com",
    );
    expect(
      githubApiBaseUrl(
        "github.example.com",
        "https://github.example.com/api/v3/",
      ),
    ).toBe("https://github.example.com/api/v3");
  });

  it("refuses to derive an endpoint from an unrecognised host", () => {
    // The remote URL is repository data: whoever controls it would otherwise
    // choose where the stored token is sent.
    expect(githubApiBaseUrl("github.example.com")).toBeNull();
    // The settings default counts as "never configured", not as consent.
    expect(
      githubApiBaseUrl("github.example.com", "https://api.github.com"),
    ).toBeNull();
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
    expect(() =>
      githubApiBaseUrl(
        "github.example.com",
        "https://collector.example/api/v3",
      ),
    ).toThrow("must match Git remote host");
  });

  // Regression: `detectHostedRemote` used to substring-match the whole URL, so
  // each of these was treated as GitHub and received the token.
  describe("host spoofing", () => {
    it("reads the hostname, not the path or userinfo", () => {
      expect(remoteHostname("https://evil.example/github.com/app.git")).toBe(
        "evil.example",
      );
      expect(remoteHostname("https://github.com@evil.example/app.git")).toBe(
        "evil.example",
      );
      expect(remoteHostname("git@github.com:acme/app.git")).toBe("github.com");
    });

    it("does not treat lookalike hosts as GitHub", () => {
      expect(
        detectHostedRemote("https://github.com.attacker.invalid/acme/app.git"),
      ).toBeNull();
      expect(
        detectHostedRemote("https://evil.example/github.com/app.git"),
      ).toBeNull();
      expect(
        detectHostedRemote("https://github.com@evil.example/app.git"),
      ).toBeNull();
      expect(detectHostedRemote("https://notgithub.com/acme/app.git")).toBeNull();
    });

    it("still recognises genuine GitHub hosts", () => {
      expect(detectHostedRemote("https://github.com/acme/app.git")).toBe(
        "github",
      );
      expect(detectHostedRemote("git@github.com:acme/app.git")).toBe("github");
      expect(detectHostedRemote("https://gitlab.com/acme/app.git")).toBe(
        "gitlab",
      );
      expect(detectHostedRemote("https://example.com/app.git")).toBeNull();
    });
  });
});
