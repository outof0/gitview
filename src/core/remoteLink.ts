/**
 * Remote-link builder (GitLink-style "open/copy file on the remote host").
 *
 * Pure module: parses a Git remote URL, detects the hosting platform, and
 * builds browser URLs for files (with line ranges), directories, and commits.
 * No `vscode`, no `fs`, no `child_process`, no clock, no randomness.
 */

export type RemoteHostKind =
  | "github"
  | "gitlab"
  | "bitbucketCloud"
  | "bitbucketServer"
  | "azure"
  | "gitea"
  | "gogs"
  | "gitee"
  | "sourcehut"
  | "gerrit"
  | "chromium"
  | "coding"
  | "unknown";

export type ParsedGitRemote = {
  /** Lower-cased hostname, e.g. `github.com`. */
  host: string;
  /**
   * Repository path without leading/trailing slashes or a `.git` suffix,
   * e.g. `owner/repo`. Azure SSH remotes keep their `v3/org/project/repo`
   * shape so the builder can split it back apart.
   */
  repoPath: string;
};

export type RemoteLinkRef =
  | { type: "branch"; name: string }
  | { type: "commit"; sha: string };

export type RemoteLinkTarget =
  | { type: "repo" }
  | { type: "file"; path: string; startLine?: number; endLine?: number }
  | { type: "dir"; path: string }
  | { type: "commit"; sha: string };

export type RemoteLinkRequest = {
  remoteUrl: string;
  target: RemoteLinkTarget;
  /** Pinned ref for file/dir targets. Commit targets ignore this. */
  ref?: RemoteLinkRef;
  /**
   * Optional custom template for hosts we do not recognise. Tokens:
   * `{base}` `{repo}` `{ref}` `{sha}` `{path}` `{startLine}` `{endLine}`.
   */
  customTemplate?: string;
};

function stripGitSuffix(path: string): string {
  if (path.toLowerCase().endsWith(".git")) {
    return path.slice(0, -".git".length);
  }
  return path;
}

function stripSlashes(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function stripCredentials(authority: string): string {
  const at = authority.lastIndexOf("@");
  return at === -1 ? authority : authority.slice(at + 1);
}

/**
 * True for a remote that names a local path instead of a network host.
 *
 * Without this guard a scheme-less absolute path gains the synthetic
 * `https://` below and re-parses with its first segment as the hostname:
 * `/tmp/repo.git` becomes host `tmp` and later the fake web URL
 * `https://tmp/repo`. UNC paths (`\\server\share`) never reach here — the
 * backslash guard in `parseGitRemoteUrl` already rejects them.
 */
function isLocalPathRemote(value: string): boolean {
  if (
    value.startsWith("/") ||
    /^[a-zA-Z]:/.test(value) ||
    value === "." ||
    value === ".." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("~/")
  ) {
    return true;
  }

  // A scp-like remote uses the same slash syntax as a relative path, but its
  // colon identifies the authority and must remain valid.
  if (/^(?:[^@/:\s]+@)?[^/:\s]+:.+$/.test(value)) {
    return false;
  }

  // Keep the convenient scheme-less `github.com/owner/repo` form while
  // rejecting `folder/repo.git`, which is a local relative path, not a host.
  const slash = value.indexOf("/");
  if (slash === -1) {
    return false;
  }
  const authority = value.slice(0, slash).toLowerCase();
  return !(
    authority === "localhost" ||
    authority.includes(".") ||
    /^\[[0-9a-f:]+\]$/i.test(authority) ||
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(authority)
  );
}

function stripPort(authority: string): string {
  const bare = stripCredentials(authority);
  const bracket = bare.lastIndexOf("]");
  const colon = bare.lastIndexOf(":");
  if (colon === -1) {
    return bare;
  }
  if (bracket !== -1 && colon < bracket) {
    return bare;
  }
  const port = bare.slice(colon + 1);
  if (/^\d+$/.test(port)) {
    return bare.slice(0, colon);
  }
  return bare;
}

/**
 * Parse HTTPS/SSH/scp-like remote URLs into host + repo path.
 * Returns null when the value is not a recognisable remote URL.
 */
export function parseGitRemoteUrl(remoteUrl: string): ParsedGitRemote | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    return null;
  }
  if (/[\s\\]/.test(trimmed) || trimmed.includes("..")) {
    return null;
  }
  if (isLocalPathRemote(trimmed)) {
    return null;
  }

  const scp = trimmed.match(/^(?:([^@/:\s]+)@)?([^/:\s]+):(.+)$/);
  if (scp && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    const host = scp[2]?.toLowerCase() ?? "";
    const repoPath = stripSlashes(stripGitSuffix(scp[3] ?? ""));
    if (!host || !repoPath) {
      return null;
    }
    return { host, repoPath };
  }

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  const host = stripPort(parsed.host).toLowerCase();
  if (!host) {
    return null;
  }
  // A configured remote with malformed percent encoding (e.g. `%ZZ`) must
  // reject to null like any other unparsable remote — decodeURIComponent
  // throws, and the throw must stay inside the parser's null contract.
  let repoPath: string;
  try {
    repoPath = stripSlashes(stripGitSuffix(decodeURIComponent(parsed.pathname)));
  } catch {
    return null;
  }
  if (!repoPath) {
    return null;
  }
  return { host, repoPath };
}

