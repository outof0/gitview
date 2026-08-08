# Keyboard shortcuts

Primary shortcuts for the **merge resolver**. Keys use the merge webview focus (not global VS Code chords unless noted).

| Key | Action |
| --- | --- |
| `F7` | Next difference / conflict |
| `Shift+F7` | Previous difference / conflict |
| `Alt+↑` / `Alt+↓` | Navigate blocks |
| `Alt+1` | Accept left (Local / ours) for active block |
| `Alt+2` | Accept right (Repository / theirs) for active block |
| `Alt+3` | Accept both (order from `acceptBothOrder`) |
| `Ctrl+Enter` / `Cmd+Enter` | Apply / mark resolved (when enabled) |

Behavior of wrap-to-next-file on F7 is controlled by `gitView.goToNextFileAfterLastChange`.

Global VS Code shortcuts (Command Palette, Explorer) are unchanged. Open Git Workspace and other commands via **Command Palette** (`Ctrl/Cmd+Shift+P`).

---

[← Commands](./commands.md) · [Docs index](../README.md) · [Protocol →](./protocol.md)
