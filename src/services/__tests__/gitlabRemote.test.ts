import { describe, expect, it } from "vitest";
import {
  encodeGitlabProjectPath,
  gitlabApiBaseUrl,
  parseGitlabRemoteUrl,
} from "../review/gitlabRemote";

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

  it("resolves API base URL for gitlab.com and self-hosted", () => {
    expect(gitlabApiBaseUrl("gitlab.com")).toBe("https://gitlab.com/api/v4");
    expect(gitlabApiBaseUrl("gitlab.example.com")).toBe(
      "https://gitlab.example.com/api/v4",
    );
    expect(
      gitlabApiBaseUrl(
        "gitlab.example.com",
        "https://gitlab.example.com/custom/api/v4/",
      ),
    ).toBe("https://gitlab.example.com/custom/api/v4");
    expect(
      gitlabApiBaseUrl("gitlab.example.com", "https://gitlab.com/api/v4"),
    ).toBe("https://gitlab.example.com/api/v4");
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
  });
});
