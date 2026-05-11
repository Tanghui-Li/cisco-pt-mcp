# cisco-pt-mcp

An [MCP](https://modelcontextprotocol.io/) server that lets any MCP-aware
client (Claude Desktop, Cursor, Backboard, VS Code, ...) drive a running
**Cisco Packet Tracer** instance.

```
┌───────────────────┐                       ┌──────────────────────┐
│                   │                       │     cisco-pt-mcp     │
│     MCP client    │ ◄──── stdio MCP ────► │   server (Python)    │
│                   │                       │                      │
└───────────────────┘                       └───────────┬──────────┘
                                                        │
                                                        │  Socket.IO 127.0.0.1:7531
                                                        ▼
                                           ┌─────────────────────────┐
                                           │      Packet Tracer +    │
                                           │     cisco-pt-mcp.pts    │
                                           │     bridge extension    │
                                           └─────────────────────────┘
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

```cmd
cd C:\path\to\PacketTracerMCP
py -m pip install -e .
```

That registers a `cisco-pt-mcp.exe` console script in your venv's
`Scripts\` folder.

### 2. Extension

Copy the built `.pts` into PT's per-user extensions directory:

```cmd
mkdir "%USERPROFILE%\Cisco Packet Tracer 9.0.0\extensions\PacketTracerMCP"
copy "extension\PacketTracerMCP.pts" "%USERPROFILE%\Cisco Packet Tracer 9.0.0\extensions\PacketTracerMCP\"
```

(Adjust `9.0.0` to match your installed PT version.)

Restart Packet Tracer. **Extensions → Packet Tracer MCP** should appear
in the menu — click it to open the bridge window.

To rebuild after editing `extension/source/*.js`, use PT's
**Extensions → Scripting** workflow to re-package the source folder
into a new `.pts`, then recopy.

### 3. Wire it into your MCP client

After `pip install -e .` the `cisco-pt-mcp` binary is on `PATH`. Every MCP-aware
client takes the same one-line registration — only the config file shape differs.

| Client          | How to add it                                                                  |
|-----------------|--------------------------------------------------------------------------------|
| Claude Code     | `claude mcp add cisco-pt-mcp --scope user -- cisco-pt-mcp`                     |
| Claude Desktop  | `%APPDATA%\Claude\claude_desktop_config.json` — JSON below                     |
| Cursor          | `%USERPROFILE%\.cursor\mcp.json` (or `.cursor/mcp.json` per project) — same JSON as Claude Desktop |
| VS Code         | `.vscode/mcp.json` or `code --add-mcp "{\"name\":\"cisco-pt-mcp\",\"command\":\"cisco-pt-mcp\"}"` |
| Codex CLI       | `%USERPROFILE%\.codex\config.toml` — TOML below                                |

**Claude Desktop / Cursor** (`mcpServers`):

```json
{
  "mcpServers": {
    "cisco-pt-mcp": { "command": "cisco-pt-mcp" }
  }
}
```

**VS Code** (`servers` — note the different key name):

```json
{
  "servers": {
    "cisco-pt-mcp": { "command": "cisco-pt-mcp" }
  }
}
```

**Codex CLI** (TOML):

```toml
[mcp_servers.cisco-pt-mcp]
command = "cisco-pt-mcp"
```

If a Windows GUI client can't find `cisco-pt-mcp` (PATH inheritance from
non-shell parents is unreliable), fall back to either an absolute path
(`C:\\path\\to\\.venv\\Scripts\\cisco-pt-mcp.exe`) or `python -m mcp_server`:

```json
{ "mcpServers": { "cisco-pt-mcp": { "command": "py", "args": ["-m", "mcp_server"] } } }
```

For remote use, expose this server through `mcp-remote`; HTTP transport
is intentionally not built in.

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
py -m pip install -e .[dev]
py -m pytest tests\ -v
```

Offline tests — no Packet Tracer required.

## License

MIT
