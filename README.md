# cisco-pt-mcp

Let MCP clients control a running Cisco Packet Tracer instance through a local
Packet Tracer script-module bridge.

This repository is a maintained fork of
[`muhammadbalawal/cisco-pt-mcp`](https://github.com/muhammadbalawal/cisco-pt-mcp).
The fork keeps the original MIT license and expands the tool surface for
coursework, IoT labs, home gateways, wireless devices, DHCP, and Packet Tracer
simulation verification.

![Demo](https://raw.githubusercontent.com/Tanghui-Li/cisco-pt-mcp/main/demo.gif)

## What It Does

`cisco-pt-mcp` has two local components:

- a Python MCP server that exposes Packet Tracer actions as MCP tools;
- a Packet Tracer `.pts` script module that connects to the MCP server over
  loopback Socket.IO and executes Packet Tracer `IpcAPI` calls.

No cloud service is involved. The bridge listens on `127.0.0.1:7531`.

## Requirements

- Cisco Packet Tracer with script modules enabled.
- Python 3.10 or newer.
- An MCP client such as Codex CLI, Claude Code, Cursor, or VS Code.
- `uv` or another Python package runner.

## Install

### 1. MCP Server

For a released package:

```sh
uvx cisco-pt-mcp
```

For a local checkout:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -e ".[dev]"
cisco-pt-mcp
```

Example Codex CLI configuration:

```toml
[mcp_servers.cisco-pt-mcp]
command = "uvx"
args = ["cisco-pt-mcp"]
```

For a local checkout during development:

```toml
[mcp_servers.cisco-pt-mcp]
command = "/absolute/path/to/.venv/bin/cisco-pt-mcp"
```

### 2. Packet Tracer Extension

1. Open Packet Tracer.
2. Go to **Extensions -> Scripting -> Configure PT Script Modules...**.
3. Click **Add** and select `extension/cisco-pt-mcp.pts`.
4. Restart Packet Tracer.
5. Open **Extensions -> Cisco PT MCP Bridge**.

The bridge window should show `connected` after the Python MCP server starts.

### 3. Verify Loaded Version

Call the MCP tool:

```json
{
  "tool": "getBridgeInfo",
  "arguments": {}
}
```

The result includes the Packet Tracer extension version and bridge capabilities.
Use this before debugging stale `.pts` packages.

## Tool Highlights

| Tool | Purpose |
|---|---|
| `getBridgeInfo` | Read extension version and bridge capability info from Packet Tracer |
| `addDevice` | Add routers, switches, APs, home gateways, servers, MCU/SBC boards, and many IoT devices |
| `addLink` | Connect Ethernet, serial, fiber, wireless/media, IoT, and custom I/O links where Packet Tracer supports them |
| `configureEndDeviceIp` | Configure static/DHCP IPv4, gateway, and DNS on PCs, servers, IoT nodes, and gateway ports |
| `configureWireless` | Configure SSID, authentication, encryption, channel, broadcast, MAC filters, and wireless client hints |
| `configureDhcpServer` | Configure DHCP service state, pools, excluded ranges, gateway, DNS, and lease limits |
| `configureHomeRouter` | Configure HomeRouter/Linksys WAN mode, remote management, port forwarding, and DMZ |
| `controlIotDevice` | Drive MCU/SBC/Thing outputs, sub-components, serial notes, movement, and industrial protocol helpers |
| `inspectIotDevice` | Inspect IoT/Thing capabilities, selected external attributes, slots, and IoE client presence |
| `runIotAutomation` | Evaluate one-shot MCP-side IoT condition/action rules for demos such as wind-close-window or RFID-open-door |
| `startIotAutomation` / `stopIotAutomation` / `getIotAutomationStatus` | Run persistent script-module polling rules for live IoT linkage demos |
| `inspectEnvironment` / `configureEnvironment` | Inspect and adjust Packet Tracer physical-environment values used by IoT rules |
| `configureIosDevice` | Run IOS CLI configuration commands on routers and switches |
| `getNetwork` / `getDeviceInfo` | Inspect workspace devices, interfaces, port state, wireless state, IOS probes, and links |
| `auditNetwork` | Check expected devices, disconnected nodes, wireless associations, and optional green link lights |
| `sendPdu` / `stepSimulation` / `getPduResults` | Create and inspect Packet Tracer simulation traffic |

## Packet Tracer Notes

Packet Tracer script modules expose only part of Packet Tracer's internal GUI
behavior. Some GUI-visible operations, especially wireless client profile
switching on IoT Things, are not fully reliable through `IpcAPI`.

The IoE Registration Server **Conditions** page is documented by Packet Tracer
as a GUI feature, but the public `IpcAPI` does not expose writable
`IoeServerProcess` rule-management methods. Use `runIotAutomation` for
one-shot demos, `startIotAutomation` for timer-based live linkage demos, or
configure persistent Conditions rules manually in the Packet Tracer GUI.

For IoT wireless labs, note the distinction in the official `IpcAPI`
enumeration: `eAuthenNull = 0` and `eAuthenOpen = 6` are different values.
Many Packet Tracer IoT Things ship with a default `HomeGateway` profile that
reports `authenType = 0`. Use `authType: "none"` or `authType: "iot-open"` for
those cases, and use `authType: "open"` when you specifically want
`eAuthenOpen = 6`.

## Development

Run offline checks:

```sh
python -m pip install -e ".[dev]"
python -m pytest -q
node --check extension/source/userfunctions.js
node --check extension/source/interface/interface.js
```

After editing files under `extension/source/`, rebuild
`extension/cisco-pt-mcp.pts` from Packet Tracer GUI:

1. Open **Extensions -> Scripting -> Configure PT Script Modules...**.
2. Import or update the script module source.
3. Export/package the `.pts`.
4. Restart Packet Tracer and call `getBridgeInfo`.

## Security

The bridge is loopback-only (`127.0.0.1`). Do not expose port `7531` to an
untrusted network. MCP clients can execute Packet Tracer actions, including IOS
configuration changes, so only run clients you trust.

## License

MIT. See [`LICENSE`](LICENSE).

Original project copyright belongs to Muhammad Balawal and contributors.
Fork modifications are maintained by Tanghui-Li and contributors.
