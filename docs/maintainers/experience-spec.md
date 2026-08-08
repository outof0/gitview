# GitView Git Experience Spec

Date: 2026-08-08
Owner: Product Management
Product: GitView Diff
Status: Full-scope implementation spec — no MVP cut

## 1. Product Statement

GitView Diff gives VS Code-compatible editors a complete, IDE-grade Git
experience: local changes, commits, branches, history, diff, blame, conflict
resolution, temporary work, and hosted review in one coherent product.

The product should feel familiar to developers who expect a mature desktop IDE
Git workflow, but every surface, name, decision, and acceptance criterion belongs
to GitView Diff.

GitView uses Git CLI as the source of truth and VS Code APIs for editor
integration. It is the GitView Git experience.

The target is complete functional and interaction coverage for the GitView Git
experience, expressed through GitView-owned surfaces, copy, implementation, and
safety rules. No required Git workflow is intentionally left out of the product
scope.

### 1.1 Full-Scope Contract

This document is not an MVP plan.

GitView Diff must be implemented as the complete Git experience described here.
Engineering phases describe sequencing only, not optional scope. Phase 1 is the
first delivery slice of the full product, not a reduced product definition.

Non-negotiable scope rules:

- Do not remove features to simplify implementation.
- Do not replace product surfaces with command-only workflows.
- Do not defer conflict resolution, history editing, temporary work, tags,
  worktrees, or hosted review out of the product definition.
- Do not implement GitView as a skin over the built-in VS Code Git extension.
- Do not copy third-party proprietary artwork, third-party icons, third-party product names,
  exact third-party branded layouts, or branded implementation details.
- Use GitView-owned visual implementation: VS Code theme tokens for all colors and
  density, Lucide icons as the default icon set, and GitView-written UI copy.
- Do not hide incomplete behavior behind vague "future work" language.
- Any unsupported behavior must be recorded as a Product Exception with reason,
  user impact, technical cause, and compensating behavior.

Full product means:

- Repository awareness, status, staging, changelists, commit, sync, branches,
  tags, worktrees, log, blame, diff, conflict resolution, history actions,
  temporary work, patch workflows, provider-hosted review, settings, safety,
  recovery, and tests are all required.
- Each feature must be implemented through the correct GitView surface and through
  registered VS Code commands where appropriate.
- Each mutation must be backed by real Git integration tests.
- Each visible workflow must have UI or component tests.

### 1.2 AI Agent Implementation Goal

The intended implementation agent should read this document as the source of
truth for product behavior and architecture.

When implementing:

1. Build the shared model and Git execution layer first.
2. Implement each full-coverage phase in section 10 in order.
3. Keep stubs only when they are typed, visible, test-covered, and tracked as
   incomplete inside the product exception registry.
4. Never convert a required surface into a simple notification or command
   palette shortcut.
5. Update this spec when a behavior is discovered to require platform-specific
   handling.


## 2. Product Principles

1. Git state must be visible before it is changed.
2. Destructive actions must be explicit and recoverable where Git allows it.
3. Local work must never disappear silently.
4. Dense IDE tooling is preferred over dashboard-style UI.
5. The default path should be safe; advanced power actions should still exist.
6. Multi-root and nested repository behavior must be intentional.
7. Conflict resolution is a first-class product surface, not an error screen.
8. The same diff language should be used across changes, history, branch
   compare, patches, review, and merge resolution.
9. Repository content stays local unless the user explicitly pushes, fetches,
   pulls, or connects a hosted provider.

## 3. UX Contract

GitView Git UI must look and behave like a professional IDE tool window:

- Dense tree and split-pane layouts.
- Current branch and sync state always visible.
- Local changes grouped by purpose.
- Commit scope visible before commit.
- Branch actions available from a compact branch popup.
- Log with graph, branches, changed files, and commit details.
- Diff viewer with toolbar controls and hunk actions.
- Merge resolver with left/result/right panes.
- Compact empty states.
- Context menus for secondary actions.
- Dialogs for option-heavy operations.
- Confirmation for destructive operations.
- Bottom notifications for completed, failed, or reversible actions.

The interaction model is inspired by mature desktop IDE Git tooling and compact
tool-window workflows. GitView must not copy proprietary assets, proprietary
icons, exact branded layouts, product names, or branding from any other product.

Coverage means matching workflow coverage, information architecture, interaction
patterns, state transitions, safety behavior, and visual density. It does not
mean copying trademarks, branded assets, proprietary implementation details, or
pixel-identical protected artwork.

GitView Git UI must not use:

- Landing-page layouts.
- Hero sections.
- Decorative cards for working surfaces.
- Marketing copy inside tools.
- Large explanatory panels where a toolbar, status, or tooltip is enough.
- Hidden destructive actions.

## 4. Product Surfaces

### 4.1 GitView Git Widget

Purpose:

- Show current branch, repository state, incoming/outgoing counts, and active Git
  operation.
- Open branch and sync actions quickly.

Primary actions:

- Fetch.
- Pull / Update.
- Push.
- Open Branches.
- Resolve Conflicts.
- Continue / Abort active operation.

Required behavior:

- Show branch name or detached HEAD.
- Show no-repository state clearly.
- Show incoming and outgoing counts when upstream exists.
- Show merge, rebase, cherry-pick, revert, or bisect state when detected.
- In multi-root workspaces, show which repository the widget represents.
- If roots diverge, show a branch-divergence warning.

### 4.2 GitView Changes

Purpose:

- Let the user understand and prepare local work before committing.

Required groups:

- Changes.
- Unversioned Files.
- Ignored Files when enabled.
- Merge Conflicts.
- Staged / Unstaged when staging mode is enabled.
- Named changelists when changelist mode is enabled.

Primary actions:

- Open Diff.
- Add / Stage.
- Unstage.
- Rollback.
- Move to Changelist.
- Shelve.
- Stash.
- Resolve Conflicts.
- Commit.

Required behavior:

- Refresh automatically when Git state changes.
- Keep unversioned files out of commits unless selected.
- Aggregate folder status.
- Open file-level diff preview from selection.
- Show conflict files until Git reports them resolved.

### 4.3 GitView Commit

Purpose:

- Make committing deliberate and inspectable.

Required elements:

- Selected changes list.
- Commit message editor.
- Recent messages.
- Template support.
- Commit checks area.
- Commit button.
- Commit and Push button.
- Amend toggle.
- Sign-off option.
- Author override.

Required behavior:

- Commit selected files, hunks, lines, staged content, or changelists.
- Block empty messages unless explicitly allowed.
- Surface missing Git user config.
- Run hooks by default.
- Allow skip hooks only from an advanced option.
- Leave working tree and index unchanged when commit fails.

### 4.4 GitView Branches

Purpose:

- Make branch work fast, searchable, and safe.

Required groups:

- Recent.
- Local.
- Remote.
- Tags.

Primary actions:

- New Branch.
- Checkout.
- Checkout and Update.
- Smart Checkout.
- Force Checkout.
- Rename.
- Delete.
- Favorite.
- Compare with Current.
- Compare with Working Tree.
- Merge into Current.
- Rebase Current onto Selected.

Required behavior:

- Search branches.
- Group branches by prefix.
- Suggest branch prefixes while creating a branch.
- Create local tracking branch from remote branch.
- Warn when checkout would overwrite local changes.
- Smart Checkout preserves local changes using the configured temporary-work
  strategy.
- Force Checkout requires destructive confirmation.
- Delete branch warns about unmerged commits and offers recovery where possible.

### 4.5 GitView Log

Purpose:

- Explain repository history and provide history actions.

Required panes:

- Branches.
- Commit graph.
- Changed files.
- Commit details.
- Diff preview.

Required filters:

- Branch.
- Author.
- Date.
- Path.
- Repository root.
- Text search.
- Commit hash / revision.

Primary actions:

- Copy Hash.
- Copy Message.
- Open in Browser.
- Show Diff.
- Compare with Local.
- Get File from Revision.
- Cherry-pick.
- Revert.
- Reset Current Branch to Here.
- Create Branch from Here.
- Create Tag from Here.
- Start Interactive Rebase.
- Create Patch.

Required behavior:

- Project, folder, and file history are supported.
- Folder history includes descendant changes.
- File history follows renames when Git can provide the data.
- Selecting a commit updates changed files, details, and preview without
  resetting filters.
- Dangerous history actions are disabled on protected branches by default.

### 4.6 GitView Diff Viewer

Purpose:

- Provide one visual language for comparing and applying changes.

Required modes:

- Side-by-side.
- Unified.

Required comparisons:

- Working tree vs HEAD.
- Staged vs unstaged.
- File vs revision.
- File vs branch.
- Revision vs revision.
- Branch vs current branch.
- Branch vs working tree.
- Patch preview.
- Review file diff.

Required controls:

- Previous / Next change.
- Previous / Next file.
- Whitespace mode.
- Highlighting mode.
- Collapse unchanged regions.
- Synchronize scroll.
- Show / hide line numbers.
- Show / hide whitespace.

Writable hunk actions:

- Accept.
- Append.
- Revert.
- Copy previous content.
- Copy current content.
- Stage hunk.
- Unstage hunk.

Required behavior:

- Binary files show a safe fallback.
- Large files can disable expensive highlighting.
- Whitespace mode changes both display and navigation.
- Hunk actions affect only the selected hunk.

### 4.7 GitView Merge Studio

Purpose:

- Resolve Git conflicts visually and safely.

Required layout:

- Left pane: local version, read-only.
- Center pane: result, editable.
- Right pane: incoming version, read-only.
- Toolbar.
- Conflict counter.
- Overview ruler.
- Bottom action bar.

Required actions:

- Previous / Next conflict.
- Apply non-conflicting from left.
- Apply non-conflicting from right.
- Apply all non-conflicting.
- Accept left.
- Accept right.
- Ignore left.
- Ignore right.
- Append left.
- Append right.
- Reset block.
- Resolve simple conflicts.
- Search and replace.
- Apply.
- Cancel.
- Abort operation when valid.

Required behavior:

- Prefer Git index stages as the source of truth.
- Marker parsing is fallback only.
- Result never writes raw conflict markers.
- Apply is disabled while unresolved conflicts remain.
- Manual edits are preserved.
- Dirty Cancel requires confirmation.
- Resolved blocks do not show invalid resolve actions.

### 4.8 GitView Temporary Work

Purpose:

- Let users move unfinished work out of the way and bring it back safely.

Required features:

- Git stash.
- GitView shelf.
- Patch create.
- Patch apply.

Stash requirements:

- Stash all changes or selected scope.
- Optional message.
- Include untracked files when selected.
- List stashes.
- Apply, pop, and drop.

Shelf requirements:

- Shelve selected files, hunks, or changelist.
- Unshelve into selected or new changelist.
- Keep shelf entry reusable unless user deletes it.

Patch requirements:

- Create patch from local changes, selected files, or commit.
- Apply patch from file or clipboard.
- Preview changed files before applying.
- Map base directories.
- Strip path prefixes.
- Import patch into shelf.

### 4.9 GitView Review

Purpose:

- Bring hosted review workflows into the same Git product model.
- Hosted review is part of the full coverage scope. Provider-specific code can be
  modular internally, but the product surface is first-class.

Required provider workflows:

- List pull/merge requests.
- Filter by state, author, reviewer, assignee, and label.
- Open overview.
- Open timeline.
- View changed files.
- Filter changes by commit.
- Checkout review branch.
- Add comments.
- Add suggestions when provider supports it.
- Submit review.
- Approve.
- Request changes.
- Merge, squash, or rebase when permitted.

Required behavior:

- Use provider auth.
- Do not log tokens.
- Respect provider permissions.
- Disable blocked merge actions with reason.
- Keep pending comments visibly pending until submitted.

## 5. Feature Specs

### NDX-GIT-001 - Repository Awareness

User value:

- The user always knows which repository, root, and branch an action affects.

Functional requirements:

- Detect Git executable.
- Detect repository root from selected resource, active editor, SCM item, then
  workspace.
- Support nested repositories.
- Support multi-root workspaces.
- Block operations in untrusted workspaces.
- Reject paths outside repo root.

Acceptance criteria:

- A file inside a nested repo uses that nested repo.
- Multi-root destructive actions show the affected root.
- Missing Git executable produces a clear non-mutating error.

### NDX-GIT-002 - Local Status

User value:

- The user can see exactly what changed before deciding what to do.

Functional requirements:

- Show modified, added, deleted, renamed, copied, ignored, unversioned, staged,
  unstaged, and conflicted states.
- Refresh on file and Git state changes.
- Show file and folder-level status.
- Allow ignored and unversioned groups to be toggled.

Acceptance criteria:

- Unversioned files are not committed unless selected.
- Ignored files stay hidden unless enabled.
- Conflicted files remain visible until resolved in Git.

### NDX-GIT-003 - Changelists

User value:

- The user can split mixed work into named groups.

Functional requirements:

- Default changelist named `Changes`.
- Create, rename, delete, and activate changelists.
- Move files, hunks, and selected lines between changelists.
- Commit selected changelist.
- Preserve unselected work.

Acceptance criteria:

- One hunk can move to another changelist while the rest of the file stays in
  the original list.
- Committing one changelist does not commit another.

### NDX-GIT-004 - Staging Area Mode

User value:

- Git-native users can stage and unstage without leaving GitView.

Functional requirements:

- Toggle staging mode.
- Show Staged and Unstaged groups.
- Stage and unstage files, hunks, and selected lines.
- Commit staged content only.

Acceptance criteria:

- Staged state matches `git diff --cached`.
- Unstaged content remains after staged commit.

### NDX-GIT-005 - Commit

User value:

- The user can commit exactly the intended change set.

Functional requirements:

- Commit selected files, hunks, lines, changelists, or staged content.
- Commit message editor.
- Template support.
- Recent message support.
- Amend latest commit.
- Sign-off.
- Author override.
- Git hooks.
- Optional checks.

Acceptance criteria:

- Failed commit leaves working tree and index unchanged.
- Empty message is blocked unless explicitly allowed.
- Partial commit leaves unselected content pending.

### NDX-GIT-006 - Commit And Push

User value:

- The user can publish work without losing visibility into what is pushed.

Functional requirements:

- Commit selected scope.
- Show outgoing commits.
- Show target remote and branch.
- Push after confirmation when required.
- Handle rejected push.

Acceptance criteria:

- If push fails, commit remains local and visible as outgoing.
- Rejected push offers update/rebase/cancel without mutating automatically.

