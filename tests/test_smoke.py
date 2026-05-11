"""Offline smoke tests — run without Packet Tracer."""

from __future__ import annotations

import json

import pytest
import mcp.types as mt

from mcp_server import bridge, server, tools


EXPECTED_TOOLS = {
    "addDevice", "addModule", "addLink",
    "removeDevice", "removeLink",
    "configurePcIp", "configureIosDevice",
    "getNetwork", "getDeviceInfo",
}


def test_tool_set_complete():
    names = {t["name"] for t in tools.TOOLS}
    assert names == EXPECTED_TOOLS
    assert tools.TOOLS_BY_NAME["addDevice"]["inputSchema"]["required"] == [
        "deviceName", "deviceModel", "x", "y",
    ]


def test_schemas_serializable():
    for t in tools.TOOLS:
        json.dumps(t["inputSchema"])
        props = t["inputSchema"].get("properties", {})
        for name, p in props.items():
            assert "type" in p, f"{t['name']}.{name} missing type"


def test_schemas_accepted_by_mcp_types():
    descriptors = [
        mt.Tool(name=t["name"], description=t["description"], inputSchema=t["inputSchema"])
        for t in tools.TOOLS
    ]
    assert len(descriptors) == len(EXPECTED_TOOLS)


@pytest.mark.asyncio
async def test_bridge_lifecycle():
    b = bridge.PTBridge(host="127.0.0.1", port=17531)
    await b.start()
    assert not b.is_connected
    await b.stop()


@pytest.mark.asyncio
async def test_call_tool_without_plugin():
    b = bridge.PTBridge(host="127.0.0.1", port=17532)
    await b.start()
    try:
        with pytest.raises(RuntimeError, match=r"plugin"):
            await b.call_tool("addDevice", {"deviceName": "R1"})
    finally:
        await b.stop()


def test_server_constructs():
    b = bridge.PTBridge(host="127.0.0.1", port=17533)
    s = server.build_server(b)
    assert s.name == "cisco-pt-mcp"
