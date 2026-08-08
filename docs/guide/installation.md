# Installation

## From Visual Studio Marketplace

After publish, search **GitView** in the Extensions view, or:

```text
ext install gitview.gitview
```

(Replace the publisher id if your `package.json` publisher differs.)

## From Open VSX

For VSCodium, Cursor, and other Open VSX clients, install from the Open VSX listing or:

```bash
# after packaging
pnpm dlx ovsx publish gitview-<version>.vsix -p <OVSX_TOKEN>
```

## From a local VSIX

```bash
pnpm install
pnpm run package
code --install-extension gitview-<version>.vsix
```

Use your editor’s CLI if not using `code` (e.g. `cursor`, `codium`).

## Verify install

1. Open a Git repository in a **trusted** workspace.
2. Command Palette → **GitView: Open Git workspace**.
3. During a merge with conflicts: Explorer → right-click file → **Git** → **Resolve conflict**.

## Next

- [Getting started](./getting-started.md)
- [Security & trust](./security.md)

---

[Docs index](../README.md) · [Getting started →](./getting-started.md)