### NDX-GIT-007 - Fetch, Pull, Update

User value:

- The user can sync safely with remote repositories.

Functional requirements:

- Fetch remotes.
- Pull selected remote branch.
- Update current branch.
- Configure update strategy: merge, rebase, reset.
- Smart Update for dirty working tree.
- Open conflicts in Merge Studio.

Acceptance criteria:

- Fetch never changes local files.
- Fast-forward-only pull fails safely when impossible.
- Reset update requires destructive confirmation.

### NDX-GIT-008 - Push

User value:

- The user can send commits and tags with clear destination and risk.

Functional requirements:

- Push current branch.
- Push selected branch.
- Set upstream when missing.
- Push selected tags.
- Show outgoing commits.
- Guard force push.

Acceptance criteria:

- Missing upstream opens guided setup.
- Force push is blocked on protected branches.

### NDX-GIT-009 - Branches

User value:

- The user can create, switch, compare, and clean up branches quickly.

Functional requirements:

- Search branches.
- Show recent, local, remote, and tags.
- Group by prefix.
- Create branch.
- Checkout local branch.
- Checkout remote branch as tracked local branch.
- Checkout and Update.
- Smart Checkout.
- Rename branch.
- Delete branch.
- Favorite branch.
- Compare with current.
- Compare with working tree.

Acceptance criteria:

- Smart Checkout preserves local changes or opens conflict recovery.
- Deleting branch with unmerged commits warns and offers commit visibility.

### NDX-GIT-010 - Tags

User value:

- The user can mark and navigate important revisions.

Functional requirements:

- List tags.
- Create lightweight tag.
- Create annotated tag.
- Checkout tag with detached HEAD warning.
- Compare tag.
- Push tag.
- Delete tag.

Acceptance criteria:

- Detached HEAD state is visible after checkout.
- Push tag dialog shows included tags.

### NDX-GIT-011 - Worktrees

User value:

- The user can work on multiple branches side-by-side.

Functional requirements:

- List worktrees.
- Create worktree from branch or new branch.
- Choose location.
- Open worktree in new window/workspace.
- Delete worktree.

Acceptance criteria:

- Dirty worktree deletion is blocked or explicitly confirmed.
- Created worktree opens at selected location.

### NDX-GIT-012 - Log

User value:

- The user can understand project history and act on it.

Functional requirements:

- Commit graph.
- Branch filter.
- Author filter.
- Date filter.
- Path filter.
- Text and hash search.
- Changed files pane.
- Commit details pane.
- Diff preview.

Acceptance criteria:

- Selecting a commit updates details and changed files.
- Folder history includes descendants.
- File history follows renames when available.

### NDX-GIT-013 - History Actions

User value:

- The user can safely reuse, undo, or reshape history.

Functional requirements:

- Copy hash.
- Copy message.
- Create patch.
- Cherry-pick.
- Checkout revision.
- Compare with local.
- Get file from revision.
- Revert.
- Reset.
- Undo last commit.
- Edit commit message.
- Squash.
- Fixup.
- Drop.
- Interactive rebase.
- Create branch.
- Create tag.

Acceptance criteria:

- History rewrite actions respect protected branches.
- Revert creates a new commit.
- Hard reset requires destructive confirmation.

### NDX-GIT-014 - Diff Viewer

User value:

- The user can inspect and apply changes consistently.

Functional requirements:

- Side-by-side mode.
- Unified mode.
- Change navigation.
- File navigation.
- Whitespace mode.
- Highlighting mode.
- Collapse unchanged regions.
- Writable hunk actions.
- Binary and large-file fallback.

Acceptance criteria:

- Hunk action affects only selected hunk.
- Whitespace mode changes view and navigation.
- Binary file does not render corrupted text.

### NDX-GIT-015 - Blame

User value:

- The user can identify who changed a line and why.

Functional requirements:

- Line annotations.
- Author, date, hash, and summary.
- Open commit from annotation.
- Open file history from annotation.
- Hide/show annotations.

Acceptance criteria:

- Annotation click focuses the related commit in Log.
- Unsupported files show a clear state.

### NDX-GIT-016 - Conflict Detection

User value:

- The user always knows when Git is blocked by conflicts.

Functional requirements:

- Detect conflicts from Git status and index.
- Detect merge, pull, rebase, cherry-pick, unstash, and patch conflicts.
- Show conflict group in Changes.
- Show operation state in Git Widget.
- Open conflict dialog.

Acceptance criteria:

- Command-line-created conflicts appear after refresh.
- Conflict disappears only after Git reports resolution.

### NDX-GIT-017 - Merge Studio

User value:

- The user can resolve conflicts without editing raw markers.

Functional requirements:

- Three-pane local/result/incoming layout.
- Read Git stages.
- Marker fallback only when stages are unavailable.
- Conflict navigation.
- Bulk non-conflicting apply.
- Accept, ignore, append, reset.
- Manual result editing.
- Search and replace.
- Apply, Cancel, Abort.

Acceptance criteria:

- Result never contains conflict markers.
- Apply requires resolved conflicts.
- Dirty cancel requires confirmation.
- Manual edits are preserved.

### NDX-GIT-018 - Merge, Rebase, Cherry-Pick

User value:

- The user can integrate changes from other refs safely.

Functional requirements:

- Merge selected branch.
- Rebase onto selected branch or commit.
- Interactive rebase.
- Cherry-pick one or more commits.
- Continue, skip, and abort interrupted operations.
- Smart Merge for dirty working tree.

Acceptance criteria:

- Interrupted operation stays visible until resolved.
- Conflicts open Merge Studio.
- Cherry-pick multiple commits preserves order.

### NDX-GIT-019 - Rollback, Revert, Reset, Drop

User value:

- The user can undo mistakes with the right Git mechanism.

Functional requirements:

- Rollback uncommitted files, hunks, or lines.
- Revert commits.
- Reset soft, mixed, hard.
- Drop local commits.
- Undo last commit into local changes.

Acceptance criteria:

- Rollback does not affect unselected files.
- Revert preserves shared history.
- Reset hard and drop require confirmation.

### NDX-GIT-020 - Temporary Work

User value:

- The user can pause, move, export, and restore unfinished work.

Functional requirements:

- Stash.
- Unstash.
- Shelf.
- Unshelve.
- Create patch.
- Apply patch.
- Preview temporary work before applying.

Acceptance criteria:

- Stashes are compatible with Git CLI.
- Patch apply previews changed files.
- Unshelving does not delete shelf entry unless requested.

### NDX-GIT-021 - Hosted Review

User value:

- The user can review and merge provider-hosted changes inside GitView.
- Hosted review is part of the full GitView Git scope. Implementations may use
  provider modules, but the product must expose a complete review workflow.

Functional requirements:

- List reviews.
- Filter reviews.
- Open overview and timeline.
- View changed files.
- Comment.
- Suggest changes where supported.
- Submit review.
- Checkout review branch.
- Merge when permitted.

Acceptance criteria:

- Pending comments are visible before submission.
- Blocked merge actions show provider reason.

### NDX-GIT-022 - Settings And Safety

User value:

- The user can configure GitView without weakening safety accidentally.

Functional requirements:

- Git executable path.
- Changelist vs staging mode.
- Update strategy.
- Temporary-work strategy: shelf or stash.
- Auto-fetch.
- Protected branch patterns.
- CRLF warnings.
- Restore workspace on branch switch when supported.

Acceptance criteria:

- Protected branches block force push, hard reset, drop, and unsafe history
  rewrite.
- Invalid Git executable is caught before Git operations.
- CRLF warning respects `.gitattributes`.

## 6. Safety Rules

### 6.1 Destructive Confirmation

The following actions require explicit confirmation:

- Force Checkout.
- Hard Reset.
- Drop Commit.
- Force Push.
- Reset to Remote.
- Delete dirty worktree.
- Delete local file during rollback.

Confirmation must show:

- Repository.
- Current branch.
- Target ref.
- Affected files or commits when known.
- Exact destructive action.
- Cancel as the safe default.

### 6.2 Protected Branches

Default protected branch patterns:

- `main`
- `master`
- `release/*`
- `hotfix/*`
- `production`

Blocked by default:

- Force push.
- Hard reset.
- Drop commit.
- Unsafe interactive rebase.
- Undo pushed commit by rewriting history.

Allowed alternatives:

- Revert.
- Create new branch.
- Cherry-pick to a feature branch.

### 6.3 Smart Operations

Smart operations preserve local changes before running a risky Git operation.

Supported smart operations:

- Smart Checkout.
- Smart Merge.
- Smart Update.

Flow:

1. Save temporary local changes with the configured strategy.
2. Run the target Git operation.
3. Restore temporary local changes.
4. If restore conflicts, open Merge Studio or patch conflict preview.
5. Keep recovery state visible until resolved.

## 7. Navigation Model

Command Palette:

- GitView Diff: Open Git
- GitView Diff: Open Changes
- GitView Diff: Show History
- GitView Diff: Open Conflict Resolver
- GitView Diff: Fetch
- GitView Diff: Pull
- GitView Diff: Push

Explorer context menu:

- History.
- Diff.
- Compare.
- Blame.
- Rollback.
- Add / Stage.
- Shelve / Stash.

Editor context menu:

- Show History.
- Show Diff.
- Blame.
- Rollback Selection.
- Stage Selection.
- Move Selection to Changelist.

SCM context menu:

- Stage / Unstage.
- Commit.
- Commit and Push.
- Resolve Conflicts.
- Rollback.

Git Widget:

- Branch popup.
- Fetch.
- Pull / Update.
- Push.
- Operation recovery.

## 8. Empty And Error States

Empty states:

- No local changes.
- No conflicts.
- No commits found.
- No remote branches fetched.
- No stashes.
- No shelved changes.
- No reviews found.

Error states:

- `NO_GIT`: Git executable not found.
- `NO_REPO`: No Git repository found.
- `UNTRUSTED_WORKSPACE`: Git operation blocked.
- `DIRTY_WORKTREE`: Clean working tree required.
- `PROTECTED_BRANCH`: Action blocked by branch protection.
- `CONFLICTS_FOUND`: Operation paused for conflict resolution.
- `AUTH_FAILED`: Remote or provider authentication failed.
- `INVALID_REF`: Branch, tag, or commit cannot be resolved.
- `PATH_OUTSIDE_REPO`: Unsafe path rejected.
- `GIT_VERSION_UNSUPPORTED`: Installed Git does not support requested option.

## 9. QA Requirements

Every P0 feature requires:

- Unit tests for parsers, guards, and state transitions.
- Integration tests using real temporary Git repositories.
- Webview tests for visible workflows.

Required integration scenarios:

- Nested repository action routing.
- Multi-root action routing.
- Stage, unstage, commit, commit and push.
- Partial commit.
- Fetch, pull, push with local bare remote.
- Rejected push recovery.
- Smart Checkout.
- Smart Merge.
- Merge conflict.
- Rebase conflict.
- Cherry-pick conflict.
- Rollback.
- Revert.
- Reset guard.
- Stash and unstash.
- Shelf and unshelve.
- Patch apply.
- Protected branch blocked actions.

Required UI scenarios:

- Git Widget branch and sync state.
- Branch popup search, grouping, favorite, checkout.
- Changes grouping in changelist mode.
- Changes grouping in staging mode.
- Commit scope selection.
- Log filters and details.
- Diff whitespace, highlighting, navigation, hunk action.
- Merge Studio conflict actions.
- Dirty cancel guard.

## 10. Full Coverage Build Program

The product target is complete Git workflow coverage. The phases below describe
engineering execution order only. All phases are required for the complete
product.

### Phase 1 - Core Git Workspace

- Repository awareness.
- Git Widget.
- Changes.
- Staging mode.
- Changelists.
- Commit.
- Commit and Push.
- Partial commit by hunk and line.
- Fetch, Pull, Push, Update.
- Branch popup.
- Log.
- Diff Viewer.
- Blame.
- Conflict Detection.
- Merge Studio.
- Rollback.
- Revert.
- Cherry-pick.
- Protected branch guard.
- CRLF warning.

### Phase 2 - Complete Local Workflow

- Incoming/outgoing log filters.
- Branch rename, delete, favorite, group.
- Reset.
- Undo last commit.
- Drop local commit.
- Patch create/apply.
- Shelf.
- Tags.
- Worktrees.
- Interactive rebase.
- Commit checks.
- GPG signing.
- Git executable configuration.
- Stash list/apply/pop/drop.
- Patch path mapping and shelf import.
- Worktree create/open/delete.
- Tag create/reassign/checkout/push/delete.

### Phase 3 - Complete History And Integration Workflow

- History editing: edit message, squash, fixup, drop, extract changes.
- Merge options.
- Rebase options.
- Cherry-pick multi-select and recovery.
- Revert multi-select.
- Reset modes.
- Branch compare and apply file from branch.
- Commit graph presentation settings.
- Issue links from commit messages.

### Phase 4 - Hosted Review Workflow

- Provider auth.
- Review list.
- Review timeline.
- Review overview.
- Review branch checkout.
- Changed files by commit.
- Diff comments.
- Suggestions.
- Approve/request changes.
- Merge actions.
- Close/reopen review where provider supports it.
- Delete merged source branch where provider supports it.

Full coverage acceptance:

- Every feature spec in section 5 is implemented.
- Every product surface in section 4 is implemented.
- Hosted review exists as a first-class product surface.
- Tags, worktrees, patch, shelf, stash, interactive rebase, and history editing
  are required parts of the product.
- Any missing behavior must be documented as a product exception with reason,
  user impact, and test coverage.

## 11. Product Quality Bar

A feature is not done until:

- It lives in the correct GitView surface.
- It has GitView-owned naming and copy.
- It matches the dense IDE workflow expected by the product.
- It handles empty, loading, and failure states.
- It protects destructive actions.
- It works for nested repositories.
- It defines multi-root behavior.
- It is covered by appropriate tests.
- It feels like part of GitView Diff, not an attached command.

## 12. Technical Implementation Spec

This section defines how the product should be built. Product behavior above is
the what; this section is the how.

### 12.1 Architecture Overview

GitView Git is split into two runtimes:

- Extension Host: trusted TypeScript runtime with filesystem, Git CLI, VS Code
  API, command registration, watchers, and webview lifecycle.
- Webview App: React and Tailwind UI runtime for Changes, Log, Diff Viewer,
  Merge Studio, Temporary Work, and Review surfaces.

High-level modules:

