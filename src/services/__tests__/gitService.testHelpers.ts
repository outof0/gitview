import { createGitService, type GitServiceDeps } from "../gitService";

/** Git log stdout matching LOG_FORMAT (%P parents, %D decorate, %b body). */
export function sampleLogOutput(subject: string, body = ""): string {
  return `COMMIT
abc1234567890123456789012345678901234567890
abc1234
John Doe
john@example.com
1719000000
${subject}
1111111111111111111111111111111111111111
HEAD -> master

${body}

END
M\tsrc/app.ts
`;
}

export function makeFakeGit(
  responses: Record<string, { stdout: string; stderr: string }>,
) {
  const calls: Array<{ repoRoot: string; args: string[] }> = [];
  const execGit: GitServiceDeps["execGit"] = (repoRoot, args) => {
    calls.push({ repoRoot, args });
    const key = args.join(" ");
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  };
  return {
    service: createGitService({ execGit, blameCache: new Map() }),
    calls,
  };
}

export const blamePorcelain = `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1719000000
author-tz +0700
committer John Doe
committer-mail <john@example.com>
committer-time 1719000000
committer-tz +0700
summary Fix greeting
filename src/app.ts
\tconst x = 1;
`;