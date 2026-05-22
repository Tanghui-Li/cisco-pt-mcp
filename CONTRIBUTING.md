# Contributing

Contributions are welcome. Keep changes focused and testable.

## Local Checks

```sh
python -m pip install -e ".[dev]"
python -m pytest -q
node --check extension/source/userfunctions.js
node --check extension/source/interface/interface.js
```

## Packet Tracer Extension Changes

When `extension/source/` changes, rebuild `extension/cisco-pt-mcp.pts` with
Packet Tracer's script-module GUI before cutting a release. Then verify with
the `getBridgeInfo` MCP tool.

## Documentation

If a change depends on Packet Tracer `IpcAPI` behavior, document the relevant
API class or the observed runtime behavior. Packet Tracer device classes do not
always behave identically even when the official API signatures match.