- `CommandRegistry`: registers VS Code commands and binds them to preconditioned
  handlers.
- `RepositoryService`: resolves repository roots, workspace roots, Git dirs, and
  worktree metadata.
- `GitService`: safe Git CLI wrapper and command-specific operations.
- `StatusService`: status parsing, status cache, ignored/unversioned handling,
  staged/unstaged mapping.
- `DiffService`: working tree, index, revision, branch, and patch diff
  generation.
- `CommitService`: commit scope creation, commit validation, commit execution,
  commit-and-push orchestration.
- `BranchService`: branch list, checkout, smart checkout, create, rename,
  delete, compare.
- `LogService`: commit graph, branch/path filters, changed files, commit
  details, history actions.
- `MergeService`: conflict discovery, stage reading, merge document creation,
  result writing, mark-resolved behavior.
- `TemporaryWorkService`: stash, shelf, patch create/apply.
- `ProtectionService`: protected branch matching and dangerous action guards.
- `ReviewProviderRegistry`: provider modules for hosted review.
- `WebviewPanelManager`: creates panels, restores state, routes messages.

Source-of-truth policy:

- Git CLI is the authoritative source for repository state and mutations.
- VS Code APIs are used for editor integration, document opening, decorations,
  URI handling, filesystem watching, command registration, and SCM UI
  contribution when useful.
- The built-in VS Code Git extension API may be used only for interoperability
  and repository discovery fallback. It must not be the sole source of truth for
  Git state and must not hide CLI errors.
- All mutating Git operations must go through `GitService`.

### 12.2 Extension Host Structure

Target host structure:

```text
src/
  extension.ts
  commands/
    registry.ts
    gitCommands.ts
    preconditions.ts
  services/
    git/
      exec.ts
      repo.ts
      status.ts
      branch.ts
      commit.ts
      diff.ts
      log.ts
      merge.ts
      stash.ts
      patch.ts
      protection.ts
      types.ts
    watchers/
      repositoryWatcher.ts
      gitStatusWatcher.ts
      fileWatcher.ts
    review/
      providerRegistry.ts
      githubProvider.ts
      gitlabProvider.ts
  webview/
    panels.ts
    protocol.ts
    messageRouter.ts
    handlers/
      changesHandler.ts
      logHandler.ts
      diffHandler.ts
      mergeHandler.ts
```

Host responsibilities:

- Resolve the target repository for every action.
- Enforce workspace trust and protected branch rules.
- Run Git commands with timeout, cancellation, and structured errors.
- Watch repository status and push snapshots to webviews.
- Own file writes and Git mutations.
- Never trust webview paths or refs without host validation.

### 12.3 Webview App Structure

Target webview structure:

```text
webview/src/
  apps/
    GitApp.tsx
    MergeStudioApp.tsx
    LogApp.tsx
  components/
    changes/
    commit/
    branches/
    log/
    diff/
    merge/
    temporary-work/
    ui/
  store/
    gitStore.ts
    changesStore.ts
    logStore.ts
    diffStore.ts
    mergeStore.ts
    operationStore.ts
  protocol/
    client.ts
    messages.ts
  styles/
```

Webview responsibilities:

- Render the current host-provided state.
- Maintain UI-only state such as selected row, expanded tree nodes, filters,
  scroll position, active pane, and draft commit message.
- Send explicit user intents to the host.
- Never execute Git directly.
- Never assume a file path, ref, or operation is valid without host response.

State store:

- Use a small store per surface.
- Store host snapshots as immutable values.
- Store pending requests separately from committed host state.
- Optimistic UI is allowed only for reversible UI-only transitions.
- Git mutations should show pending state until host confirms.

### 12.4 Command Registry

Every command definition must include:

- Command ID.
- User-visible title.
- Scope: file, folder, repository, selection, commit, branch, conflict.
- Required trust state.
- Required repository state.
- Protected branch behavior.
- Handler.

Command handler flow:

1. Resolve target URI/resource.
2. Resolve repository.
3. Validate workspace trust.
4. Validate command preconditions.
5. Validate protected branch rules.
6. Confirm destructive actions.
7. Execute service operation.
8. Refresh affected repository state.
9. Notify open webviews.

### 12.5 Watchers

GitView needs three watcher layers.

File watcher:

- Watches workspace files for local edits.
- Debounces rapid updates.
- Triggers status refresh for affected repository.

Git metadata watcher:

- Watches Git dir paths discovered by `git rev-parse --git-dir`.
- Watches `HEAD`, `index`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`,
  `rebase-merge`, `rebase-apply`, and refs where available.
- Must handle worktrees where Git dir is not `.git`.

Status watcher:

- Debounced status refresh after file or Git metadata changes.
- Optional polling fallback when filesystem watchers are unreliable.
- Emits repository snapshots to open webviews.

Watcher requirements:

- Coalesce duplicate refreshes.
- Avoid full status loops while a long Git command is running.
- Cancel stale refreshes when a newer refresh starts.
- Never assume `.git` is a directory; it may be a file pointing to a Git dir.

### 12.6 Git Command Execution Policy

All Git CLI execution must use an argument array, never shell string
interpolation.

Required exec options:

- `cwd`: repository root.
- `timeoutMs`: default 30 seconds for status/diff/log, longer for push/pull.
- `cancellationToken`: user cancellation and superseded refresh cancellation.
- `maxBuffer`: command-specific limit.
- `env`: sanitized environment, preserving required Git auth variables.

Path safety:

- File paths are canonicalized relative to repo root.
- Paths must not escape repo root.
- File arguments must appear after `--`.
- Path separators are normalized for Git commands.

Error handling:

- Preserve Git exit code.
- Preserve stderr for user-facing failures.
- Map known failures to structured error codes.
- Do not log secrets, access tokens, credential helper output, or full remote
  URLs containing credentials.

Cancellation:

- Long operations expose Cancel where safe.
- Canceling a command kills the process but does not assume Git state rolled
  back.
- After cancellation, refresh repository state and show recovery action if an
  operation is in progress.

### 12.7 Git Command Mapping

| Capability | Primary Git commands |
| --- | --- |
| Repository root | `git rev-parse --show-toplevel`, `git rev-parse --git-dir` |
| Branch state | `git branch --format`, `git status --porcelain=v1 -b -z` |
| File status | `git status --porcelain=v1 -z --ignored` |
| Staged diff | `git diff --cached --` |
| Working diff | `git diff --` |
| File at revision | `git show <rev>:<path>` |
| Log | `git log --graph --format=... --name-status` |
| Blame | `git blame --line-porcelain --` |
| Stage | `git add -- <path>` |
| Unstage | `git restore --staged -- <path>` |
| Rollback | `git restore -- <path>` |
| Commit | `git commit` |
| Fetch | `git fetch` |
| Pull | `git pull` |
| Push | `git push` |
| Checkout | `git checkout <ref>` or `git switch <branch>` |
| New branch | `git switch -c <branch> <start-point>` |
| Merge | `git merge` |
| Rebase | `git rebase` |
| Cherry-pick | `git cherry-pick` |
| Revert | `git revert` |
| Reset | `git reset --soft|--mixed|--hard <commit>` |
| Stash | `git stash push`, `git stash apply`, `git stash pop`, `git stash drop` |
| Tags | `git tag`, `git push <remote> <tag>` |
| Worktrees | `git worktree list`, `git worktree add`, `git worktree remove` |
| Conflict stages | `git show :1:<path>`, `git show :2:<path>`, `git show :3:<path>` |

Command choice notes:

- Prefer `git switch` for branch switching when installed Git supports it.
- Fall back to `git checkout` for older Git versions.
- Feature-detect Git flags that vary by installed Git version before using them.
- Do not use terminal commands for mutations when a structured service operation
  exists.

### 12.8 Data Model

Canonical model shapes are TypeScript-like and shared between host and webview
through a protocol package or generated schema.

```ts
export type Repository = {
  id: string;
  rootPath: string;
  workspaceFolderPath: string | null;
  gitDirPath: string;
  name: string;
  currentBranch: string | null;
  headSha: string | null;
  upstream: string | null;
  isDetached: boolean;
  isBare: boolean;
  isWorktree: boolean;
  operation: OperationState;
};

export type GitFileStatusKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "unversioned"
  | "ignored"
  | "conflicted";

export type GitFileStatus = {
  repoId: string;
  path: string;
  oldPath?: string;
  kind: GitFileStatusKind;
  indexStatus: string;
  workingTreeStatus: string;
  staged: boolean;
  conflicted: boolean;
  binary: boolean;
};

export type ChangeList = {
  id: string;
  repoId: string;
  name: string;
  description?: string;
  active: boolean;
  filePaths: string[];
  createdAt: number;
  updatedAt: number;
};

export type Commit = {
  repoId: string;
  sha: string;
  shortSha: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  commitDate: string;
  subject: string;
  body: string;
  refs: string[];
  changedFiles?: CommitChangedFile[];
};

export type CommitChangedFile = {
  path: string;
  oldPath?: string;
  status: "A" | "M" | "D" | "R" | "C" | "U";
  additions?: number;
  deletions?: number;
};

export type Branch = {
  repoId: string;
  name: string;
  fullName: string;
  remoteName?: string;
  upstream?: string;
  current: boolean;
  remote: boolean;
  favorite: boolean;
  protected: boolean;
  ahead: number | null;
  behind: number | null;
  headSha: string | null;
};

export type Tag = {
  repoId: string;
  name: string;
  targetSha: string;
  annotated: boolean;
  message?: string;
};

export type ConflictFile = {
  repoId: string;
  path: string;
  statusCode: string;
  kind:
    | "both_modified"
    | "both_added"
    | "deleted_by_us"
    | "deleted_by_them"
    | "added_by_us"
    | "added_by_them"
    | "rename_conflict"
    | "unknown";
  hasBaseStage: boolean;
  hasOursStage: boolean;
  hasTheirsStage: boolean;
  operation: OperationState;
};

export type ConflictBlock = {
  id: string;
  kind:
    | "unchanged"
    | "ours_only"
    | "theirs_only"
    | "both_same"
    | "conflict";
  baseRange?: LineRange;
  oursRange?: LineRange;
  theirsRange?: LineRange;
  resultRange: LineRange;
  baseLines: string[];
  oursLines: string[];
  theirsLines: string[];
  resultLines: string[];
  resolvedBy:
    | "none"
    | "ours"
    | "theirs"
    | "both"
    | "manual"
    | "auto"
    | "ignored";
  dirty: boolean;
};

export type LineRange = {
  start: number;
  end: number;
};

export type ReviewItem = {
  provider: "github" | "gitlab";
  id: string;
  repoId: string;
  number: number;
  title: string;
  state: "open" | "closed" | "merged" | "draft";
  author: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  reviewState?: "pending" | "approved" | "changes_requested" | "commented";
  updatedAt: string;
};

export type OperationState =
  | { type: "none" }
  | { type: "merge"; canContinue: boolean; canAbort: boolean }
  | { type: "rebase"; canContinue: boolean; canSkip: boolean; canAbort: boolean }
  | { type: "cherry_pick"; canContinue: boolean; canSkip: boolean; canAbort: boolean }
  | { type: "revert"; canContinue: boolean; canSkip: boolean; canAbort: boolean }
  | { type: "bisect"; canAbort: boolean };
```

Data model rules:

- Host owns canonical repository state.
- Webview may store UI selection and draft input.
- All host-to-webview snapshots include `repoId`.
- All webview-to-host mutation requests include `repoId` and validated target
  identifiers.
- Paths in protocol payloads are repository-relative unless explicitly marked as
  absolute host-only paths.

### 12.9 Host-Webview Message Protocol

Protocol requirements:

- JSON-serializable only.
- Versioned protocol.
- Every request has `requestId`.
- Host replies with either success or structured error.
- Webview never sends executable Git arguments directly.
- Host validates all refs, paths, and operation IDs.

Base message shapes:

```ts
export type WebviewRequest<TType extends string, TPayload> = {
  protocolVersion: 1;
  requestId: string;
  type: TType;
  payload: TPayload;
};

export type HostResponse<TType extends string, TPayload> = {
  protocolVersion: 1;
  requestId: string;
  type: TType;
  ok: true;
  payload: TPayload;
};

