# Webview ↔ host protocol

**Single** message protocol for all GitView webviews. There is no second protocol
and no product “v2” transport.

## Envelope

| Field | Request | Response | Event |
| --- | --- | --- | --- |
| `protocolVersion` | `1` (constant) | `1` | `1` |
| `requestId` | required | required | **absent** |
| `type` | `domain.action` | same as request or `"error"` | `domain.action` |
| `payload` | optional | optional | optional |
| `ok` | — | `true` / `false` | — |
| `error` | — | on `ok: false` | — |

`protocolVersion` is a wire envelope id (`PROTOCOL_VERSION` in code), not a marketplace
release number. Message `type` uses **dots** (`merge.openFile`), never colons (`merge:openFile`).

### Code locations

| Layer | Path |
| --- | --- |
| Types | `src/shared/protocol/` (`base.ts`, `webviewToHost*.ts`, `hostToWebview.ts`, `index.ts`) |
| Errors | `src/shared/errors/codes.ts` |
| Host router | `src/webviewHost/messageRouter.ts` → `handlers/` + `messageRouterDispatch*.ts` |
| Webview client | `webview/src/protocol/clientCore.ts`, `client*Slice.ts`, `createProtocolClient` |

## Surfaces (`window.__GITVIEW_APP__`)

| Surface | Host entry |
| --- | --- |
| `gitWorkspace` | `GitWorkspaceViewProvider` / `gitWorkspacePanel` |
| `merge` | `GitViewPanel` |
| `gitHistory` | `GitHistoryWebviewPanel` |
| `gitBlame` / `gitDiff` | `gitViewPresentation` |

All request/response handling goes through `createMessageRouter`.

## Transport rules

**Host:** parse → version check → dispatchers → outer try/catch → `HostErrorResponse` with
matching `requestId`.

**Webview:** `request(...)` with 30s default timeout; settle pending once (resolve / error /
unexpected type). `handleHostMessage` does **not** update stores.

**Events:** allow-list type in `clientCore` + type-guard + subscription branch before the
`handleHostMessage` fallback.

## Adding a message

1. Types in `webviewToHost*.ts` / `hostToWebview.ts` (+ error code if needed).
2. Handler + dispatcher + context wiring.
3. Client method in the right `client*Slice.ts`.
4. Event: allow-list + guard + subscription.
5. Tests for success, error, path/trust where disk or Git changes.

## Grep gate

```bash
grep -rnE '"(merge|conflicts|git|gitHistory|webview|app|vscode):[a-zA-Z]' src webview/src
```

Must be empty except intentional negative tests.

---

[← Keyboard shortcuts](./keyboard-shortcuts.md) · [Docs index](../README.md) · [Development →](../contribute/development.md)
