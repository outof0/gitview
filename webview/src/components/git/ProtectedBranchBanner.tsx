import { ShieldAlert } from "lucide-react";

type ProtectedBranchBannerProps = {
  branchName: string | null;
};

export function ProtectedBranchBanner({ branchName }: ProtectedBranchBannerProps) {
  if (!branchName) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-[11px] bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-inputValidation-warningForeground)] border-b border-border"
      data-testid="protected-branch-banner"
    >
      <ShieldAlert size={14} aria-hidden />
      <span>
        <span className="font-mono">{branchName}</span> is protected. History
        rewrite actions such as amend and revert are blocked.
      </span>
    </div>
  );
}