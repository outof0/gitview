# User Flows — Critical Git Workflows

## F01: Clone → Open Workspace

1. User runs "Git: Clone" (built-in VS Code)
2. Enters repo URL
3. Selects local path
4. VS Code clones and prompts to open
5. User opens workspace
6. GitView Git auto-detects repo, shows branch + status

**UI:** Status bar branch indicator, Git Workspace opens with Changes tab
**Error:** Clone fails → VS Code error dialog

## F02: Create Branch → Commit → Push (Golden Path)

1. Click branch name → Branch Popup opens
2. Click "+ New Branch from main…"
3. Dialog: enter name "feature/new-thing", base "main" ✓
4. Branch created, checkout complete → toast "Checked out feature/new-thing"
5. Edit files in editor
6. Git Workspace Changes tab shows modified files
7. Select files to stage (space)
8. Write commit message: "feat: add new thing"
9. Click [Commit and Push ▾] → [Commit and Push]
10. Push dialog opens (no upstream yet)
    - Remote: origin ✓
    - Branch: feature/new-thing ✓
    - ☑ Set upstream ✓
    - 1 commit to push previewed
11. Click [Push]
12. Toast: "✓ Pushed feature/new-thing to origin"

**Error flow:** Push rejected → show Rejected Push dialog with options

## F03: Commit Partial File (Hunk-Level)

1. In Changes tab, click modified file → inline diff preview opens
2. Diff shows 3 hunks
3. Click [Stage Hunk] on hunk 1
4. Click [Stage Hunk] on hunk 3
5. File status changes to "[staged: 2/3 hunks]"
6. Hunk 2 remains in unstaged changes
7. Write commit message → [Commit]
8. Only hunks 1 and 3 committed
9. Hunk 2 stays in Changes for next commit

## F04: Amend Last Commit

1. In Changes tab, click [Commit ▾] → [Amend Commit]
2. Commit message editor populates with last commit message
3. Check "☑ Amend last commit" (auto-checked)
4. Make additional changes / stage more files
5. Edit message if needed
6. Click [Commit]
7. Git: `git commit --amend`
8. Toast: "✓ Commit amended"
9. If already pushed → warning: "Commit was already pushed. Force push needed."

## F05: Pull → Conflict → Resolve → Continue

1. Click [Pull] in toolbar → Pull dialog
2. Strategy: Merge ✓
3. Click [Update]
4. Progress: Fetching… Merging…
5. ⚠ Conflict detected: 2 files
6. Toast: "Pull resulted in 2 conflicts" [Resolve]
7. Conflict List opens:
   - ! Button.tsx (3 blocks)
   - ! config.ts (1 block)
8. Click [Resolve →] on Button.tsx → Merge Studio opens
9. Navigate conflicts with F7
10. Block 1: Accept Left
11. Block 2: Manual edit in result pane
12. Block 3: Accept Right
13. All blocks resolved → [Apply] button enables
14. Click [Apply] → file written, git add
15. Auto-return to Conflict List, or auto-advance to config.ts
16. Resolve config.ts similarly
17. Conflict List: "Resolved: 2/2" [Continue Merge] enables
18. Click [Continue Merge]
19. Toast: "✓ Merge complete"
20. Commit message pre-populated with merge message
21. [Commit] to complete

## F06: Interactive Rebase → Squash → Conflict

1. In Log tab, right-click commit → "Start Interactive Rebase from Here…"
2. Select onto: main
3. Interactive Rebase Editor opens with 5 commits
4. Set commits 2-3 to squash (into commit 1)
5. Set commit 4 to reword
6. Set commit 5 to drop
7. Preview shows: 5 → 2 commits
8. Click [Start Rebase]
9. Confirm dialog: "2 commits will be lost, 1 message changed" [Start]
10. Rebase begins
11. Commit 2 squash → conflict in Button.tsx
12. Merge Studio opens: "Rebasing: commit 2/5 — fix: redirect"
13. Resolve conflicts, [Apply]
14. [Continue Rebase]
15. Commit 4 reword → editor opens with message to edit
16. Edit message, save
17. [Continue Rebase]
18. Toast: "✓ Rebase complete. 5 commits → 2 commits."

## F07: Cherry-pick Multiple Commits

1. In Log tab, Ctrl+click to select 3 commits
2. Right-click → "Cherry-pick"
3. Cherry-pick begins
4. If conflict → Merge Studio opens
5. Resolve → [Apply] → [Continue Cherry-pick]
6. Toast: "✓ Cherry-picked 3 commits"
7. Commits appear on current branch

## F08: Stash → Switch Branch → Apply

1. Working on feature/auth, not ready to commit
2. Click [⋮] in toolbar → "Stash Changes…"
3. Dialog: "Stash: WIP auth flow" + ☐ Include untracked
4. [Stash]
5. Toast: "✓ Changes stashed"
6. Branch popup → checkout main
7. Work on main
8. Branch popup → checkout feature/auth
9. Temporary tab → Stashes → stash@{0}: WIP auth flow
10. Right-click → "Apply Stash"
11. Changes restored
12. If conflict → enters conflict resolution flow

## F09: Hard Reset → Recover via Reflog

1. Log tab: realize 3 commits were wrong
2. Right-click earlier commit → "Reset Current Branch to Here…"
3. Reset Dialog: select Hard
4. Level-3 confirmation:
   - Shows 3 commits that will be lost
   - ☑ checkbox + confirm
5. Hard reset executed
6. Toast: "✓ HEAD reset to a1b2c3d (hard). Use reflog to recover."
7. User realizes they need one of the commits back
8. Command Palette → "Show Reflog" (or Git: reflog)
9. Find the lost commit hash
10. Log: search for hash → cherry-pick to recover

## F10: Force Push with Lease (Safe Force Push)

1. Push → rejected (non-fast-forward)
2. Rejected Push dialog shows:
   - Remote has 2 commits you don't have
   - Options: Pull first, Force w/ Lease, Force Push
3. Click [Force w/ Lease]
4. Confirmation (Level 2):
   - "Only pushes if remote hasn't changed since your last fetch"
5. [Confirm]
6. Toast: "✓ Pushed with lease"
7. (If lease fails: "Remote changed, fetch and try again")

## F11: Multi-Repository Workspace

1. VS Code workspace with 2 repos: frontend/, backend/
2. Git Workspace toolbar shows: "frontend ▾" (repo selector)
3. Changes tab shows frontend changes
4. Switch repo selector to "backend"
5. Changes tab shows backend changes
6. Push: "Push frontend only?" / "Push both repos" option
7. Branch sync: `synchronousBranchControl` setting controls multi-repo checkout

## F12: Discard All Changes (Guard)

1. Changes tab shows 5 modified files, 2 new files
2. Click [⋮] → "Discard All Changes"
3. Level-3 confirmation dialog:
   ```
   ⚠ Discard ALL changes?

   7 files will be permanently lost:
   ┌──────────────────────────────────┐
   │ M  src/components/Button.tsx     │
   │ M  src/utils/config.ts           │
   │ M  src/styles/theme.css          │
   │ M  src/hooks/useAuth.ts          │
   │ M  package.json                  │
   │ ?  src/new-file.ts               │
   │ ?  src/another-new.ts            │
   └──────────────────────────────────┘

   ☐ I understand these changes cannot be recovered

   [Cancel] [Discard All]
   ```
