import { describe, expect, it } from "vitest";
import {
  encodeGitlabProjectPath,
  gitlabApiBaseUrl,
  parseGitlabRemoteUrl,
} from "../review/gitlabRemote";
import { detectHostedRemote } from "../review/remoteDetect";

describe("gitlabRemote", () => {
  it("parses HTTPS and SSH GitLab remotes", () => {
    expect(parseGitlabRemoteUrl("https://gitlab.com/acme/team/app.git")).toEqual({
      host: "gitlab.com",
      projectPath: "acme/team/app",
    });
    expect(parseGitlabRemoteUrl("git@gitlab.com:acme/app.git")).toEqual({
      host: "gitlab.com",
      projectPath: "acme/app",
    });
  });

  it("encodes nested project paths for API calls", () => {
    expect(encodeGitlabProjectPath("acme/team/app")).toBe("acme%2Fteam%2Fapp");
  });

  it("resolves API base URL for gitlab.com and configured self-hosted", () => {
    expect(gitlabApiBaseUrl("gitlab.com")).toBe("https://gitlab.com/api/v4");
    expect(
      gitlabApiBaseUrl(
        "gitlab.example.com",
        "https://gitlab.example.com/custom/api/v4/",
      ),
    ).toBe("https://gitlab.example.com/custom/api/v4");
    expect(
      gitlabApiBaseUrl("gitlab.example.com", "https://gitlab.example.com/api/v4"),
    ).toBe("https://gitlab.example.com/api/v4");
  });

  it("refuses to derive an endpoint from an unrecognised host", () => {
    // The remote URL is repository data, and GitLab sends its token in a
    // PRIVATE-TOKEN header — deriving `https://<host>/api/v4` from it would let
    // whoever controls the remote choose where the token goes.
    expect(gitlabApiBaseUrl("gitlab.example.com")).toBeNull();
    // The settings default counts as "never configured", not as consent.
    expect(
      gitlabApiBaseUrl("gitlab.example.com", "https://gitlab.com/api/v4"),
    ).toBeNull();
  });

  it("does not treat lookalike hosts as GitLab", () => {
    expect(
      detectHostedRemote("https://gitlab.com.attacker.invalid/acme/app.git"),
    ).toBeNull();
    expect(
      detectHostedRemote("https://evil.example/gitlab.com/app.git"),
    ).toBeNull();
    expect(
      detectHostedRemote("https://gitlab.com@evil.example/app.git"),
    ).toBeNull();
    expect(detectHostedRemote("https://gitlab.com/acme/app.git")).toBe("gitlab");
  });

  it("rejects insecure or unrelated configured API hosts", () => {
    expect(() =>
      gitlabApiBaseUrl("gitlab.com", "http://gitlab.com/api/v4"),
    ).toThrow("must use HTTPS");
    expect(() =>
      gitlabApiBaseUrl("gitlab.com", "https://collector.example/api/v4"),
    ).toThrow(
      "GitLab API host collector.example must match Git remote host gitlab.com",
    );
    expect(() =>
      gitlabApiBaseUrl(
        "gitlab.example.com",
        "https://collector.example/api/v4",
      ),
    ).toThrow("must match Git remote host");
  });
});