/** Detect the hosting platform from a (lower-cased) hostname. */
export function detectRemoteHostKind(host: string): RemoteHostKind {
  const name = host.toLowerCase();
  if (name === "github.com" || name.endsWith(".ghe.com") || name.includes("github")) {
    return "github";
  }
  if (name.includes("gitlab")) {
    return "gitlab";
  }
  if (name === "bitbucket.org") {
    return "bitbucketCloud";
  }
  if (name.includes("bitbucket")) {
    return "bitbucketServer";
  }
  if (
    name === "dev.azure.com" ||
    name === "ssh.dev.azure.com" ||
    name.endsWith(".visualstudio.com")
  ) {
    return "azure";
  }
  if (name.includes("gitea")) {
    return "gitea";
  }
  if (name.includes("gogs")) {
    return "gogs";
  }
  if (name.includes("gitee")) {
    return "gitee";
  }
  if (name === "git.sr.ht" || name.endsWith(".sr.ht") || name.includes("sourcehut")) {
    return "sourcehut";
  }
  if (name.includes("gerrit")) {
    return "gerrit";
  }
  if (name.includes("googlesource.com")) {
    return "chromium";
  }
  if (name.includes("coding.net")) {
    return "coding";
  }
  return "unknown";
}

/** Encode a repo-relative path segment by segment (slashes survive). */
export function encodeRepoPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function isValidLine(value: number | undefined): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function normalizeLines(
  startLine: number | undefined,
  endLine: number | undefined,
): { start: number; end: number } | null {
  if (!isValidLine(startLine)) {
    return null;
  }
  if (isValidLine(endLine) && endLine >= startLine) {
    return { start: startLine, end: endLine };
  }
  return { start: startLine, end: startLine };
}

function splitServerRepo(repo: string): { project: string; slug: string } | null {
  const segments = repo.split("/");
  const scoped =
    segments[0]?.toLowerCase() === "scm" ? segments.slice(1) : segments;
  if (scoped.length < 2 || !scoped[0]) {
    return null;
  }
  return { project: scoped[0], slug: scoped.slice(1).join("/") };
}

function isValidSha(sha: string): boolean {
  return /^[0-9a-f]{4,40}$/i.test(sha.trim());
}

function isValidTarget(target: RemoteLinkTarget): boolean {
  switch (target.type) {
    case "repo": {
      return true;
    }
    case "commit": {
      return isValidSha(target.sha);
    }
    case "file":
    case "dir": {
      return target.path.trim().length > 0;
    }
  }
}

function isValidRef(ref: RemoteLinkRef): boolean {
  if (ref.type === "branch") {
    return ref.name.trim().length > 0;
  }
  return isValidSha(ref.sha);
}

/** Only http(s) URLs may be opened in the browser. */
function isBrowserUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

