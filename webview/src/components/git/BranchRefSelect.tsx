import type { BranchEntry } from "@gitview/shared/types/branch";

type BranchRefSelectProps = {
  branches: BranchEntry[];
  value: string;
  onChange: (ref: string) => void;
  /** Leading option shown when nothing is picked yet. */
  placeholder?: string;
  /** Ref that cannot be picked, e.g. the branch being rebased. */
  exclude?: string;
  disabled?: boolean;
  testId?: string;
};

export const branchSelectClasses =
  "w-full h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground";

/** The ref git needs for a branch: remotes must keep their `origin/` prefix. */
export function branchRefOf(branch: BranchEntry): string {
  return branch.remote ? branch.fullName : branch.name;
}

export function BranchRefSelect({
  branches,
  value,
  onChange,
  placeholder = "Select a branch…",
  exclude,
  disabled = false,
  testId,
}: BranchRefSelectProps) {
  const local = branches.filter((b) => !b.remote && branchRefOf(b) !== exclude);
  const remote = branches.filter((b) => b.remote && branchRefOf(b) !== exclude);

  return (
    <select
      className={branchSelectClasses}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    >
      <option value="">{placeholder}</option>
      {local.length > 0 ? (
        <optgroup label="Local">
          {local.map((branch) => (
            <option key={branch.fullName} value={branchRefOf(branch)}>
              {branch.name}
              {branch.current ? " (current)" : ""}
            </option>
          ))}
        </optgroup>
      ) : null}
      {remote.length > 0 ? (
        <optgroup label="Remote">
          {remote.map((branch) => (
            <option key={branch.fullName} value={branchRefOf(branch)}>
              {branch.fullName}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