export type HostErrorResponse = {
  protocolVersion: 1;
  requestId: string;
  type: "error";
  ok: false;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    details?: unknown;
  };
};
```

Core webview-to-host messages:

- `webview.ready`
- `repo.refresh`
- `status.list`
- `diff.open`
- `diff.applyHunk`
- `changes.stage`
- `changes.unstage`
- `changes.rollback`
- `commit.create`
- `branch.list`
- `branch.checkout`
- `branch.create`
- `log.query`
- `log.fileDiff`
- `merge.openFile`
- `merge.resolveBlock`
- `merge.editResult`
- `merge.apply`
- `operation.continue`
- `operation.abort`

Core host-to-webview events:

- `repo.snapshot`
- `status.snapshot`
- `operation.changed`
- `log.result`
- `diff.result`
- `merge.document`
- `merge.applyResult`
- `notification`
- `error`

Request lifecycle:

1. Webview sends intent with `requestId`.
2. Host validates protocol version and schema.
3. Host validates repository and target.
4. Host executes service operation.
5. Host sends response.
6. Host sends updated snapshots for affected surfaces.

### 12.10 Merge Studio Technical Design

Stage mapping:

- Stage 1 is base.
- Stage 2 is ours/local/current branch.
- Stage 3 is theirs/incoming/other branch.

Context labels:

- Merge: left is Local, right is Incoming.
- Pull: left is Local, right is Remote.
- Rebase: left is Current Commit or Local Patch, right is New Base depending on
  Git stage semantics detected for the paused rebase.
- Cherry-pick: left is Current Branch, right is Cherry-picked Commit.
- Unstash/Patch: left is Working Tree, right is Applied Change.

The UI should use user-friendly labels from operation context, but the engine
must keep stage identities explicit.

Input construction:

1. Resolve repo and conflict file.
2. Read `git show :1:<path>` for base when present.
3. Read `git show :2:<path>` for ours when present.
4. Read `git show :3:<path>` for theirs when present.
5. Read working-tree file only for marker fallback or dirty recovery context.
6. Detect EOL style and final newline.
7. Build `MergeDocument`.

Result buffer:

- Initial result is built from base plus automatically safe non-conflicting
  changes.
- `both_same` blocks can be marked auto-resolved.
- Conflict blocks start unresolved.
- Manual edits update only result lines and mark affected block `manual` when
  it no longer contains conflict markers and passes block validation.

Resolved block detection:

- A block is resolved when `resolvedBy` is not `none`.
- A manually edited block is resolved only when:
  - The result range is valid.
  - The result contains no raw conflict markers.
  - The edit does not corrupt neighboring block ranges.
- A reset block returns to `resolvedBy: "none"` for conflicts.
- Non-conflicting blocks are resolved by construction unless the user resets or
  edits them.

Write and stage flow:

1. User clicks Apply.
2. Webview sends `merge.apply` with merge document ID, result hash, and current
   result text.
3. Host verifies document ID and result hash against latest known document.
4. Host validates no raw conflict markers remain.
5. Host writes result text to the working-tree file.
6. If `autoStageOnResolved` is enabled, host runs `git add -- <path>`.
7. Host refreshes conflict list and operation state.
8. If no conflicts remain, host offers Continue for rebase/cherry-pick or leaves
   merge ready for commit.

When to call `git add`:

- Call `git add` after Apply when all conflicts in that file are resolved and
  auto-stage is enabled.
- Do not call `git add` on Save-only behavior.
- Do not call `git add` if the result still contains markers.
- Do not call `git add` if write failed.
- Do not call `git add` for binary conflict fallback unless the chosen file
  version was written successfully.

Dirty handling:

- Save writes the current result draft but does not finish resolution.
- Cancel with dirty draft requires confirmation.
- Apply finishes the file resolution flow.
- Abort delegates to Git operation abort and then refreshes all state.

### 12.11 Full Build Contract

The implementation target is the full GitView Git experience described in this
document. The product spec requires the complete scope.

Required implementation domains:

1. Repository and workspace foundation.
2. Git command execution layer.
3. Status, staging, and changelist workflows.
4. Commit and commit-and-push workflows.
5. Fetch, pull, update, and push workflows.
6. Branch, tag, and worktree workflows.
7. Log, history, blame, and history-editing workflows.
8. Diff viewer workflows.
9. Conflict detection and Merge Studio workflows.
10. Merge, rebase, cherry-pick, revert, reset, rollback, and drop workflows.
11. Stash, shelf, and patch workflows.
12. Hosted review workflows.
13. Settings, protected branches, safety, and provider integration.

Implementation order may follow the phases in section 10. Every domain above
must be designed, implemented, and tested for the full product.

Full build success criteria:

- Works on macOS, Windows, and Linux.
- Covers nested repositories and multi-root workspaces.
- Handles real repositories with local changes, staged changes, branches, tags,
  worktrees, conflicts, stashes, shelves, patches, and hosted review.
- Provides recovery for interrupted merge, rebase, cherry-pick, revert, patch,
  and unstash operations.
- Has integration tests for every Git mutation class.
- Has UI tests for every product surface.
- Has documented product exceptions for any behavior that cannot be implemented
  exactly because of host-platform or provider limitations.

### 12.12 Non-Functional Requirements

Performance:

- `git status` refresh should complete under 500 ms for small repositories and
  remain responsive for large repositories through debouncing and cancellation.
- Log queries must be paginated.
- Diff rendering must support large-file fallback.
- Webview updates must be incremental snapshots, not full app reloads.
- Avoid running multiple expensive Git commands for the same repo concurrently
  unless they are read-only and cancellable.

Reliability:

- Every mutation refreshes repository state afterward.
- Long-running operations expose pending state.
- Canceled operations refresh state before showing the next action.
- Webview reload can reconstruct state from host snapshots.

Security and privacy:

- No telemetry by default.
- If telemetry is ever added, it must be opt-in and must not include repository
  paths, file names, branch names, commit messages, remotes, or code content.
- Never log tokens, credentials, or credential-helper output.
- Avoid logging absolute paths unless debug logging is explicitly enabled.
- Hosted provider tokens must use VS Code SecretStorage or provider auth APIs.

Cross-platform:

- Support macOS, Windows, and Linux.
- Normalize repository-relative paths to POSIX separators for Git payloads.
- Preserve native absolute paths only inside the extension host.
- Handle CRLF and LF.
- Handle case-insensitive filesystems.
- Avoid shell-specific commands.

Accessibility:

- All tree, list, diff, and merge actions must be keyboard reachable.
- Icon-only actions require tooltips and accessible labels.
- Color cannot be the only indicator of status or conflict state.
- Focus should return predictably after dialogs.

Observability:

- Provide debug output channel for Git command start/end, duration, exit code,
  and structured error code.
- Redact sensitive values.
- Include request IDs to connect webview actions with host operations.

### 12.13 Implementation Rules For AI Agents

- Implement one full-coverage phase at a time while preserving the complete target
  scope.
- Do not remove or omit any feature domain from the spec without an explicit
  product exception.
- Do not call Git from webview code.
- Do not construct shell command strings.
- Do not trust webview-provided paths or refs.
- Do not mutate files outside repository root.
- Every Git mutation requires an integration test with a real temporary repo.
- Every webview workflow requires a visible UI test or component test.
- Any product exception must be added to this spec before implementation.


## 13. Full Agent-Ready Implementation Addendum

This addendum makes the spec executable for a code agent. It adds implementation
contracts for repository resolution, command preconditions, partial commits,
changelists, merge resolution, provider review, persistence, testing, and
release completeness.

### 13.1 Required Technology Stack

Extension host:

- TypeScript.
- VS Code Extension API.
- Git CLI execution through `child_process.spawn` or a small typed wrapper.
- No shell command interpolation.
- No direct mutation outside the extension host.

Webview:

- React.
- Tailwind CSS using VS Code theme tokens.
- TypeScript.
- A lightweight state store such as Zustand, Jotai, or reducer-based React
  state. Do not introduce heavy global state unless required.
- Monaco/editor integration may use VS Code custom editors, readonly virtual
  documents, or webview-side editor widgets depending on the surface.

Testing:

- Unit tests: Vitest or Jest.
- Extension integration tests: VS Code extension test runner.
- Git integration tests: real temporary repositories created per test.
- Webview/component tests: Playwright component testing, Testing Library, or an
  equivalent test harness.
- End-to-end smoke tests: VS Code test instance with the extension loaded.

Build:

- Bundler: `esbuild`, `vite`, or equivalent.
- Separate bundles for extension host and webview.
- Webview CSP must be strict.
- Production build must not require remote assets.

### 13.2 VS Code Theme Integration

GitView UI must inherit the active VS Code theme.

Required rules:

- Use VS Code CSS variables for foreground, background, list, tree, editor,
  badge, button, input, focus, selection, and error colors.
- Do not hardcode light/dark colors except neutral opacity overlays derived from
  theme variables.
- Support high contrast themes.
- Use Lucide icons as the default product icon set for all Git actions, tree
  items, toolbar buttons, dialogs, and review surfaces.
- Use VS Code codicons only where they are necessary for native VS Code
  integration points or where a VS Code command/menu convention expects them.
- Provide GitView-owned fallback icons only when Lucide does not cover a required
  Git concept.
- Follow the VS Code font family and font size unless the user configures a
  GitView-specific density override.

Required CSS token examples:

```css
:root {
  --gitview-bg: var(--vscode-sideBar-background);
  --gitview-fg: var(--vscode-foreground);
  --gitview-border: var(--vscode-panel-border);
  --gitview-list-hover: var(--vscode-list-hoverBackground);
  --gitview-list-active: var(--vscode-list-activeSelectionBackground);
  --gitview-input-bg: var(--vscode-input-background);
  --gitview-button-bg: var(--vscode-button-background);
  --gitview-danger: var(--vscode-errorForeground);
}
```

Density requirements:

- Toolbars: compact height.
- Trees: compact rows with keyboard navigation.
- Diff and merge views: maximize code area over explanatory text.
- Empty states: one-line title plus optional one-line action.

### 13.2.1 Icon System

GitView uses Lucide as the default icon system.

Required rules:

- Use Lucide icons for toolbar actions, tree items, branch actions, diff actions,
  conflict actions, temporary-work actions, hosted review actions, and status
  indicators.
- Icons must inherit VS Code theme colors through CSS variables; do not hardcode
  third-party branded colors or branded icon palettes.
- Icon size should follow GitView density tokens and default to compact IDE sizing.
- Icon-only buttons require accessible labels and tooltips.
- If Lucide does not contain a suitable icon, create a GitView-owned simple SVG in
  the same stroke style and document it in `gitviewCustomIcons.ts`.
- Do not import, trace, redraw, or screenshot third-party icons.
- Do not use remote icon assets. Production builds must bundle all icons.

### 13.2.2 GitView Copy And Documentation Ownership

GitView may match target workflow semantics but must write its own UI copy,
command labels, descriptions, settings text, tooltips, docs, and error messages.

Required rules:

- UI copy should be concise, IDE-like, and action-oriented.
- Documentation should explain GitView workflows in GitView terminology.
- Do not copy third-party docs, help text, tooltip text, menu labels verbatim, or
  marketing copy.
- Equivalent workflow labels may use generic Git language such as Commit, Push,
  Pull, Rebase, Merge, Shelf, Stash, Changelist, Branch, Tag, Worktree, Log, and
  Blame.

### 13.3 Project Package Layout

The implementation should use a shared package boundary for host/webview
contracts.

```text
gitview/
  package.json
  tsconfig.json
  src/
    extension.ts
    activation.ts
    commands/
    services/
    state/
    storage/
    review/
    telemetry/
    webviewHost/
  webview/
    index.html
    src/
      main.tsx
      apps/
      components/
      hooks/
      stores/
      styles/
  shared/
    protocol/
    schemas/
    types/
    errors/
    constants/
  test/
    unit/
    integration/
    fixtures/
    webview/
  resources/
    icons/
    lucide.ts
    gitviewCustomIcons.ts
  docs/
    guide/
    reference/
    contribute/
    maintainers/
```

Rules:

- `shared/` must not import VS Code APIs.
- `webview/` must not import Node, filesystem, child process, or Git services.
- `src/services/git` must not import React/webview code.
- All protocol payloads must be serializable and schema-validated.
- Any command that mutates Git must go through `GitService`.

### 13.4 Activation Events And Contributions

The extension must activate when useful but avoid expensive startup work.

Required contribution points:

- Commands for all section 7 navigation actions.
- View container or views for GitView Git surfaces.
- SCM/title/menu/context contributions where appropriate.
- Explorer context menu entries for file/folder Git actions.
- Editor context menu entries for file, hunk, and selection actions.
- Configuration schema for GitView settings.
- Authentication integration for hosted providers when implemented.

Recommended activation events:

```json
{
  "activationEvents": [
    "onStartupFinished",
    "onCommand:gitView.openGit",
    "onCommand:gitView.openChanges",
    "onCommand:gitView.showHistory",
    "onCommand:gitView.openConflictResolver",
    "workspaceContains:**/.git"
  ]
}
```

Startup behavior:

- Register commands immediately.
- Discover repositories lazily.
- Start watchers only after workspace trust is confirmed.
- Avoid running full log queries during activation.
- Refresh status after initial repository discovery.

### 13.5 Settings Schema

Required settings:

```ts
export type GitViewSettings = {
  gitExecutablePath: string | null;
  mode: "staging" | "changelist";
  updateStrategy: "merge" | "rebase" | "ff_only" | "reset";
  temporaryWorkStrategy: "shelf" | "stash";
  autoFetch: boolean;
  autoFetchIntervalSeconds: number;
  protectedBranchPatterns: string[];
  confirmDestructiveActions: boolean;
  allowSkipHooks: boolean;
  commitSignOffDefault: boolean;
  gpgSigningDefault: boolean;
  restoreWorkspaceOnBranchSwitch: boolean;
  crlfWarnings: boolean;
  diffWhitespaceMode: "show_all" | "ignore_all" | "ignore_eol" | "ignore_space_change";
  diffDefaultViewMode: "side_by_side" | "unified";
  mergeAutoStageOnResolved: boolean;
  logPageSize: number;
  debugLogging: boolean;
};
```

Default settings:

```json
{
  "gitView.gitExecutablePath": null,
  "gitView.mode": "staging",
  "gitView.updateStrategy": "merge",
  "gitView.temporaryWorkStrategy": "shelf",
  "gitView.autoFetch": false,
  "gitView.autoFetchIntervalSeconds": 180,
  "gitView.protectedBranchPatterns": [
    "main",
    "master",
    "release/*",
    "hotfix/*",
    "production"
  ],
  "gitView.confirmDestructiveActions": true,
  "gitView.allowSkipHooks": false,
  "gitView.commitSignOffDefault": false,
  "gitView.gpgSigningDefault": false,
  "gitView.restoreWorkspaceOnBranchSwitch": true,
  "gitView.crlfWarnings": true,
  "gitView.diffWhitespaceMode": "show_all",
  "gitView.diffDefaultViewMode": "side_by_side",
  "gitView.mergeAutoStageOnResolved": true,
  "gitView.logPageSize": 200,
  "gitView.debugLogging": false
}
```

Settings rules:

- Settings are read by the host, not trusted from webview state.
- Settings changes refresh affected surfaces.
- Protected branch checks must use the latest effective settings.
- Debug logging must redact sensitive content even when enabled.

### 13.6 Repository Resolution Algorithm

Repository resolution order:

1. Explicit repo ID from command/webview payload.
2. Selected SCM resource URI.
3. Explorer context URI.
4. Active editor URI.
5. Active terminal working directory when safe and available.
6. Workspace folder containing the resource.
7. First discovered repository only for non-mutating global views.
8. Ask user to choose repository when multiple valid repositories remain.

Nested repository rule:

- The deepest Git repository containing the resource wins.
- Parent repository must not receive mutations for files inside nested child
  repositories.
- Multi-root destructive actions must show all affected roots and require
  confirmation.

Validation:

- Resolve symlinks where possible.
- Normalize drive letters on Windows.
- Reject paths that escape repo root.
- Reject UNC or special paths unless explicitly supported and tested.
- Handle Git worktree `.git` file format by resolving the real Git dir.

Repository snapshot requirements:

- Root path.
- Git dir path.
- Worktree common dir when applicable.
- Current branch or detached HEAD.
- HEAD SHA.
- Upstream.
- Ahead/behind.
- Operation state.
- Dirty summary.
- Conflict count.
- Last refresh time.
- Trust state.

### 13.7 Git Version And Capability Detection

On first use of a Git executable:

- Run `git --version`.
- Parse semantic version when possible.
- Cache capability flags per executable path.
- Feature-detect important commands/flags.

Required capability flags:

```ts
export type GitCapabilities = {
  versionText: string;
  supportsSwitch: boolean;
  supportsRestore: boolean;
  supportsWorktree: boolean;
  supportsPathspecFromFile: boolean;
  supportsPorcelainV1Z: boolean;
  supportsMergeBaseForkPoint: boolean;
  supportsCommitGpgSign: boolean;
};
```

Fallback policy:

- Prefer `git switch`; fallback to `git checkout`.
- Prefer `git restore`; fallback to `git checkout -- <path>` and
  `git reset HEAD -- <path>` where safe.
- If worktree commands are unsupported, show `GIT_VERSION_UNSUPPORTED`.
- If a provider feature is unsupported, disable the action with a reason.

### 13.8 Status Parsing Contract

Use `git status --porcelain=v1 -z -b` as the primary status source.

Branch header parsing:

- `## main...origin/main [ahead 2, behind 1]`
- `## HEAD (no branch)`
- `## No commits yet on main`
- Missing upstream means ahead/behind is null.