function renderCustomTemplate(
  template: string,
  values: Record<string, string>,
): string {
  let rendered = template;
  for (const [token, value] of Object.entries(values)) {
    rendered = rendered.split(`{${token}}`).join(value);
  }
  return rendered;
}

/**
 * Return the browser origin represented by a Git remote. Git transports such
 * as SSH and `git://` are not browser schemes, so they use HTTPS, but an
 * explicit HTTP(S) scheme and a self-hosted port are retained.
 */
function remoteWebBase(remoteUrl: string, host: string): string {
  const trimmed = remoteUrl.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return `https://${host}`;
  }
  try {
    const parsed = new URL(trimmed);
    const browserTransport =
      parsed.protocol === "http:" || parsed.protocol === "https:";
    const scheme = parsed.protocol === "http:" ? "http:" : "https:";
    // An SSH/Git port is a transport port, not the web port. Preserve the
    // authority (including its port) only when the remote itself is HTTP(S).
    return `${scheme}//${browserTransport ? parsed.host || host : host}`;
  } catch {
    return `https://${host}`;
  }
}

function customValues(
  base: string,
  repoPath: string,
  target: RemoteLinkTarget,
  ref: RemoteLinkRef | undefined,
): Record<string, string> {
  const refName = ref ? (ref.type === "branch" ? ref.name : ref.sha) : "";
  const lines =
    target.type === "file"
      ? normalizeLines(target.startLine, target.endLine)
      : null;
  return {
    base,
    repo: repoPath,
    ref: refName,
    sha: ref?.type === "commit" ? ref.sha : "",
    path:
      target.type === "file" || target.type === "dir" ? target.path : "",
    startLine: lines ? String(lines.start) : "",
    endLine: lines ? String(lines.end) : "",
  };
}

/**
 * Build the browser URL for a remote target. Returns null when the remote
 * URL, ref, or target is invalid. Unknown hosts fall back to the
 * GitHub-style shape unless `customTemplate` is provided.
 *
 * Custom templates render only after the same operand validation as every
 * other host, and the rendered value must be an http(s) URL: the template
 * is user-configured text, and anything else must never reach `openExternal`.
 */
export function buildRemoteLink(request: RemoteLinkRequest): string | null {
  const parsed = parseGitRemoteUrl(request.remoteUrl);
  if (!parsed) {
    return null;
  }
  const kind = detectRemoteHostKind(parsed.host);
  if (!isValidTarget(request.target)) {
    return null;
  }
  const pathTarget = request.target.type === "file" || request.target.type === "dir";
  if (pathTarget && (!request.ref || !isValidRef(request.ref))) {
    return null;
  }
  // Azure serves Git over ssh.dev.azure.com but the web portal lives on
  // dev.azure.com; links built from an SSH remote must target the portal.
  const base =
    kind === "azure" && parsed.host === "ssh.dev.azure.com"
      ? "https://dev.azure.com"
      : remoteWebBase(request.remoteUrl, parsed.host);
  if (kind === "unknown" && request.customTemplate?.trim()) {
    const rendered = renderCustomTemplate(
      request.customTemplate.trim(),
      customValues(
        base,
        parsed.repoPath,
        request.target,
        request.ref,
      ),
    );
    return isBrowserUrl(rendered) ? rendered : null;
  }

  const repo = parsed.repoPath;
  switch (request.target.type) {
    case "repo": {
      return buildRepoUrl(kind, base, parsed.host, repo);
    }
    case "commit": {
      return buildCommitUrl(
        kind,
        base,
        parsed.host,
        repo,
        request.target.sha.trim(),
      );
    }
    case "file":
    case "dir": {
      const requestRef = request.ref!;
      const refName =
        requestRef.type === "branch" ? requestRef.name : requestRef.sha;
      const ref = encodeURIComponent(refName);
      const path = encodeRepoPath(request.target.path);
      if (!path) {
        return null;
      }
      const lines =
        request.target.type === "file"
          ? normalizeLines(request.target.startLine, request.target.endLine)
          : null;
      return buildPathUrl(
        kind,
        base,
        parsed.host,
        repo,
        path,
        ref,
        requestRef.type,
        request.target.type,
        lines,
      );
    }
  }
}

