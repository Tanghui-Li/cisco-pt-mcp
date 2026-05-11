"""Tool schemas exposed to MCP clients.

Tool names match the JS function names in ``extension/source/userfunctions.js``
exactly so ``bridge.py`` can forward by name without translation.
"""

from __future__ import annotations

# IOS interface naming pattern reused by addLink / removeLink.
INTERFACE_PATTERN = (
    r"^(GigabitEthernet|FastEthernet|Ethernet|Serial|Gi|Fa|Se)"
    r"(\d+)?(/\d+){0,2}$"
)

TOOLS: list[dict] = [
    {
        "name": "addDevice",
        "description": (
            "Add a network device to the workspace. Call getNetwork first if "
            "unsure whether the chosen deviceName is already taken; names must "
            "be unique."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {
                    "type": "string",
                    "description": "Unique name for the device (must not already exist).",
                },
                "deviceModel": {
                    "type": "string",
                    "enum": [
                        "2911", "1941", "2921", "2901",
                        "2960-24TT", "2960-48TT", "3560-24PS",
                        "PC-PT", "Server-PT", "Laptop-PT", "Printer-PT",
                    ],
                    "description": (
                        "Device model. Router: 2911/1941/2921/2901. "
                        "Switch: 2960-24TT/2960-48TT/3560-24PS. "
                        "End device: PC-PT/Server-PT/Laptop-PT/Printer-PT."
                    ),
                },
                "x": {"type": "number", "description": "X coordinate on workspace."},
                "y": {"type": "number", "description": "Y coordinate on workspace."},
            },
            "required": ["deviceName", "deviceModel", "x", "y"],
        },
    },
    {
        "name": "addModule",
        "description": (
            "Add an interface module to a device. Powers the device off, "
            "installs the module, powers it back on."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Existing device name."},
                "slot": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 3,
                    "description": "Slot number (0-3).",
                },
                "model": {
                    "type": "string",
                    "description": "Module model, e.g. HWIC-2T (serial), NM-4E (ethernet).",
                },
            },
            "required": ["deviceName", "slot", "model"],
        },
    },
    {
        "name": "addLink",
        "description": (
            "Connect two devices with a cable. Both interfaces must be free "
            "(in_use=false in getNetwork output). If unsure, call getNetwork "
            "first."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "device1Name": {"type": "string"},
                "device1Interface": {
                    "type": "string",
                    "pattern": INTERFACE_PATTERN,
                    "description": "Free interface on device 1.",
                },
                "device2Name": {"type": "string"},
                "device2Interface": {
                    "type": "string",
                    "pattern": INTERFACE_PATTERN,
                    "description": "Free interface on device 2.",
                },
                "linkType": {
                    "type": "string",
                    "enum": ["straight", "cross", "fiber", "serial", "auto"],
                    "description": "Cable type. Use 'straight' for most LAN, 'cross' for PC-PC, 'serial' for WAN.",
                },
            },
            "required": ["device1Name", "device1Interface", "device2Name", "device2Interface", "linkType"],
        },
    },
    {
        "name": "removeDevice",
        "description": "Remove one or more devices from the workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceNames": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Array of existing device names to remove.",
                },
            },
            "required": ["deviceNames"],
        },
    },
    {
        "name": "removeLink",
        "description": "Remove one or more cables. Each entry identifies one endpoint of the link.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "links": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "device": {"type": "string"},
                            "port": {"type": "string", "pattern": INTERFACE_PATTERN},
                        },
                        "required": ["device", "port"],
                    },
                    "description": "Array of {device, port} endpoints.",
                },
            },
            "required": ["links"],
        },
    },
    {
        "name": "configurePcIp",
        "description": "Configure IP settings on a PC or end device.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "PC name (must exist)."},
                "dhcpEnabled": {"type": "boolean", "description": "True for DHCP, false for static IP."},
                "ipaddress": {"type": "string", "description": "IP address (if static)."},
                "subnetMask": {"type": "string", "description": "Subnet mask (if static)."},
                "defaultGateway": {"type": "string", "description": "Default gateway."},
                "dnsServer": {"type": "string", "description": "DNS server."},
            },
            "required": ["deviceName"],
        },
    },
    {
        "name": "configureIosDevice",
        "description": (
            "Execute IOS commands on a router or switch. Commands run from "
            "global config and are saved with 'write memory'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string"},
                "commands": {
                    "type": "string",
                    "description": "Newline-separated IOS commands.",
                },
            },
            "required": ["deviceName", "commands"],
        },
    },
    {
        "name": "getNetwork",
        "description": (
            "Snapshot of the entire workspace: every device, its interfaces "
            "(with in_use flags), and every cable. Call this before addLink "
            "or removeDevice when unsure of current state."
        ),
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "getDeviceInfo",
        "description": "Detailed info about one device, including interfaces and incident links.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string"},
            },
            "required": ["deviceName"],
        },
    },
]

TOOLS_BY_NAME: dict[str, dict] = {t["name"]: t for t in TOOLS}
