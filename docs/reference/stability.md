# Stability & versioning

What GitView promises not to break, and what it explicitly reserves the right
to change. Read this before building anything on top of the extension.

## Versioning

GitView follows [Semantic Versioning](https://semver.org/). Versions are cut
with `pnpm release`; see [RELEASE.md](../../RELEASE.md).

While the extension is on `0.x`, the SemVer rule for initial development
applies: **minor** releases may contain breaking changes to the surfaces below,
and **patch** releases may not. Every such break is listed in the changelog
under `BREAKING CHANGE`. From `1.0.0`, breaking changes to a public surface
require a major release.

## Public surfaces

These are covered by the policy above. They are the only things an outside
integration should depend on.

| Surface | Declared in | Notes |
| --- | --- | --- |
| Extension API | `GitViewExtensionApi` (see [Extension API](./extension-api.md)) | Additionally gated by `apiVersion` |
| Command IDs | `contributes.commands` in `package.json`, listed in [Commands](./commands.md) | Callable via `vscode.commands.executeCommand` |
| Settings keys and value shapes | `contributes.configuration`, listed in [Settings](./settings.md) | Removing a key or narrowing an enum is breaking |
| Context keys used for menu `when` clauses | `contributes.menus` | Only those documented in [Commands](./commands.md) |

`apiVersion` is an integer that moves independently of the package version. It
increments only when the extension API changes in a way existing callers cannot
absorb, so `if (api.apiVersion !== 1) return;` is a sufficient guard.

## Internal surfaces

These change without notice, in any release, including patches. They are
documented for contributors, not as a contract.

- The webview ↔ host message protocol ([Protocol](./protocol.md)). Integrations
  extend it through `registerProtocolExtension`, never by posting core request
  types.
- Everything under `src/` that is not re-exported from `src/publicApi.ts`.
- The structure of records written to the **GitView** output channel, and the
  `traceId` format.
- `workspaceState` / `globalState` storage keys and their payload shapes.
- Webview DOM structure, CSS class names, and `data-testid` attributes.

## Deprecation policy

1. The old surface keeps working and gains a `@deprecated` JSDoc tag naming its
   replacement.
2. The changelog entry for that release lists it under `Deprecated`.
3. Removal happens no earlier than the next minor release (`0.x`) or the next
   major (`>= 1.0`), whichever policy applies at the time.

Settings are deprecated with `"deprecationMessage"` in `package.json` so VS Code
surfaces the notice in the Settings UI while the key still resolves.

A surface may be removed without this cycle only when keeping it would leak
credentials or corrupt a repository. Such a removal is called out explicitly in
the changelog.

## Reporting a break

If a release breaks one of the public surfaces above without a changelog entry,
that is a bug — please open an issue with the version you upgraded from and to.