function buildRepoUrl(
  kind: RemoteHostKind,
  base: string,
  host: string,
  repo: string,
): string | null {
  switch (kind) {
    case "bitbucketServer": {
      const split = splitServerRepo(repo);
      if (!split) {
        return null;
      }
      const slug = split.slug
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      return `${base}/projects/${encodeURIComponent(split.project)}/repos/${slug}`;
    }
    case "azure": {
      const split = splitAzureRepo(repo, host);
      if (!split) {
        return null;
      }
      return `${base}/${split.scope}/_git/${split.name}`;
    }
    case "gerrit": {
      return `${base}/c/${repo}`;
    }
    default: {
      return `${base}/${repo}`;
    }
  }
}

function githubStylePathUrl(
  base: string,
  repo: string,
  path: string,
  ref: string,
  isFile: boolean,
  lines: { start: number; end: number } | null,
): string {
  const view = isFile ? "blob" : "tree";
  const url = `${base}/${repo}/${view}/${ref}/${path}`;
  if (!lines) {
    return url;
  }
  if (lines.start === lines.end) {
    return `${url}#L${lines.start}`;
  }
  return `${url}#L${lines.start}-L${lines.end}`;
}

/**
 * Gitea browse URLs (docs.gitea.com "Markdown / link handling" and the
 * file-view template): `/src/branch/<branch>/<path>` for branches,
 * `/src/commit/<sha>/<path>` for pinned revisions. Line anchors follow the
 * GitHub `#L` convention Gitea imitates.
 */
function giteaPathUrl(
  base: string,
  repo: string,
  path: string,
  ref: string,
  refType: "branch" | "commit",
  lines: { start: number; end: number } | null,
): string {
  const scope = refType === "branch" ? "branch" : "commit";
  const url = `${base}/${repo}/src/${scope}/${ref}/${path}`;
  if (!lines) {
    return url;
  }
  if (lines.start === lines.end) {
    return `${url}#L${lines.start}`;
  }
  return `${url}#L${lines.start}-L${lines.end}`;
}

/**
 * Gogs browse URLs (gogs/gogs `Home()` handler: `branchLink =
 * RepoLink + "/src/" + BranchName`, tree path appended). Gogs predates the
 * branch/commit URL split — a single ref segment serves both. Line numbers
 * render as `<span id="L<n>">`, so single-line `#L` anchors are safe; ranges
 * have no verified form and fall back to the start line.
 */
function gogsPathUrl(
  base: string,
  repo: string,
  path: string,
  ref: string,
  lines: { start: number; end: number } | null,
): string {
  const url = `${base}/${repo}/src/${ref}/${path}`;
  if (!lines) {
    return url;
  }
  return `${url}#L${lines.start}`;
}

/**
 * SourceHut git browse URLs (live git.sr.ht pages and the git.sr.ht Flask
 * routes): `/tree/<ref>/item/<path>` for both files and directories, with
 * `#L<n>` / `#L<n>-<m>` line fragments.
 */
function sourcehutPathUrl(
  base: string,
  repo: string,
  path: string,
  ref: string,
  lines: { start: number; end: number } | null,
): string {
  const url = `${base}/${repo}/tree/${ref}/item/${path}`;
  if (!lines) {
    return url;
  }
  if (lines.start === lines.end) {
    return `${url}#L${lines.start}`;
  }
  return `${url}#L${lines.start}-${lines.end}`;
}