Status entry parsing:

- Status code has index status `X` and working-tree status `Y`.
- Paths are NUL-delimited.
- Rename/copy entries include two paths.
- Untracked files use `??`.
- Ignored files use `!!`.
- Unmerged statuses include combinations like `UU`, `AA`, `DD`, `AU`, `UA`,
  `DU`, `UD`.

Status mapping:

| Porcelain | GitView state |
| --- | --- |
| ` M` | Modified unstaged |
| `M ` | Modified staged |
| `MM` | Modified staged and unstaged |
| `A ` | Added staged |
| ` A` | Added unstaged intent depending on Git result |
| `D ` | Deleted staged |
| ` D` | Deleted unstaged |
| `R ` | Renamed staged |
| `C ` | Copied staged |
| `??` | Unversioned |
| `!!` | Ignored |
| `UU` | Both modified conflict |
| `AA` | Both added conflict |
| `DD` | Both deleted conflict |
| `AU` | Added by us |
| `UA` | Added by them |
| `DU` | Deleted by us |
| `UD` | Deleted by them |

Rules:

- Do not infer resolved conflict from marker absence.
- A file leaves the conflict group only after Git status no longer reports an
  unmerged status.
- Folder status is derived from child entries.
- Ignored files are hidden unless enabled.
- Unversioned files are never selected for commit by default.

### 13.9 Diff Engine Contract

Diff sources:

```ts
export type DiffSource =
  | { type: "working_tree"; repoId: string; path: string }
  | { type: "staged"; repoId: string; path: string }
  | { type: "revision_file"; repoId: string; rev: string; path: string }
  | { type: "revision_pair"; repoId: string; leftRev: string; rightRev: string; path?: string }
  | { type: "branch_pair"; repoId: string; leftBranch: string; rightBranch: string; path?: string }
  | { type: "patch"; repoId: string; patchId: string }
  | { type: "review"; provider: string; reviewId: string; fileId: string };
```

Diff output:

```ts
export type DiffDocument = {
  id: string;
  repoId: string;
  source: DiffSource;
  mode: "side_by_side" | "unified";
  filePath: string;
  oldPath?: string;
  binary: boolean;
  tooLarge: boolean;
  leftTitle: string;
  rightTitle: string;
  hunks: DiffHunk[];
  stats: { additions: number; deletions: number };
  warnings: string[];
};

export type DiffHunk = {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  applicableActions: DiffHunkAction[];
};

export type DiffLine = {
  type: "context" | "add" | "delete";
  oldLine: number | null;
  newLine: number | null;
  text: string;
};
```

Large-file policy:

- If the file exceeds configured size or line-count thresholds, show a fallback.
- Offer open file, open external diff, or show raw diff if safe.
- Do not attempt syntax highlighting on huge diffs.
- Do not render binary content as text.

Whitespace policy:

- Display mode and navigation mode must both honor the selected whitespace
  option.
- Hunk apply/revert must still operate on exact patch context.
- If whitespace-ignore makes patch application ambiguous, disable hunk mutation
  and explain why.

### 13.10 Hunk And Line Mutation Contract

Supported mutations:

- Stage hunk.
- Unstage hunk.
- Rollback hunk.
- Stage selected lines.
- Unstage selected lines.
- Rollback selected lines.
- Move hunk/lines to changelist.
- Commit selected hunks/lines.

Implementation rules:

- Generate a minimal patch for selected hunks or lines.
- Validate patch applies against the expected source.
- Use `git apply --cached` for staging.
- Use `git apply --reverse` for rollback where safe.
- For line-level operations, construct a synthetic hunk with sufficient context.
- If a patch no longer applies, refresh the diff and show stale action state.
- Never apply a hunk action to a whole file unless explicitly requested.

Rollback rules:

- Rollback must never delete untracked files without explicit confirmation.
- Rollback selected lines must preserve unrelated local edits.
- Rollback failure must leave the file unchanged or surface partial state
  recovery if Git changed anything.

### 13.11 Partial Commit Technical Contract

Partial commit must preserve unselected working tree and index content.

Modes:

1. Staged commit mode:
   - Commit real index.
   - Use `git commit`.
   - Leaves unstaged content untouched.

2. File-only commit mode:
   - Use safe path-limited commit if it matches desired semantics.
   - Validate unselected paths remain unchanged.

3. Hunk/line/changelist commit mode:
   - Use a temporary index or equivalent commit-tree workflow.
   - Do not disturb real index or working tree.

Recommended temp-index flow for hunk/line commits:

1. Record current HEAD SHA.
2. Create temporary index file.
3. Populate temporary index from HEAD tree:
   - `GIT_INDEX_FILE=<temp> git read-tree HEAD`
4. Apply selected patch to temporary index:
   - `GIT_INDEX_FILE=<temp> git apply --cached <selected.patch>`
5. Validate temp index diff matches selected scope:
   - `GIT_INDEX_FILE=<temp> git diff --cached`
6. Write tree:
   - `GIT_INDEX_FILE=<temp> git write-tree`
7. Create commit:
   - `git commit-tree <tree> -p HEAD`
8. Update branch ref atomically:
   - `git update-ref refs/heads/<branch> <newCommit> <oldHead>`
9. Refresh status.

Rules:

- Do not use this flow on detached HEAD without explicit support.
- Do not update ref if HEAD changed since step 1.
- Do not lose staged changes in the real index.
- If hooks must run for temp-index commits, implement a hook-compatible flow or
  block with a clear product exception. Do not silently skip hooks.
- Commit message validation, author override, sign-off, and signing must apply.
- On failure, delete temp index and leave working tree and real index unchanged.

Amend partial commit:

- Must be designed separately.
- It must preserve unselected content.
- It must not rewrite protected branches unless allowed.
- It must show pushed-commit warning when amending a published commit.

### 13.12 Changelist Implementation Contract

Changelists are GitView-owned local organization metadata. They do not change Git
history by themselves.

Persistence:

- Store changelist metadata in VS Code workspace storage by default.
- Optional project-shared storage may be added later only with explicit user
  opt-in.
- Do not write `.gitview` files into repositories by default.

File-level assignment:

```ts
export type ChangeAssignment = {
  repoId: string;
  changelistId: string;
  path: string;
  oldPath?: string;
  scope: "file" | "hunk" | "line";
  diffBase: "HEAD" | "index" | "working_tree";
  hunkId?: string;
  lineRanges?: LineRange[];
  contentHash: string;
  createdAt: number;
  updatedAt: number;
};
```

Hunk/line assignment rules:

- Assignments must be anchored by path, diff base, hunk header, and content hash.
- On status refresh, assignments are reconciled against the current diff.
- If a hunk changes and cannot be matched safely, mark assignment as stale.
- Stale assignments must be visible and must not be committed silently.
- Moving a hunk to a changelist does not alter the file unless the selected UI
  mode explicitly applies patch partitioning.
- Committing a changelist commits only its current valid assignments.

Changelist deletion:

- Deleting an empty changelist is immediate.
- Deleting a changelist with assignments asks where to move them:
  - Default changelist.
  - Another changelist.
  - Cancel.

### 13.13 Shelf Technical Contract

Shelf is GitView-owned temporary work storage, separate from Git stash.

Storage:

- Store shelf entries under VS Code workspace storage or extension global
  storage, grouped by workspace identity and repo ID.
- Shelf content should be stored as patch files plus metadata.
- Do not store credentials or remote URLs in shelf metadata.

Shelf entry model:

```ts
export type ShelfEntry = {
  id: string;
  repoId: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  baseHeadSha: string;
  files: ShelfFile[];
  patchPath: string;
  reusable: boolean;
};

export type ShelfFile = {
  path: string;
  oldPath?: string;
  status: GitFileStatusKind;
  binary: boolean;
};
```

Shelve flow:

1. User selects file, hunk, line, or changelist scope.
2. Generate patch representing selected scope.
3. Store patch and metadata.
4. Apply reverse patch to working tree or index depending on selected scope.
5. Refresh status.
6. Show shelf entry in Temporary Work.

Unshelve flow:

1. Preview shelf entry.
2. Validate target repository.
3. Validate base compatibility.
4. Apply patch to working tree or selected changelist.
5. If conflicts occur, open patch conflict preview or Merge Studio where
   possible.
6. Keep shelf entry reusable unless user chose delete after apply.

### 13.14 Stash Contract

Git stash must remain CLI-compatible.

Required commands:

- List: `git stash list --format=...`
- Show details: `git stash show --name-status stash@{n}`
- Apply: `git stash apply stash@{n}`
- Pop: `git stash pop stash@{n}`
- Drop: `git stash drop stash@{n}`
- Create selected-scope stash:
  - Prefer pathspecs and patch creation where supported.
  - If selected hunk/line stash cannot be represented safely as Git stash,
    use GitView shelf and label it clearly.

Rules:

- Include untracked files only when selected.
- Never include ignored files unless explicitly selected and supported.
- Pop failure must keep the stash if Git keeps it.
- Conflicts from apply/pop must appear in Changes and Merge Studio.

### 13.15 Patch Contract

Patch create:

- From local changes.
- From staged changes.
- From selected files.
- From selected hunks/lines.
- From commit.
- From commit range.
- From review changes where provider permits.

Patch apply:

- From file.
- From clipboard.
- From shelf import.
- With preview.
- With strip prefix.
- With base directory mapping.
- With whitespace options.

Patch safety:

- Preview changed files before apply.
- Reject paths escaping repo root.
- Detect binary patches.
- Show apply failures by file.
- Do not partially apply without showing recovery state.
- Offer reverse patch only when safe.

### 13.16 Branch, Tag, And Worktree Contract

Branch commands must surface risk.

Branch operations:

- Create.
- Checkout.
- Checkout and update.
- Smart checkout.
- Force checkout.
- Rename.
- Delete.
- Compare.
- Merge.
- Rebase.
- Favorite.
- Track remote branch.

Branch metadata:

- Current.
- Local/remote.
- Upstream.
- Ahead/behind.
- Protected.
- Favorite.
- Last used timestamp.

Tag operations:

- Create lightweight tag.
- Create annotated tag.
- Reassign tag only with explicit destructive confirmation.
- Checkout tag with detached HEAD warning.
- Push tag.
- Delete local tag.
- Delete remote tag with confirmation.
- Compare tag.

Worktree operations:

- List worktrees.
- Create from existing branch.
- Create from new branch.
- Choose location.
- Open worktree.
- Remove worktree.
- Prune stale metadata where safe.

Worktree safety:

- Do not remove dirty worktree without explicit confirmation.
- Do not create worktree inside another repository unless explicitly confirmed.
- Detect locked worktrees and show reason.
- Surface branch already checked out in another worktree.

### 13.17 Log And Commit Graph Contract

Log queries must be paginated and cancelable.

Primary command pattern:

```text
git log --date=iso-strict --decorate=full --parents --numstat --name-status
```

Graph requirements:

- Show commit rows with subject, author, date, refs, and graph lanes.
- Graph lanes must stay stable while paginating.
- Selecting a commit loads changed files and details.
- Filters must not reset selected commit unless it disappears.
- Path filter must support file and folder history.
- Rename following uses Git where available and shows when rename tracking is
  approximate.

History actions:

- Cherry-pick.
- Revert.
- Reset.
- Create branch.
- Create tag.
- Create patch.
- Get file from revision.
- Compare.
- Interactive rebase.
- Edit message.
- Squash/fixup/drop.
- Undo last commit.

Safety:

- Rewriting pushed commits requires warning.
- Protected branches block unsafe rewrite.
- Revert is the default safe alternative for shared history.

### 13.18 Interactive Rebase Contract

Interactive rebase is required in full scope.

UI requirements:

- List commits in rebase range.
- Actions: pick, reword, edit, squash, fixup, drop.
- Reorder commits.
- Show commit details and diff.
- Validate sequence.
- Start rebase.
- Continue/skip/abort interrupted rebase.
- Show conflicts in Merge Studio.

Implementation options:

- Use Git sequence editor integration with a generated todo file when safe.
- Or use a controlled rebase workflow backed by Git commands.
- The user must see the final todo list before execution.
- Protected branches block unsafe rebase by default.

Recovery:

- If rebase stops, operation state must remain visible.
- Continue is enabled only when Git preconditions are satisfied.
- Abort must be available when Git supports it.
- Conflict resolution must flow through Merge Studio.

### 13.19 Merge/Rebase/Cherry-Pick/Revert Recovery Contract

Operation detection files:

- Merge: `MERGE_HEAD`.
- Rebase: `rebase-merge` or `rebase-apply`.
- Cherry-pick: `CHERRY_PICK_HEAD`.
- Revert: `REVERT_HEAD`.
- Bisect: `BISECT_LOG` or Git bisect state.

Required recovery actions:

- Continue.
- Skip where valid.
- Abort where valid.
- Open conflicts.
- Show operation explanation.
- Show affected commit/ref when available.

Rules:

- Do not hide interrupted operation after VS Code reload.
- Do not allow unrelated dangerous mutations while an operation is interrupted
  unless explicitly safe.
- All recovery actions refresh status afterward.

### 13.20 Merge Studio Edge Cases

Required edge cases:

- Both modified.
- Both added.
- Both deleted.
- Deleted by us.
- Deleted by them.
- Added by us.
- Added by them.
- Rename/rename.
- Rename/delete.
- Binary conflicts.
- Submodule conflicts.
- File mode conflicts.
- Symlink conflicts.
- CRLF/LF conflicts.

