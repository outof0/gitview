# Extension API

GitView returns a typed API from extension activation. This is the supported
integration boundary for other VS Code extensions; files below the package root
are implementation details unless their types are re-exported from `gitview`.

## Activation

```ts
import * as vscode from "vscode";
import type { GitViewExtensionApi } from "gitview";

const extension = vscode.extensions.getExtension<GitViewExtensionApi>(
  "gitview.gitview",
);
if (!extension) {
  return;
}

const api = await extension.activate();
if (api.apiVersion !== 1) {
  return;
}
```

Declare `gitview.gitview` in your extension's `extensionDependencies` when
the integration cannot operate without GitView. Otherwise, treat a missing
extension as an optional capability.

## Review providers

`registerReviewProvider(provider)` adds a provider to the hosted-review surface,
alongside the built-in GitHub and GitLab providers.

Provider IDs must start with a lowercase letter and contain only lowercase
letters, numbers, dots, or hyphens.

Three methods are required — everything else is an optional capability, and the
panel hides the corresponding action when a provider omits it.

| Method | Required | Purpose |
| --- | --- | --- |
| `describe(repo)` | yes | Whether this provider applies to the repository, and how to label it |
| `listReviews(repo, filters)` | yes | Fills the review list |
| `openReview(repo, reviewId)` | yes | Loads details, files, comments, and suggestions |
| `submitReview` | no | Approve / request changes / comment |
| `mergeReview` | no | Merge, squash, or rebase |
| `applySuggestion` | no | Write a suggested change into the worktree |
| `closeReview`, `reopenReview` | no | Lifecycle actions |
| `deleteSourceBranch`, `checkoutReviewBranch` | no | Branch actions after merge |
| `createReview` | no | Open a new review from the panel |
| `createLineComment` | no | Comment on a diff line |

```ts
const registration = api.registerReviewProvider({
  id: "acme.forge",
  displayName: "Acme Forge",
  async describe(repo) {
    return { id: "acme.forge", displayName: "Acme Forge", available: true };
  },
  async listReviews(repo, filters) {
    /* ... */
  },
  async openReview(repo, reviewId) {
    /* ... */
  },
});
context.subscriptions.push(registration);
```

`registerReviewProvider` **throws** if the ID is malformed or already
registered, so guard it if two extensions might supply the same provider.

## Protocol extensions

`registerProtocolExtension(handler)` claims one request type that the webview
can call. Request types must use the `extension.<id>` namespace; anything else
throws.

```ts
api.registerProtocolExtension({
  type: "extension.acme.ping",
  validate: (payload): payload is { repoId: string } =>
    typeof (payload as { repoId?: unknown })?.repoId === "string",
  async handle(request, context) {
    if (!context.trusted) {
      throw new Error("Workspace is not trusted");
    }
    return { pong: request.payload.repoId };
  },
});
```

`validate` runs before `handle`; a payload that fails validation is rejected as
a protocol error and `handle` never sees it. The resolved value is returned to
the caller as a correlated response, and a thrown error becomes a correlated
error response — the host is not taken down by a failing handler.

Unlike review providers, a **duplicate request type does not throw**: the second
registration is logged and returns an inert disposable, so losing a race with
another extension cannot fail your `activate()`. Check the return value if the
distinction matters to you.

Core GitView request types remain a closed, exhaustively validated protocol
and are [internal](./stability.md#internal-surfaces). Integrations must not
register or depend on them.

## Refresh events

`onDidRefresh(listener)` fires after each coalesced refresh pass with the
repository snapshot, per-repository status, the effective Git Workspace
settings, and a `traceId` that correlates the payload with the `refresh.*`
records in the **GitView** output channel.

```ts
api.onDidRefresh((payload) => {
  for (const repo of payload.repoSnapshot.repositories) {
    const status = payload.statusByRepoId.get(repo.id);
    // ...
  }
});
```

`statusByRepoId` is a `ReadonlyMap` because the same payload instance is handed
to every subscriber. A listener that throws is logged and skipped; the other
subscribers still receive the payload.

Refreshes are debounced and coalesced, so this is not a per-Git-command event —
several mutations in quick succession may produce a single payload.

## Compatibility

- Check `apiVersion` before registering integrations.
- Additive methods and optional provider capabilities may be introduced within
  API version 1.
- Breaking contract changes require a new API version.
- Always dispose registrations and listeners that your extension owns.

See [Stability & versioning](./stability.md) for the full policy, including
which surfaces are internal and how deprecations are staged.
