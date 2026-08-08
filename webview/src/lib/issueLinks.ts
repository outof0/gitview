export type IssueLink = {
  id: string;
  label: string;
  url: string;
};

const ISSUE_PATTERNS = [
  /\b([A-Z][A-Z0-9]+-\d+)\b/g,
  /#(\d+)\b/g,
];

export function parseIssueLinks(
  text: string,
  trackerBaseUrl?: string,
): IssueLink[] {
  const base = trackerBaseUrl?.replace(/\/$/, "");
  const seen = new Set<string>();
  const links: IssueLink[] = [];

  for (const pattern of ISSUE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1] ?? match[0];
      const id = raw.startsWith("#") ? raw.slice(1) : raw;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const label = pattern.source.startsWith("#") ? `#${id}` : id;
      const url = base
        ? id.match(/^\d+$/)
          ? `${base}/issues/${id}`
          : `${base}/browse/${id}`
        : `#${id}`;
      links.push({ id, label, url });
    }
  }

  return links;
}