Binary conflict behavior:

- Do not render as text.
- Show available stages.
- Allow choose ours or theirs where safe.
- Write selected version.
- Stage only after selected version is written successfully.

Deleted conflict behavior:

- Show delete/keep choices.
- Confirm if resolution deletes a file.
- Use Git stage information rather than marker parsing.

Rename conflict behavior:

- Show source and target paths.
- Allow choose path when Git requires it.
- Avoid silent overwrite.

### 13.21 Hosted Review Provider Architecture

Provider interface:

```ts
export interface ReviewProvider {
  id: "github" | "gitlab" | string;
  displayName: string;
  isAvailable(repo: Repository): Promise<boolean>;
  authenticate(repo: Repository): Promise<AuthState>;
  listReviews(repo: Repository, filters: ReviewFilters): Promise<ReviewItem[]>;
  getReview(repo: Repository, id: string): Promise<ReviewDetails>;
  listReviewFiles(repo: Repository, id: string): Promise<ReviewFile[]>;
  getReviewDiff(repo: Repository, id: string, fileId: string): Promise<DiffDocument>;
  checkoutReviewBranch(repo: Repository, id: string): Promise<void>;
  createComment(repo: Repository, input: ReviewCommentInput): Promise<ReviewComment>;
  createSuggestion(repo: Repository, input: ReviewSuggestionInput): Promise<ReviewComment>;
  submitReview(repo: Repository, input: SubmitReviewInput): Promise<void>;
  mergeReview(repo: Repository, input: MergeReviewInput): Promise<void>;
}
```

Provider requirements:

- GitHub and GitLab are first-class provider targets.
- Provider modules must respect auth and permissions.
- Provider actions that are unsupported must be disabled with visible reason.
- Pending comments remain local and visible until submitted.
- Tokens are stored in VS Code SecretStorage or official authentication APIs.
- Tokens and review bodies must not be logged.

Review UX requirements:

- Review list.
- Overview.
- Timeline.
- Changed files.
- Commit filter.
- Diff comments.
- Suggestions.
- Submit review.
- Approve.
- Request changes.
- Merge/squash/rebase where provider permits.
- Close/reopen where provider supports it.
- Delete source branch where provider supports it.

### 13.22 Error Model

Canonical error shape:

```ts
export type GitViewError = {
  code: GitViewErrorCode;
  message: string;
  detail?: string;
  recoverable: boolean;
  severity: "info" | "warning" | "error";
  suggestedActions: SuggestedAction[];
  cause?: {
    gitExitCode?: number;
    stderr?: string;
  };
};

export type GitViewErrorCode =
  | "NO_GIT"
  | "NO_REPO"
  | "UNTRUSTED_WORKSPACE"
  | "DIRTY_WORKTREE"
  | "PROTECTED_BRANCH"
  | "CONFLICTS_FOUND"
  | "AUTH_FAILED"
  | "INVALID_REF"
  | "PATH_OUTSIDE_REPO"
  | "GIT_VERSION_UNSUPPORTED"
  | "PATCH_APPLY_FAILED"
  | "STALE_DIFF"
  | "OPERATION_IN_PROGRESS"
  | "PROVIDER_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "CANCELLED"
  | "UNKNOWN_GIT_ERROR";
```

Error UI rules:

- Inline errors for surface-local problems.
- Bottom notification for completed, failed, or reversible actions.
- Modal confirmation for destructive actions.
- Recovery actions should be shown where possible.
- Never show raw stack traces to users.
- Debug logs may include structured details with redaction.

### 13.23 Confirmation Dialog Contract

Every destructive confirmation must include:

- Action name.
- Repository name.
- Repository root.
- Current branch.
- Target ref or target path.
- Affected commits/files where known.
- Consequence sentence.
- Safer alternative where available.
- Primary destructive action.
- Cancel as default.

Example copy pattern:

```text
Force checkout feature/login?

Repository: app
Current branch: main
Target branch: feature/login

This may discard local changes that cannot be restored automatically.

Safer option: Smart Checkout preserves local changes before switching.

[Cancel] [Smart Checkout] [Force Checkout]
```

Typed confirmation is required for:

- Force push.
- Hard reset on protected branch when user override is allowed.
- Delete dirty worktree.
- Reset to remote.
- Drop multiple commits.

### 13.24 Security And Trust Contract

Workspace trust:

- No Git mutation in untrusted workspace.
- Read-only status may be allowed only if safe and configured.
- Hosted provider auth is disabled in untrusted workspace unless explicitly
  allowed by VS Code trust model.

Path trust:

- Webview paths are untrusted.
- Provider file paths are untrusted.
- Patch paths are untrusted.
- All paths must be canonicalized and repo-contained.

Ref trust:

- Webview refs are untrusted.
- Validate ref existence before mutation.
- Reject refs containing control characters or shell metacharacters even though
  commands use argument arrays.
- Prefer full ref names internally.

Logging:

- Redact tokens, credentials, remote URLs with credentials, code content,
  commit messages, branch names in telemetry, and provider comments.
- Debug output may include command name, duration, exit code, repo ID, and error
  code.
- Absolute paths appear only when debug logging is enabled.

### 13.25 Accessibility Contract

Keyboard:

- All actions must be reachable by keyboard.
- Trees support arrow navigation.
- Diff and merge panes support next/previous change/conflict shortcuts.
- Dialogs trap focus and return focus after close.
- Context menus are keyboard accessible.

Screen reader:

- Icon-only buttons have labels.
- Conflict status is announced.
- Operation status changes are announced through accessible live regions.
- Color is not the only indicator.

Visual:

- Supports high contrast.
- Focus ring uses VS Code focus border.
- Text remains readable at editor font scaling.
- Diff additions/deletions have textual indicators in addition to color.

### 13.26 Test Data And Fixtures

Required fixture repositories:

1. Empty repository.
2. Repository with no commits.
3. Repository with local modifications.
4. Repository with staged and unstaged changes in same file.
5. Repository with untracked and ignored files.
6. Repository with renames and copies.
7. Repository with binary files.
8. Repository with CRLF and LF files.
9. Repository with nested repo.
10. Multi-root workspace with two repos.
11. Repo with remote bare origin.
12. Repo with ahead/behind divergence.
13. Repo with merge conflict.
14. Repo with rebase conflict.
15. Repo with cherry-pick conflict.
16. Repo with revert conflict.
17. Repo with stash conflict.
18. Repo with patch apply conflict.
19. Repo with tags.
20. Repo with worktrees.
21. Repo with large history.
22. Repo with submodule.
23. Repo with protected branch.
24. Repo with detached HEAD.

### 13.27 Integration Test Matrix

Every Git mutation class must have real temporary repository tests.

Required matrix:

| Domain | Required integration tests |
| --- | --- |
| Repository | root resolution, nested repo routing, worktree gitdir, multi-root |
| Status | porcelain parsing, ignored toggle, untracked, staged/unstaged, conflicts |
| Stage | file, hunk, line, stale patch failure |
| Unstage | file, hunk, line, staged-only preservation |
| Rollback | file, hunk, line, untracked delete confirmation |
| Commit | normal, staged, selected files, selected hunk, selected line, amend |
| Commit push | success, rejected push, missing upstream |
| Fetch/pull | fetch no mutation, ff-only fail, merge conflict, rebase conflict |
| Push | upstream setup, tags, force guard, protected branch |
| Branch | create, checkout, smart checkout, force checkout, rename, delete |
| Tag | lightweight, annotated, checkout, push, delete |
| Worktree | list, create, open path, delete clean, block dirty |
| Log | pagination, path filter, author filter, rename following |
| Blame | annotations, open commit, unsupported file |
| Merge Studio | all conflict kinds, manual edit, apply, dirty cancel, binary choose |
| Rebase | start, conflict, continue, skip, abort |
| Cherry-pick | single, multi-select order, conflict recovery |
| Revert | single, multi-select, conflict recovery |
| Reset/drop | soft, mixed, hard guard, protected branch |
| Stash | list, apply, pop, drop, include untracked, conflict |
| Shelf | create, apply, reusable, hunk shelf, conflict |
| Patch | create, preview, apply, strip prefix, map base, reject escape path |
| Review | provider unavailable, auth fail, list, comments, merge disabled reason |

### 13.28 UI Test Matrix

Required UI workflows:

- Git Widget shows branch, detached HEAD, ahead/behind, operation state.
- Changes tree groups local changes correctly in staging mode.
- Changes tree groups local changes correctly in changelist mode.
- Commit panel shows selected scope and validates message.
- Commit and Push shows target remote and outgoing commits.
- Branch popup search, groups, favorite, checkout, smart checkout warning.
- Log loads commits, details, changed files, and diff preview.
- Diff viewer toggles unified/side-by-side and whitespace options.
- Hunk action buttons enable/disable correctly.
- Merge Studio shows panes, conflict counter, actions, manual edit, apply.
- Temporary Work shows stash, shelf, and patch preview.
- Review list and review detail surfaces render provider states.
- Destructive confirmations show required facts.
- Error states show recovery actions.
- Keyboard navigation works on major surfaces.
- High contrast theme remains usable.

### 13.29 Product Exception Registry

If a required behavior cannot be implemented exactly, add an entry here before
shipping.

Exception entry format:

```md
#### PE-YYYY-NNN - <title>

- Status: Proposed | Accepted | Rejected | Resolved
- Feature: <NDX-GIT-ID or surface>
- Behavior required by spec:
- Actual limitation:
- Cause:
- User impact:
- Compensating behavior:
- Tests covering limitation:
- Owner:
- Review date:
```

Default state:

- No product exceptions are accepted at spec approval time.

### 13.30 Full Definition Of Done

The full GitView Git experience is done only when all items below are true.

Product completeness:

- Every section 4 surface exists.
- Every section 5 feature spec is implemented.
- Every full-coverage phase in section 10 is implemented.
- No required workflow exists only as a command palette command.
- Hosted review is first-class.
- Tags, worktrees, stash, shelf, patch, interactive rebase, history editing,
  and Merge Studio are complete.

Technical completeness:

- Git CLI is the source of truth.
- All mutations go through `GitService`.
- Webview never runs Git.
- Protocol is versioned and schema-validated.
- Paths and refs are validated by the host.
- Workspace trust is enforced.
- Protected branch rules are enforced.
- Cross-platform path behavior is tested.

Quality completeness:

- Unit tests pass.
- Integration tests with real temporary repos pass.
- Webview/component tests pass.
- E2E smoke tests pass.
- Large repo scenarios remain responsive.
- High contrast and keyboard accessibility pass.
- Debug logs redact sensitive values.
- Provider tokens are stored securely.

Documentation completeness:

- User-facing command names are documented.
- Settings are documented.
- Known limitations are documented only through Product Exceptions.
- Recovery flows are documented.
- Developer setup and test execution are documented.

### 13.31 Implementation Sequencing Without MVP

The build should still be sequenced to reduce risk, but every sequence belongs
to the full product.

Sequence A — Foundation:

- Extension activation.
- Settings.
- Git executable detection.
- Git execution wrapper.
- Repository discovery.
- Workspace trust enforcement.
- Protocol package.
- Webview shell.
- Status snapshots.
- Debug output channel.

Sequence B — Local Work Core:

- Changes tree.
- Staging/unstaging.
- Diff viewer.
- Hunk/line actions.
- Changelist metadata.
- Commit panel.
- Partial commit engine.
- Rollback.

Sequence C — Sync And Branching:

- Fetch/pull/update/push.
- Commit and push.
- Branch popup.
- Smart checkout/update/merge.
- Protected branch guard.
- Ahead/behind calculation.

Sequence D — History:

- Log graph.
- Commit details.
- Changed files.
- File/folder history.
- Blame.
- Revert/cherry-pick/reset/drop.
- Interactive rebase.
- Tags.
- Worktrees.

Sequence E — Conflict And Recovery:

- Conflict detection.
- Operation state.
- Merge Studio.
- Binary/deleted/rename conflict handling.
- Rebase/cherry-pick/revert recovery.
- Stash conflict recovery.
- Patch conflict preview.

Sequence F — Temporary Work:

- Git stash full workflow.
- GitView shelf full workflow.
- Patch create/apply/import.
- Path mapping and prefix stripping.

Sequence G — Hosted Review:

- Provider registry.
- Auth.
- GitHub provider.
- GitLab provider.
- Review list/detail/timeline.
- Review diff comments.
- Suggestions.
- Submit/approve/request changes.
- Merge actions and disabled reasons.

Sequence H — Hardening:

- Large repo performance.
- Cross-platform path testing.
- Accessibility.
- High contrast.
- Error handling.
- Product exception audit.
- Documentation.

Important:

- These sequences are not MVP slices.
- A sequence may ship internally, but the product target remains full coverage.
- Do not delete later-sequence types, commands, settings, or tests from the code
  structure. Use typed placeholders with visible disabled states only when the
  implementation is not complete yet.


## 14. GitView Git Workflow Coverage Addendum

This section converts the internal product intent into an implementation-grade
coverage checklist.

Internal intent:

- GitView should provide a complete Git workflow experience inside VS Code.
- GitView must express that coverage through GitView-owned names, command IDs,
  implementation, safety policy, VS Code theme-token styling, Lucide icons, and
  GitView-written UI copy.
- GitView must not copy third-party proprietary assets, third-party product names, exact
  trademarked copy, third-party icon artwork, or pixel-identical protected UI.

Practical interpretation:

- Implement workflows, not trademarks.
- Implement interaction depth, not protected artwork; render it with VS Code theme tokens and Lucide icons.
- Implement information architecture, not brand identity.
- Implement safety behavior, not vendor-specific implementation.
- Implement density, keyboard reachability, context-menu richness, and dialog
  decision points using GitView design primitives.

### 14.1 Coverage Definition

A GitView Git behavior is considered covered only when GitView has all of the
following:

1. A visible GitView surface for the behavior.
2. A registered VS Code command where the behavior is command-addressable.
3. A context-menu entry when the behavior is contextual.
4. A keyboard-accessible path.
5. A protected-branch and destructive-action rule when applicable.
6. A state refresh after the action.
7. A real Git integration test for mutations.
8. A UI/component test for the visible workflow.
9. A Product Exception entry if exact behavior is impossible in VS Code.

Coverage does not require:

- Copying icons from third-party products. GitView uses Lucide icons by default, with only product-owned additions when Lucide has no suitable icon.
- Copying branded names or exact product copy from third-party products.
- Copying pixel-identical spacing, typography, or proprietary illustrations.
- Implementing non-Git VCS features unless they are directly needed for Git
  coverage.