function buildPathUrl(
  kind: RemoteHostKind,
  base: string,
  host: string,
  repo: string,
  path: string,
  ref: string,
  refType: "branch" | "commit",
  targetType: "file" | "dir",
  lines: { start: number; end: number } | null,
): string | null {
  const isFile = targetType === "file";
  switch (kind) {
    case "github":
    case "gitee":
    case "unknown": {
      // Gitee mirrors the GitHub web UI, including `/blob/<ref>/<path>`
      // file URLs, `/commit/<sha>` pages, and `#L` anchors.
      return githubStylePathUrl(base, repo, path, ref, isFile, lines);
    }
    case "gitea": {
      return giteaPathUrl(base, repo, path, ref, refType, lines);
    }
    case "gogs": {
      return gogsPathUrl(base, repo, path, ref, lines);
    }
    case "sourcehut": {
      return sourcehutPathUrl(base, repo, path, ref, lines);
    }
    case "gitlab": {
      const view = isFile ? "blob" : "tree";
      const url = `${base}/${repo}/-/${view}/${ref}/${path}`;
      if (!lines) {
        return url;
      }
      if (lines.start === lines.end) {
        return `${url}#L${lines.start}`;
      }
      return `${url}#L${lines.start}-${lines.end}`;
    }
    case "bitbucketCloud": {
      const url = `${base}/${repo}/src/${ref}/${path}`;
      if (!lines) {
        return url;
      }
      if (lines.start === lines.end) {
        return `${url}#lines-${lines.start}`;
      }
      return `${url}#lines-${lines.start}:${lines.end}`;
    }
    case "bitbucketServer": {
      const split = splitServerRepo(repo);
      if (!split) {
        return null;
      }
      const url = `${base}/projects/${encodeURIComponent(split.project)}/repos/${encodeURIComponent(split.slug)}/browse/${path}?at=${ref}`;
      if (!lines) {
        return url;
      }
      if (lines.start === lines.end) {
        return `${url}#${lines.start}`;
      }
      return `${url}#${lines.start}-${lines.end}`;
    }
    case "azure": {
      return buildAzurePathUrl(base, host, repo, path, ref, lines);
    }
    case "gerrit": {
      return `${base}/c/${repo}/+/${ref}/${path}`;
    }
    case "chromium": {
      const url = `${base}/${repo}/+/${ref}/${path}`;
      if (!lines) {
        return url;
      }
      return `${url}#${lines.start}`;
    }
    case "coding": {
      const url = `${base}/${repo}/git/blob/${ref}/${path}`;
      if (!lines) {
        return url;
      }
      if (lines.start === lines.end) {
        return `${url}#L${lines.start}`;
      }
      return `${url}#L${lines.start}-L${lines.end}`;
    }
  }
}

/**
 * Legacy Azure DevOps host suffix. On `*.visualstudio.com` the organization
 * is the subdomain, so the URL path carries only [collection/]<project>.
 */
const VISUALSTUDIO_HOST_SUFFIX = ".visualstudio.com";

/**
 * The shared legacy SSH endpoint. Every organization terminates SSH on the
 * same host, so the org is not recoverable from it — a link built anyway
 * would point at an organization called `vs-ssh`.
 */
const VISUALSTUDIO_SSH_HOST = "vs-ssh.visualstudio.com";

/** Azure clone paths mark the repo segment with `_git` (HTTPS) or `_ssh` (SSH). */
const AZURE_REPO_MARKERS = new Set(["_git", "_ssh"]);

type AzureRepoScope = {
  /**
   * Percent-encoded path between the host and `/_git/`. `<org>/<project>`
   * on `dev.azure.com`, `[collection/]<project>` on the legacy host where
   * the org already lives in the hostname.
   */
  scope: string;
  /** Percent-encoded repository name. */
  name: string;
};

/**
 * Split an Azure clone path into the scope that precedes `/_git/` and the
 * repository name.
 *
 * The two host families disagree about where the organization lives:
 *
 * - `dev.azure.com` / `ssh.dev.azure.com` encode it in the path —
 *   `<org>/<project>/_git/<repo>` over HTTPS and `v3/<org>/<project>/<repo>`
 *   over SSH.
 * - `*.visualstudio.com` encodes it in the hostname —
 *   `https://<org>.visualstudio.com/<project>/_git/<repo>`. Treating that
 *   path as org/project/name produced the doubled
 *   `/Project/_git/_git/Repo` link.
 */
