# cisco-pt-mcp

An [MCP](https://modelcontextprotocol.io/) server that lets any MCP-aware
client (Claude Desktop, Cursor, Backboard, VS Code, ...) drive a running
**Cisco Packet Tracer** instance.

```mermaid
flowchart LR
    client["MCP client"]
    server["cisco-pt-mcp<br/>server (Python)"]
    pt["Packet Tracer<br/>+ cisco-pt-mcp.pts<br/>bridge extension"]

    client <-- "stdio MCP" --> server
    server <-- "Socket.IO<br/>127.0.0.1:7531" --> pt
```

The PT extension shows a small bridge window (Extensions → **Packet Tracer MCP**)
with a connection-status pill and a tool-call activity log — purely diagnostic.

## Layout

```
cisco-pt-mcp/
├─ pyproject.toml                  # console_script: cisco-pt-mcp = mcp_server.server:main
├─ mcp_server/
│  ├─ __main__.py                  # python -m mcp_server entrypoint
│  ├─ server.py                    # MCP stdio server, registers tools, forwards to bridge
│  ├─ bridge.py                    # PTBridge: Socket.IO server on 127.0.0.1:7531
│  └─ tools.py                     # 9 tool schemas (single source of truth)
├─ extension/source/                # packaged into cisco-pt-mcp.pts
│  ├─ main.js                      # PT lifecycle, Extensions menu item
│  ├─ window.js                    # webview controller (this-sm:index.html)
│  ├─ runcode.js                   # $se('runCode') eval host
│  ├─ userfunctions.js             # the 9 tool implementations (PT scripting host)
│  ├─ devices.js / links.js / modules.js   # PT type-id lookup tables
│  └─ interface/                   # webview, browser context
│     ├─ index.html                # status pill + activity log
│     ├─ interface.js              # Socket.IO client, $se dispatcher
│     └─ socket.io.min.js          # vendored client
└─ tests/test_smoke.py             # 6 offline smoke tests
```

The split between `extension/source/*.js` (PT scripting host: `ipc.network()`,
`webViewManager`, `$se`) and `extension/source/interface/*` (webview browser
context: DOM, `socket.io`, talks to PT only via `$se('runCode', ...)`) is
load-bearing — see Cisco's own `Cisco-Agent` extension for the same pattern.

## Install

### 1. Server

The server is published on PyPI. No cloning or venv setup required — `uvx` handles
everything in an isolated environment. [Install `uv`](https://docs.astral.sh/uv/getting-started/installation/)
if you don't have it yet (single command on any platform), then register the server
with your MCP client:

| Client         | One-line registration                                                              |
|----------------|------------------------------------------------------------------------------------|
| Claude Code    | `claude mcp add cisco-pt-mcp --scope user -- uvx cisco-pt-mcp`                    |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` — JSON below                        |
| Cursor         | `%USERPROFILE%\.cursor\mcp.json` (or `.cursor/mcp.json` per project) — same JSON  |
| VS Code        | `.vscode/mcp.json` — JSON below (note different key name)                         |
| Codex CLI      | `%USERPROFILE%\.codex\config.toml` — TOML below                                   |
| Backboard CLI  | `backboard config add-mcp '{"name": "cisco-pt-mcp", "command": "uvx", "args": ["cisco-pt-mcp"]}'` |

**Claude Desktop / Cursor** (`mcpServers`):

```json
{
  "mcpServers": {
    "cisco-pt-mcp": { "command": "uvx", "args": ["cisco-pt-mcp"] }
  }
}
```

**VS Code** (`servers`):

```json
{
  "servers": {
    "cisco-pt-mcp": { "command": "uvx", "args": ["cisco-pt-mcp"] }
  }
}
```

**Codex CLI** (TOML):

```toml
[mcp_servers.cisco-pt-mcp]
command = "uvx"
args = ["cisco-pt-mcp"]
```

**Backboard CLI** (one-shot command, persists to `~/.backboard/config.json`):

```cmd
backboard config add-mcp "{\"name\": \"cisco-pt-mcp\", \"command\": \"uvx\", \"args\": [\"cisco-pt-mcp\"]}"
```

Verify with `backboard config list-mcp`. Toggle off/on later with
`backboard config disable-mcp cisco-pt-mcp` / `enable-mcp cisco-pt-mcp`.

> **Fallback:** If `uvx` isn't available, install the package manually and point
> directly at the binary:
> ```json
> { "mcpServers": { "cisco-pt-mcp": { "command": "C:\\path\\to\\.venv\\Scripts\\cisco-pt-mcp.exe" } } }
> ```

For remote use, expose this server through `mcp-remote`; HTTP transport
is intentionally not built in.

### 2. Extension

1. **Download** `cisco-pt-mcp.pts` from the repo:
   [github.com/muhammadbalawal/PacketTracerMCP/raw/main/extension/cisco-pt-mcp.pts](https://github.com/muhammadbalawal/PacketTracerMCP/raw/main/extension/cisco-pt-mcp.pts)
   (or grab the latest `.pts` from the [Releases](https://github.com/muhammadbalawal/PacketTracerMCP/releases) page).
2. In Packet Tracer: **Extensions → Extensions Manager → Install Extension…**
3. Select the downloaded `cisco-pt-mcp.pts`.
4. Restart Packet Tracer when prompted.

**Extensions → Packet Tracer MCP** now shows in the menu — click it to
open the bridge window.

> Prefer to drop it in by hand? The per-user extensions directory is
> `%USERPROFILE%\Cisco Packet Tracer <version>\extensions\cisco-pt-mcp\`.

To rebuild after editing `extension/source/*.js`, use PT's
**Extensions → Scripting** workflow to re-package the source folder
into a new `.pts`, then reinstall via the Extensions Manager.

## Run

1. Launch Packet Tracer; click **Extensions → Packet Tracer MCP**. The
   bridge window opens with status `connecting` then `offline`.
2. Launch your MCP client. It spawns `cisco-pt-mcp.exe` as a
   subprocess; within a second the bridge window flips to `connected`.
3. Ask the model to do something. Tool calls show up in the bridge
   window's Activity log.

## Tools exposed

| Tool                | Purpose                                         |
|---------------------|-------------------------------------------------|
| `addDevice`         | Drop a router/switch/PC on the canvas           |
| `addModule`         | Install an interface module in a device slot   |
| `addLink`           | Connect two devices with a cable                |
| `removeDevice`      | Delete one or more devices                      |
| `removeLink`        | Delete one or more cables                       |
| `configurePcIp`     | Set IP / DHCP / gateway / DNS on a PC           |
| `configureIosDevice`| Run IOS CLI commands on a router/switch         |
| `getNetwork`        | Snapshot of all devices, interfaces, cables     |
| `getDeviceInfo`     | Detail view of a single device                  |

All tool calls return JSON `{success, ...}`; errors come back as
`{success: false, error: "..."}` so the model can recover.

## Configuration

| Variable                        | Default | Meaning                            |
|---------------------------------|---------|------------------------------------|
| `CISCO_PT_MCP_TOOL_TIMEOUT` | `60`    | Seconds to wait for a tool result  |
| `CISCO_PT_MCP_LOG_LEVEL`    | `INFO`  | Server log level                   |

The bridge endpoint is hard-coded to `127.0.0.1:7531` (both ends are
local). To retarget, edit `MCP_URL` in `extension/source/interface/interface.js`
and the constants in `mcp_server/bridge.py`, then rebuild the `.pts`.

## Tests

```cmd
pip install -e .[dev]
pytest tests\ -v
```

Offline tests — no Packet Tracer required.

## License

MIT