### 14.2 GitView Naming For Common Git Concepts

| Common Git concept | GitView-owned concept |
| --- | --- |
| Git widget / branch widget | GitView Git Widget |
| Commit tool window | GitView Commit |
| Local Changes | GitView Changes |
| Git tool window | GitView Git |
| Log tab | GitView Log |
| Branches pane / Branches popup | GitView Branches |
| Diff Viewer | GitView Diff Viewer |
| Merge Tool / Resolve Conflicts | GitView Merge Studio |
| Shelf | GitView Shelf |
| Stash | Git Stash inside GitView Temporary Work |
| Pull Requests tool window | GitView Review |
| Update Project / Update Branch | GitView Update |
| Smart Checkout | GitView Smart Checkout |
| Protected Branches | GitView Protected Branches |

GitView UI may use familiar Git words where they are standard Git concepts:
`branch`, `commit`, `push`, `pull`, `fetch`, `merge`, `rebase`, `stash`, `tag`,
`worktree`, `diff`, `blame`, `cherry-pick`, `revert`, and `reset`.

### 14.3 Global Surface Coverage Rules

GitView must provide practical Git entry points across the places users naturally
expect them:

- Top-level Git commands in Command Palette and menus.
- Git Widget branch/sync popup.
- Git tool window equivalent with Changes, Log, Branches, and Review surfaces.
- Editor gutter and editor context-menu actions where relevant.
- Explorer context-menu actions for file/folder Git workflows.
- Commit surface with changelist and staging modes.
- Conflict dialog entry point plus full three-pane merge resolver.
- Settings surface for Git executable, update strategy, protected branches,
  commit behavior, branch behavior, and provider auth.

For every command:

- If the command acts on a file, folder, branch, commit, or repo, the affected
  target must be visible before execution.
- If the action is useful in multiple places, GitView should expose it in
  all equivalent GitView places unless VS Code prevents it.
- If VS Code prevents an exact menu location, GitView must document the exception
  and provide the closest command-palette/context-menu equivalent.

### 14.4 Git Widget And Branch Popup Coverage

GitView Git Widget must provide a practical branch widget model:

Required visible state:

- Current branch name.
- Detached HEAD state.
- Repository root name in multi-root workspaces.
- Incoming and outgoing counts when upstream exists.
- Current operation state: merge, rebase, cherry-pick, revert, bisect.
- Dirty state indicator.
- Protected-branch indicator.
- Diverged multi-root branch state indicator.

Required popup groups:

- Current repository header.
- Recent branches.
- Local branches.
- Remote branches.
- Tags.
- Common remote branches for multi-root workspaces where branch names overlap.
- Favorite branches.
- Search results.

Required popup actions:

- New Branch.
- New Branch from Selected.
- Checkout.
- Checkout and Update.
- Checkout and Rebase onto Current.
- Smart Checkout.
- Force Checkout.
- Compare with Current.
- Compare with Working Tree.
- Show Diff with Working Tree.
- Show in Log.
- Update Selected Branch.
- Pull into Current using Merge.
- Pull into Current using Rebase.
- Merge into Current.
- Rebase Current onto Selected.
- Rename.
- Delete.
- Push Branch.
- Favorite / Unfavorite.
- Copy Branch Name.

Required multi-root behavior:

- If all selected repositories are on the same branch, show a single branch name.
- If selected repositories differ, show a diverged state with per-repo branches.
- If synchronous branch control is enabled, branch operations apply to matching
  repositories after confirmation.
- If branch exists in some roots but not others, show partial-availability state
  before execution.
- Destructive branch operations in multi-root workspaces must list affected
  repositories.

Required safety behavior:

- Checkout that would overwrite local changes must block by default and offer
  Commit, Rollback, Shelve/Stash, Smart Checkout, or Force Checkout.
- Force Checkout must require destructive confirmation and list affected files
  when known.
- Delete branch must warn about unmerged commits and offer Show in Log.
- Push Branch must show remote and branch, and offer upstream setup when missing.

Acceptance tests:

- Branch popup search finds local, remote, tag, and favorite branches.
- Branch actions appear from Git Widget and Branches pane.
- Smart Checkout preserves dirty work and restores it after checkout.
- Diverged multi-root branch state shows per-repo details.
- Delete unmerged branch opens a warning and does not delete by default.

### 14.5 GitView Changes And Commit Coverage

GitView Changes and GitView Commit must cover the local-change workflow:

Required change groups:

- Default changelist.
- Named changelists.
- Unversioned Files.
- Ignored Files when enabled.
- Staged and Unstaged groups when staging mode is enabled.
- Merge Conflicts.
- Shelf and Stash entry points.

Required changelist behavior:

- Create changelist.
- Rename changelist.
- Delete changelist.
- Set active changelist.
- Add optional changelist comment.
- Track context for changelist.
- Restore tracked context when changelist becomes active.
- Move selected files to changelist.
- Move selected hunks to changelist.
- Move selected lines to changelist.
- Commit selected changelist.
- Preserve unselected changelists during commit.

Required commit selection behavior:

- Selecting the active changelist should select its changes for commit.
- User can include or exclude files from commit scope.
- User can include unversioned files by selecting them; GitView then adds them to
  Git as part of the commit flow.
- User can commit selected files, selected hunks, selected lines, a changelist,
  or staged content.
- Partial commit must leave excluded content in the working tree or index exactly
  as it was before the commit attempt.

Required commit editor behavior:

- Commit message field.
- Recent messages.
- Commit template support.
- Message wrapping guide.
- Empty-message blocking unless explicitly allowed.
- Amend toggle.
- Sign-off option.
- Author override.
- GPG signing option where Git supports it.
- Commit button.
- Commit and Push button.
- Optional post-commit action area.

Required before-commit checks:

- Run Git hooks by default.
- Skip hooks only from advanced option.
- Reformat changed code when enabled.
- Rearrange code when enabled and supported by installed format providers.
- Optimize imports when supported by language tooling.
- Run code cleanup when configured.
- Analyze code / run inspections when configured.
- Check TODOs when configured.
- Run selected test or task configuration when configured.
- Update copyright headers when configured.
- Check for malicious dependencies when supported by configured tooling.
- Show check results before commit when a check fails or warns.

Required commit-and-push behavior:

- After commit, show outgoing commits before push.
- Show target remote and target branch.
- Allow review of commits included in push.
- If push is rejected, keep the commit local and visible as outgoing.
- Offer Update/Rebase/Cancel after rejected push; do not mutate automatically.
- Force push is blocked on protected branches.

Acceptance tests:

- Commit selected unversioned file adds and commits that file only.
- Commit selected changelist leaves other changelists untouched.
- Commit selected lines leaves unselected lines pending.
- Failed hooks leave working tree and index unchanged.
- Commit-and-push failure leaves local commit visible as outgoing.

### 14.6 GitView Log Coverage

GitView Log must match desktop-IDE-style Git history investigation and action flow.

Required panes:

- Branches pane.
- Commit graph pane.
- Changed files pane.
- Commit details pane.
- Diff preview pane.

Required graph and table behavior:

- Show local and remote refs.
- Show tags.
- Show HEAD.
- Show commit subject, author, date, and hash.
- Show root/repository column in multi-root mode.
- Show colored root indicators in multi-root mode using GitView theme tokens.
- Support selecting a commit without resetting filters.
- Support multi-select commits for supported actions.
- Support changed-file selection inside selected commit.

Required filters and search:

- Branch filter.
- Author filter.
- Date filter.
- Path filter.
- Repository root filter.
- Text search.
- Hash/revision search.
- Case-sensitive search toggle.
- Regex search toggle.
- Show only commits affecting selected path.
- Show all branches / current branch / selected branch.
- Hide merge commits.
- Show first parent only.

Required graph display options:

- Sort by date.
- Topological sort.
- Collapse linear branches.
- Expand linear branches.
- Highlight current branch.
- Highlight selected branch.
- Show long refs when needed.
- Compact row density.

Required commit actions:

- Copy Hash.
- Copy Message.
- Show Diff.
- Show Diff with Working Tree.
- Compare with Local.
- Get File from Revision.
- Open Repository Browser / Open in Browser when remote URL is recognized.
- Create Branch from Here.
- Create Tag from Here.
- Cherry-pick.
- Cherry-pick Selected Changes.
- Revert Commit.
- Revert Selected Changes.
- Reset Current Branch to Here.
- Undo Last Commit.
- Edit Commit Message.
- Squash Commits.
- Fixup Commit.
- Drop Commit.
- Drop Selected Changes.
- Start Interactive Rebase from Here.
- Create Patch.

Acceptance tests:

- File history follows renames when Git can provide the data.
- Folder history includes descendant changes.
- Selecting a commit updates files, details, and preview.
- Multi-select cherry-pick preserves commit order.
- Reset and drop actions are blocked or confirmed according to branch safety.

### 14.7 History Editing Coverage

GitView must implement full-featured history cleanup flows.

Required actions:

- Edit commit message for local unpushed commits.
- Squash selected commits.
- Fixup selected commit into previous/specified commit.
- Drop selected commit.
- Drop selected files from a commit.
- Extract selected changes to a separate commit.
- Undo last commit into a selected changelist.
- Reword during interactive rebase.
- Continue, skip, and abort interrupted rebase.

Required safeguards:

- History rewrite actions are blocked on protected branches.
- If a commit has already been pushed, GitView must warn that force push or update
  is required.
- Protected branch actions must offer safe alternatives: revert, new branch, or
  cherry-pick.
- Undo Last Commit must allow selecting target changelist, setting active, and
  enabling context tracking.

Required selected-change history actions:

- From changed files pane, user can revert selected changes from a commit.
- From changed files pane, user can drop selected changes from a local commit.
- From changed files pane, user can cherry-pick selected changes into a
  changelist.
- Each selected-change operation must preview affected files before mutation.

Acceptance tests:

- Undo last commit moves changes into chosen changelist.
- Revert multiple commits creates separate revert commits when configured that
  way.
- Drop selected changes removes only selected files/hunks and preserves the rest
  of the commit history rewrite plan.
- Protected branch blocks rewrite actions and shows alternatives.

### 14.8 Update, Pull, Fetch, Push Coverage

GitView sync behavior must match full-featured remote synchronization.

Required Fetch behavior:

- Fetch selected remote.
- Fetch all remotes.
- Fetch is non-mutating for working tree and index.
- Show fetched branch/tag updates when available.
- Refresh incoming/outgoing state after fetch.

Required Pull behavior:

- Pull selected remote branch into current branch.
- Remember last selected remote/branch choice per repo when appropriate.
- Support merge strategy.
- Support rebase strategy.
- Support fast-forward-only strategy.
- Open conflicts in GitView Merge Studio.
- Dirty working tree must trigger Smart Update or block with alternatives.

Required Update behavior:

- Update current branch.
- Update all repositories in workspace when requested.
- Update whole project / all roots when multi-root mode is active.
- Use configured update strategy: merge, rebase, or reset.
- Reset-based update requires destructive confirmation.
- Show update result, updated files, and conflicts.

Required Push behavior:

- Push current branch.
- Push selected branch.
- Push tags.
- Set upstream when missing.
- Show outgoing commits before push.
- Show rejected push recovery choices.
- Support safe force-with-lease where allowed.
- Block force push on protected branches.

Acceptance tests:

- Fetch does not change working tree or index.
- Pull with conflicts opens Merge Studio.
- Rejected push leaves local commits visible.
- Push with missing upstream opens setup flow.
- Update all roots reports per-root success/failure.

### 14.9 Diff Viewer Coverage

GitView Diff Viewer must support the same practical compare language across local
changes, history, branches, patches, and review.

Required modes:

- Side-by-side.
- Unified.
- Three-pane merge-specific mode through Merge Studio.

Required comparisons:

- Working tree vs HEAD.
- Index vs HEAD.
- Working tree vs index.
- File vs revision.
- File vs branch.
- Revision vs revision.
- Branch vs current branch.
- Branch vs working tree.
- Commit vs parent.
- Commit vs working tree.
- Patch preview.
- Shelf preview.
- Stash preview.
- Review file diff.

Required controls:

- Previous / Next change.
- Previous / Next file.
- Toggle side-by-side/unified.
- Whitespace ignore modes.
- Highlighting modes.
- Collapse unchanged regions.
- Expand context.
- Synchronize scroll.
- Show/hide line numbers.
- Show/hide whitespace.
- Open file in editor.
- Copy selected side content.

Required writable actions:

- Accept hunk.
- Append hunk.
- Revert hunk.
- Stage hunk.
- Unstage hunk.
- Move hunk to changelist.
- Include/exclude hunk from commit.
- Apply selected lines.
- Revert selected lines.

Required fallback behavior:

- Binary files show metadata and safe actions only.
- Large files disable expensive highlighting and show a clear fallback.
- Renames show old and new paths.
- Mode changes show file mode metadata.
- Submodules show commit range instead of text diff.

Acceptance tests:

- Whitespace mode changes both rendering and navigation.
- Hunk action affects only selected hunk.
- Binary file does not render corrupted text.
- Submodule diff shows commit transition safely.

### 14.10 Merge Studio And Conflict Dialog Coverage

GitView must match desktop-IDE-style conflict discovery, conflict dialog, and
three-pane merge resolution.

Required conflict entry points:

- Automatic conflict dialog after pull, merge, rebase, cherry-pick, unstash, or
  patch apply conflicts.
- Manual Resolve Conflicts command from Git Widget, Changes, and context menus.
- Conflict group in GitView Changes.
- Operation recovery banner with Continue/Skip/Abort where valid.

Required conflict dialog actions:

- Accept Yours / Local.
- Accept Theirs / Incoming.
- Merge in Merge Studio.
- Show affected file list.
- Show operation context.
- Cancel without mutating.

Required Merge Studio layout:

- Left pane: local/ours/current side.
- Center pane: editable result.
- Right pane: incoming/theirs side.
- Base comparison available through toolbar when base exists.
- Conflict list/counter.
- Overview ruler.
- Bottom action bar.
- Context menu inside conflict block.

Required Merge Studio actions:

- Previous / Next conflict.
- Apply all non-conflicting changes.
- Apply non-conflicting from left.
- Apply non-conflicting from right.
- Accept left.
- Accept right.
- Ignore left.
- Ignore right.
- Append left.
- Append right.
- Resolve simple conflicts.
- Reset block.
- Compare left with base.
- Compare right with base.
- Compare result with left.
- Compare result with right.
- Search and replace in result.
- Apply.
- Save draft.
- Cancel.
- Abort operation when Git supports it.

