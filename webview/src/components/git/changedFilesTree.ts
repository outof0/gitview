import type { GitChangedFile, GitChangedFileStatus } from "@gitview/types";

export type ChangedFileTreeNode = {
  name: string;
  /** Repo-relative path for files; directory path for folders. */
  path: string;
  isFolder: boolean;
  status?: GitChangedFileStatus;
  children: ChangedFileTreeNode[];
};

type MutableNode = ChangedFileTreeNode & { childMap: Map<string, MutableNode> };

export function filterChangedFilesForScope(
  files: GitChangedFile[],
  scopePath: string,
  isFolder: boolean,
): GitChangedFile[] {
  if (!isFolder) {
    return files;
  }
  if (!scopePath || scopePath === ".") {
    return files;
  }

  const normalized = scopePath.replace(/\/$/, "");
  const prefix = `${normalized}/`;
  return files.filter(
    (f) =>
      f.path === normalized ||
      f.path.startsWith(prefix) ||
      f.path.startsWith(`${normalized}/`),
  );
}

export function pickDefaultChangedFile(
  files: GitChangedFile[],
  historyPath: string,
  isFolder: boolean,
): string | null {
  if (files.length === 0) {
    return null;
  }
  if (!isFolder) {
    const exact = files.find((f) => f.path === historyPath);
    if (exact) {
      return exact.path;
    }
    const nested = files.find((f) => f.path.endsWith(`/${historyPath}`));
    if (nested) {
      return nested.path;
    }
  }
  return files[0]?.path ?? null;
}

export function buildChangedFilesTree(
  files: GitChangedFile[],
): ChangedFileTreeNode[] {
  const root: MutableNode = {
    name: "",
    path: "",
    isFolder: true,
    children: [],
    childMap: new Map(),
  };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;
    let builtPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      builtPath = builtPath ? `${builtPath}/${part}` : part;

      let child = current.childMap.get(part);
      if (!child) {
        child = {
          name: part,
          path: builtPath,
          isFolder: !isLast,
          status: isLast ? file.status : undefined,
          children: [],
          childMap: new Map(),
        };
        current.childMap.set(part, child);
        current.children.push(child);
      } else if (isLast) {
        child.isFolder = false;
        child.status = file.status;
      }
      current = child;
    }
  }

  sortTreeNodes(root.children);
  return root.children;
}

function sortTreeNodes(nodes: ChangedFileTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children.length > 0) {
      sortTreeNodes(node.children);
    }
  }
}