function splitAzureRepo(repo: string, host: string): AzureRepoScope | null {
  const raw = repo.split("/").filter((segment) => segment.length > 0);
  const segments = raw[0] === "v3" ? raw.slice(1) : raw;
  const marker = segments.findIndex((segment) => AZURE_REPO_MARKERS.has(segment));
  const head = marker === -1 ? segments : segments.slice(0, marker);
  const tail = marker === -1 ? null : segments.slice(marker + 1);

  if (host.endsWith(VISUALSTUDIO_HOST_SUFFIX)) {
    const org = host.slice(0, -VISUALSTUDIO_HOST_SUFFIX.length);
    if (!org || host === VISUALSTUDIO_SSH_HOST) {
      return null;
    }
    return azureScope(tail ? head : head.slice(0, 1), tail ?? head.slice(1), 1);
  }
  return azureScope(tail ? head : head.slice(0, 2), tail ?? head.slice(2), 2);
}

function azureScope(
  scope: string[],
  name: string[],
  minScopeLength: number,
): AzureRepoScope | null {
  if (scope.length < minScopeLength || name.length === 0) {
    return null;
  }
  if (scope.some((segment) => segment.length === 0)) {
    return null;
  }
  if (name.some((segment) => segment.length === 0)) {
    return null;
  }
  return {
    scope: scope.map(encodeURIComponent).join("/"),
    name: name.map(encodeURIComponent).join("/"),
  };
}

function buildAzurePathUrl(
  base: string,
  host: string,
  repo: string,
  path: string,
  ref: string,
  lines: { start: number; end: number } | null,
): string | null {
  const split = splitAzureRepo(repo, host);
  if (!split) {
    return null;
  }
  let url = `${base}/${split.scope}/_git/${split.name}?path=/${path}&version=GB${ref}`;
  if (lines) {
    url += `&line=${lines.start}&lineEnd=${lines.end}&lineStartColumn=1&lineEndColumn=1`;
  }
  return url;
}

function buildCommitUrl(
  kind: RemoteHostKind,
  base: string,
  host: string,
  repo: string,
  sha: string,
): string | null {
  switch (kind) {
    case "github":
    case "gitea":
    case "gogs":
    case "gitee":
    case "unknown": {
      return `${base}/${repo}/commit/${sha}`;
    }
    case "gitlab": {
      return `${base}/${repo}/-/commit/${sha}`;
    }
    case "bitbucketCloud": {
      return `${base}/${repo}/commits/${sha}`;
    }
    case "bitbucketServer": {
      const split = splitServerRepo(repo);
      if (!split) {
        return null;
      }
      const slug = split.slug
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const project = encodeURIComponent(split.project);
      return `${base}/projects/${project}/repos/${slug}/commit/${sha}`;
    }
    case "azure": {
      const split = splitAzureRepo(repo, host);
      if (!split) {
        return null;
      }
      return `${base}/${split.scope}/_git/${split.name}/commit/${sha}`;
    }
    case "sourcehut": {
      return `${base}/${repo}/commit/${sha}`;
    }
    case "gerrit": {
      return `${base}/c/${repo}/+/${sha}`;
    }
    case "chromium": {
      return `${base}/${repo}/+/${sha}`;
    }
    case "coding": {
      return `${base}/${repo}/git/commit/${sha}`;
    }
  }
}

/** Markdown link label for a target: path with lines, short SHA, or repo. */
export function remoteLinkMarkdownLabel(
  target: RemoteLinkTarget,
  repoPath: string,
): string {
  switch (target.type) {
    case "file": {
      const lines = normalizeLines(target.startLine, target.endLine);
      if (!lines) {
        return target.path;
      }
      if (lines.start === lines.end) {
        return `${target.path}#L${lines.start}`;
      }
      return `${target.path}#L${lines.start}-L${lines.end}`;
    }
    case "dir": {
      return target.path;
    }
    case "commit": {
      return target.sha.trim().slice(0, 7);
    }
    case "repo": {
      return repoPath;
    }
  }
}

/** `[label](url)` Markdown for a built remote link. */
export function toRemoteLinkMarkdown(label: string, url: string): string {
  return `[${label}](${url})`;
}
