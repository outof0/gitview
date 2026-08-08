#!/bin/bash
set -euo pipefail

# Build a clean Git fixture for Explorer Git submenu work (stash, commit, branch).
# Separate from test-conflict-repo, which is left mid-merge for the merge resolver.

export GIT_TERMINAL_PROMPT=0
export GIT_EDITOR=true
export GIT_SEQUENCE_EDITOR=true
export GIT_PAGER=cat
export PAGER=cat

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFLICT_REPO="$PROJECT_ROOT/test-conflict-repo"
CLEAN_REPO="$PROJECT_ROOT/test-clean-repo"

# Reuse the full conflict fixture as a content base, then abort to a clean tip.
bash "$SCRIPT_DIR/setup-test-repo.sh"

rm -rf "$CLEAN_REPO"
cp -a "$CONFLICT_REPO" "$CLEAN_REPO"
cd "$CLEAN_REPO"

git merge --abort >/dev/null 2>&1 || true
git rebase --abort >/dev/null 2>&1 || true
git cherry-pick --abort >/dev/null 2>&1 || true
git reset --hard HEAD
git clean -fd
git stash clear >/dev/null 2>&1 || true
rm -rf .git/gitview-shelves

# Small local marker so the repo is obviously the "clean Git menu" fixture.
cat >> README.md <<'EOF'

## Clean fixture

This clone is for non-conflict Git submenu actions (stash, commit, branch).
For merge conflicts, open `test-conflict-repo` instead.
EOF

git add README.md
git commit -q -m "clean fixture: document purpose"

echo "Clean test repo ready: $CLEAN_REPO"
echo "Conflict test repo ready: $CONFLICT_REPO"