Required technical semantics:

- Git index stages are source of truth.
- Stage 1 is base, stage 2 is ours, stage 3 is theirs.
- Marker parsing is fallback only.
- Raw conflict markers must never be written by Apply.
- Manual edits are preserved.
- Dirty Cancel requires confirmation.
- Apply can auto-stage resolved file when configured.
- Binary, deleted/modified, both-added, rename/delete, and mode conflicts must
  have explicit fallback UI.

Acceptance tests:

- Pull, merge, rebase, cherry-pick, unstash, and patch conflicts open the
  correct recovery flow.
- Apply All Non-Conflicting does not resolve true conflicts.
- Manual center-pane edits survive navigation and refresh.
- Result with raw conflict markers cannot be applied.
- Resolved file is staged only when auto-stage setting is enabled.

### 14.11 Shelf, Stash, And Patch Coverage

GitView Temporary Work must match desktop-IDE-style temporary work handling.

Required Shelf behavior:

- Shelf selected files.
- Shelf selected hunks.
- Shelf selected lines.
- Shelf selected changelist.
- Add shelf message.
- Show shelf list.
- Preview shelf contents.
- Unshelve into active changelist.
- Unshelve into selected changelist.
- Unshelve into new changelist.
- Keep shelf after unshelve unless user deletes it.
- Delete shelf.
- Rename/edit shelf message.
- Import patch into shelf.

Required Stash behavior:

- Stash all uncommitted changes.
- Optional message.
- Include untracked files when requested.
- List stashes.
- Preview stash contents.
- Apply stash.
- Pop stash.
- Drop stash.
- Resolve stash conflicts through Merge Studio or patch conflict preview.
- Stashes must remain compatible with Git CLI.

Required Patch behavior:

- Create patch from selected local changes.
- Create patch from changelist.
- Create patch from commit.
- Create patch from selected files in commit.
- Apply patch from file.
- Apply patch from clipboard.
- Preview patch before applying.
- Map base directory.
- Strip path prefixes.
- Apply into selected/new changelist.
- Import patch into shelf.

Acceptance tests:

- Shelf selected hunk preserves other hunks in the working tree.
- Unshelve into new changelist keeps shelf entry reusable.
- Stash created by GitView can be listed and applied by Git CLI.
- Patch path mapping applies to expected files only.

### 14.12 Tags And Worktrees Coverage

Required Tags behavior:

- List local and remote tags.
- Create lightweight tag.
- Create annotated tag.
- Create tag from selected commit.
- Reassign tag with confirmation.
- Checkout tag with detached HEAD warning.
- Compare tag.
- Push tag.
- Push selected tags.
- Delete local tag.
- Delete remote tag when supported and confirmed.

Required Worktrees behavior:

- List worktrees.
- Create worktree from existing branch.
- Create worktree with new branch.
- Choose worktree location.
- Open worktree in new VS Code window/workspace.
- Remove worktree.
- Prune stale worktrees.
- Dirty worktree remove is blocked or explicitly confirmed.
- Show worktree relation in repository identity.

Acceptance tests:

- Checkout tag enters detached HEAD state and widget shows it.
- Pushing selected tags shows exactly which tags will be pushed.
- Worktree create opens selected path.
- Dirty worktree delete requires confirmation.

### 14.13 Blame, Annotation, And Investigation Coverage

Required blame behavior:

- Toggle line annotations.
- Show author, date, hash, and summary.
- Open commit from annotation.
- Open file history from annotation.
- Copy hash from annotation.
- Compare annotated revision with local file.
- Hide annotations.

Required investigation behavior:

- Show file history.
- Show folder history including descendants.
- Show project history.
- Follow renames where Git supports it.
- Open commit in Log from any history or annotation surface.
- Get file from revision.
- Compare file revisions.

Acceptance tests:

- Annotation click focuses the commit in GitView Log.
- File history follows rename when Git can report rename.
- Unsupported files show a clear state.

### 14.14 Hosted Review Coverage

GitView Review must cover desktop-IDE-style GitHub/GitLab PR/MR review workflows
through provider modules.

Required provider support:

- GitHub Pull Requests.
- GitLab Merge Requests.
- Provider registry for future providers.

Required list behavior:

- List reviews.
- Filter by state.
- Filter by author.
- Filter by reviewer.
- Filter by assignee.
- Filter by label.
- Filter by review status.
- Sort by newest, oldest, most commented, least commented, recently updated, and
  least recently updated when provider supports it.
- Refresh list.
- Mark unseen reviews.
- Open in browser.

Required review detail behavior:

- Overview tab.
- Timeline tab.
- Changed files tab.
- Filter changed files by commit.
- Checkout review branch.
- Create local branch from review source branch.
- Open source and target branches.
- Show checks/status when provider exposes them.
- Show merge blocked reason.

Required review interaction behavior:

- Add line comment.
- Add review comment.
- Add suggestion where provider supports it.
- Reply to comments.
- Resolve/unresolve conversation where provider supports it.
- React to comments where provider supports it.
- Submit review.
- Approve.
- Request changes.
- Comment without approval.
- Revoke approval where provider supports it.
- Merge.
- Squash merge.
- Rebase merge.
- Close/reopen review where provider supports it.
- Delete merged source branch where provider supports it.

Required create-review behavior:

- Create pull/merge request from current branch when provider supports it.
- Select target branch.
- Select title and description.
- Load provider template when available.
- Draft review/PR where provider supports it.
- Assign reviewers/assignees/labels where provider supports it.
- Open created review in GitView Review.

Acceptance tests:

- Pending comments stay visibly pending until submitted.
- Merge action disabled state shows provider reason.
- Checkout review branch creates or reuses a local branch safely.
- Provider token is never logged.

### 14.15 Settings Coverage

GitView settings must include required Git workflow controls, expressed
as GitView settings.

Required Git settings:

- Git executable path.
- Auto-detect Git executable.
- Test Git executable.
- Minimum Git version warning.
- WSL Git support on Windows when applicable.
- Update strategy: merge, rebase, fast-forward-only, reset when explicitly
  enabled.
- Auto-fetch.
- Branch grouping.
- Favorite branches.
- Restore workspace/context on branch switch.
- Synchronous branch control for multi-root workspaces.
- Protected branch patterns.
- Force-with-lease preference.
- Warn before committing in detached HEAD.
- Warn before committing during rebase/cherry-pick/revert.
- Cherry-pick commit-message suffix when cherry-picking from protected branches.
- CRLF warning behavior respecting `.gitattributes`.

Required commit settings:

- Use changelist mode or staging mode.
- Run Git hooks by default.
- Allow skip hooks advanced option.
- Before-commit checks configuration.
- Commit message inspections where implemented.
- Commit template handling.
- GPG signing default.
- Sign-off default.

Required diff/merge settings:

- Default diff mode.
- Whitespace mode.
- Collapse unchanged regions.
- Synchronize scroll.
- Auto-apply non-conflicting changes in Merge Studio.
- Auto-stage resolved conflicts.
- Large-file threshold.

Required provider settings:

- GitHub auth.
- GitLab auth.
- Provider host URL for self-hosted GitLab/GitHub Enterprise where supported.
- Token storage through VS Code SecretStorage or provider auth APIs.

Acceptance tests:

- Invalid Git executable is caught before operations.
- Protected branch patterns block unsafe actions.
- CRLF warning respects `.gitattributes`.
- Settings changes update open webviews without reload when possible.

### 14.16 UI Density And Layout Coverage

GitView must feel like a dense professional IDE Git tool, not a web dashboard.

Required layout rules:

- Tool-window density by default.
- Compact tree rows.
- Split panes instead of large cards.
- Toolbar actions with labels where needed and tooltips always.
- Context menus for secondary actions.
- Dialogs for option-heavy flows.
- Bottom or inline notification for operation results.
- Empty states should be compact and action-oriented.

Required styling rules:

- Use VS Code theme variables.
- Use Lucide as the default GitView icon set, with VS Code codicons only for native VS Code integration points; never use third-party assets.
- Do not use marketing copy inside working surfaces.
- Do not use hero panels.
- Color cannot be the only status indicator.
- High-contrast themes must remain usable.

Required behavioral feel:

- Selection changes should update adjacent panes immediately.
- Filters should not reset when selecting commits, branches, or files.
- Long operations show progress without freezing panes.
- Keyboard navigation must work in trees, lists, toolbars, dialogs, diffs, and
  Merge Studio.

### 14.17 Git Workflow Coverage Matrix Requirement

The repository must contain a checked-in coverage matrix file:

```text
docs/maintainers/coverage-matrix.md
```

Each row must include:

- required behavior name.
- GitView behavior name.
- GitView surface.
- GitView command ID.
- Implementation service.
- Git command or provider API used.
- Safety guard.
- Test file.
- Status: not_started, implemented, tested, exception.
- Exception link when applicable.

No feature may be marked complete until its coverage matrix row is implemented and
tested.

### 14.18 Initial Coverage Matrix Rows

The first version of the coverage matrix must include at least these rows:

- Branch popup: local branch checkout.
- Branch popup: remote branch checkout as tracking local branch.
- Branch popup: new branch from selected branch.
- Log: new branch from selected commit.
- Branch popup: Smart Checkout.
- Branch popup: Force Checkout.
- Branch popup: Compare with Current.
- Branch popup: Show Diff with Working Tree.
- Branch popup: Show in Log.
- Branch popup: Rename Branch.
- Branch popup: Delete Branch.
- Branch popup: Push Branch.
- Branch popup: Favorite Branch.
- Multi-root: diverged branch display.
- Multi-root: synchronous branch operation.
- Commit: selected active changelist.
- Commit: selected unversioned files add-and-commit.
- Commit: selected hunks.
- Commit: selected lines.
- Commit: amend.
- Commit: sign-off.
- Commit: author override.
- Commit checks: hooks.
- Commit checks: reformat.
- Commit checks: optimize imports.
- Commit checks: analyze code.
- Commit checks: TODO.
- Commit and Push: outgoing commit preview.
- Pull: selected remote branch.
- Pull: merge strategy.
- Pull: rebase strategy.
- Update: all roots.
- Push: upstream setup.
- Push: rejected push recovery.
- Log: branch filter.
- Log: author filter.
- Log: date filter.
- Log: path filter.
- Log: regex search.
- Log: hide merge commits.
- Log: first parent only.
- Log: collapse linear branches.
- Log: changed files pane.
- Log: diff preview.
- Log: copy hash.
- Log: cherry-pick.
- Log: cherry-pick selected changes.
- Log: revert commit.
- Log: revert selected changes.
- Log: reset current branch to here.
- Log: undo last commit.
- Log: edit commit message.
- Log: squash/fixup/drop.
- Log: drop selected changes.
- Diff: side-by-side.
- Diff: unified.
- Diff: whitespace modes.
- Diff: hunk stage/unstage.
- Diff: selected line apply/revert.
- Conflict dialog: accept local.
- Conflict dialog: accept incoming.
- Conflict dialog: merge.
- Merge Studio: apply all non-conflicting.
- Merge Studio: accept/ignore/append left/right.
- Merge Studio: compare with base.
- Merge Studio: manual result edit.
- Merge Studio: apply resolved file.
- Shelf: shelve selected files.
- Shelf: shelve selected hunk.
- Shelf: unshelve into changelist.
- Stash: stash all.
- Stash: apply/pop/drop.
- Patch: create from local changes.
- Patch: apply from file.
- Patch: apply from clipboard.
- Tags: create annotated tag.
- Tags: checkout tag.
- Tags: push tag.
- Worktrees: create/open/remove.
- Blame: toggle annotations.
- Blame: open commit.
- Review: list PR/MR.
- Review: filter/sort PR/MR.
- Review: overview/timeline.
- Review: changed files by commit.
- Review: line comments.
- Review: suggestions.
- Review: approve/request changes.
- Review: merge/squash/rebase.
- Settings: Git executable test.
- Settings: protected branches.
- Settings: update strategy.
- Settings: before-commit checks.
- Settings: diff/merge behavior.

### 14.19 Product Exception Rules For Coverage

A required behavior may be excepted only when one of these is true:

- VS Code extension APIs do not expose the required host capability.
- The behavior depends on platform-specific platform APIs with no VS Code analogue.
- A provider API does not support the operation.
- Git version installed by the user does not support the required command.
- The behavior would violate GitView safety or privacy rules.

Every exception must include:

- Behavior name.
- Why exact coverage is impossible.
- Closest GitView alternative.
- User impact.
- Test coverage for the fallback.
- Owner and review date.

### 14.20 Full Git Workflow Coverage Acceptance

The product is not considered 1-to-1 workflow complete until:

- The coverage matrix covers every required Git workflow targeted by this spec.
- Every matrix row is implemented, tested, or has an approved product exception.
- All GitView surfaces use GitView-owned names, GitView-written copy, Lucide/GitView-owned icons, and VS Code theme tokens.
- No third-party proprietary assets or protected branded UI are included.
- All destructive workflows have GitView safety confirmation.
- All local-work preservation workflows are covered by integration tests.
- All conflict workflows route to GitView Merge Studio or documented fallback.
- Hosted review supports GitHub and GitLab first-class workflows.
- Multi-root and nested repository behavior is tested for all relevant actions.


## 15. Implementation Prompt For Code Agents

Use the following instruction when handing this specification to an AI coding
agent:

```text
You are implementing GitView Diff, a full-scope VS Code-compatible Git experience.
Read `gitview-git-experience-full-spec.md` as the source of truth.

Do not build an MVP. Build the complete architecture and implement the full
product in the sequence defined by the spec. Each sequence is engineering order,
not optional scope.

Hard constraints:
- Git CLI is the source of truth.
- Webview never executes Git.
- All Git mutations go through the extension host GitService.
- All command arguments are arrays, never shell strings.
- Validate all paths and refs in the host.
- Respect workspace trust and protected branch rules.
- Use React/Tailwind for webview UI.
- Use VS Code theme tokens.
- Implement dense IDE-like tool windows, not dashboard-style UI.
- Do not copy proprietary assets or pixel-identical branded layouts.
- Add real Git integration tests for every mutation.
- Add UI/component tests for every visible workflow.
- Any unsupported required behavior must be recorded as a Product Exception
  before implementation continues.
```
