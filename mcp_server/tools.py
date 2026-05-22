"""Tool schemas exposed to MCP clients.

Tool names match the JS function names in ``extension/source/userfunctions.js``
exactly so ``bridge.py`` can forward by name without translation.
"""

from __future__ import annotations


DEVICE_MODELS = [
    "1841",
    "1941",
    "2620XM",
    "2621XM",
    "2811",
    "2901",
    "2911",
    "819HG-4G-IOX",
    "819HGW",
    "829",
    "CGR1240",
    "ISR4321",
    "ISR4331",
    "Router-PT",
    "Router-PT-Empty",
    "2950-24",
    "2950T-24",
    "2960-24TT",
    "Switch-PT",
    "Switch-PT-Empty",
    "Cloud-PT",
    "Cloud-PT-Empty",
    "Bridge-PT",
    "Hub-PT",
    "Repeater-PT",
    "CoAxialSplitter-PT",
    "AccessPoint-PT",
    "AccessPoint-PT-A",
    "AccessPoint-PT-AC",
    "AccessPoint-PT-N",
    "PC-PT",
    "Server-PT",
    "Printer-PT",
    "Linksys-WRT300N",
    "7960",
    "DSL-Modem-PT",
    "Cable-Modem-PT",
    "3560-24PS",
    "3650-24PS",
    "IE-2000",
    "Laptop-PT",
    "TabletPC-PT",
    "SMARTPHONE-PT",
    "WirelessEndDevice-PT",
    "WiredEndDevice-PT",
    "TV-PT",
    "Home-VoIP-PT",
    "Analog-Phone-PT",
    "5505",
    "5506-X",
    "DLC100",
    "HomeRouter-PT-AC",
    "Cell-Tower",
    "Central-Office-Server",
    "802",
    "803",
    "Sniffer",
    "MCU-PT",
    "SBC-PT",
    "Air Conditioner",
    "Air Cooler",
    "Alarm",
    "Appliance",
    "Atm Pressure Monitor",
    "Battery",
    "Beacon",
    "Blower",
    "Bluetooth Speaker",
    "Carbon Dioxide Detector",
    "Carbon Monoxide Detector",
    "Fan",
    "Ceiling Sprinkler",
    "Dimmable LED",
    "Door",
    "Fire Monitor",
    "Fire Sprinkler",
    "Flex Sensor",
    "Floor Sprinkler",
    "Furnace",
    "Garage Door",
    "Generic Environment Sensor",
    "Generic Sensor",
    "Heating Element",
    "Home Speaker",
    "Humidifier",
    "Humidity Monitor",
    "Humidity Sensor",
    "Humiture Monitor",
    "Humiture Sensor",
    "LCD",
    "LED",
    "Lawn Sprinkler",
    "Light",
    "Membrane Potentiometer",
    "Metal Sensor",
    "Motion Detector",
    "Motion Sensor",
    "Motor",
    "Old Car",
    "Photo Sensor",
    "Piezo Speaker",
    "Portable Music Player",
    "Potentiometer",
    "Power Meter",
    "Push Button",
    "Push Button Toggle Switch",
    "RFID Card",
    "RFID Reader",
    "RGB LED",
    "Rocker Switch",
    "Servo",
    "Signal Generator",
    "Siren",
    "Smart LED",
    "Smoke Detector",
    "Smoke Sensor",
    "Solar Panel",
    "Sound Frequency Detector",
    "Sound Sensor",
    "Speaker",
    "Street Lamp",
    "Temperature Monitor",
    "Temperature Sensor",
    "Thermostat",
    "Thing",
    "Toggle Push Button",
    "Trip Sensor",
    "Trip Wire",
    "Water Detector",
    "Water Drain",
    "Water Level Monitor",
    "Water Sensor",
    "Webcam",
    "Wind Detector",
    "Wind Sensor",
    "Wind Turbine",
    "Window",
    "Embedded-Server-PT",
    "WLC-2504",
    "WLC-3504",
    "WLC-PT",
    "3702i",
    "LAP-PT",
    "Power Distribution Device",
    "Copper Patch Panel",
    "Fiber Patch Panel",
    "Copper Wall Mount",
    "Fiber Wall Mount",
    "Meraki-MX65W",
    "Meraki-Server",
    "NetworkController",
]

LINK_TYPES = [
    "straight",
    "cross",
    "roll",
    "fiber",
    "phone",
    "cable",
    "serial",
    "auto",
    "console",
    "wireless",
    "coaxial",
    "octal",
    "cellular",
    "usb",
    "custom_io",
    "ethernet-straight",
    "ethernet-cross",
]

WIRELESS_AUTH_TYPES = ["none", "null", "iot-open", "open", "wep", "wpa-psk", "wpa2-psk"]
WIRELESS_ENCRYPTION_TYPES = ["none", "wep-64", "wep-128", "tkip", "aes"]
WIRELESS_NETWORK_TYPES = ["disabled", "b", "g", "bg-mixed", "n", "a", "mixed"]
HOME_ROUTER_WAN_TYPES = ["dhcp", "pppoe", "static"]
HOME_ROUTER_NAT_PROTOCOLS = ["tcp", "udp", "both"]

PORT_NAME_SCHEMA = {
    "type": "string",
    "description": (
        "Port/interface name as reported by Packet Tracer, e.g. "
        "'GigabitEthernet0/1', 'GigabitEthernet 1', 'Internet', 'Wireless 1', "
        "'Wireless0', or 'Custom0'."
    ),
}


TOOLS: list[dict] = [
    {
        "name": "getBridgeInfo",
        "description": (
            "Return version and capability information from the Packet Tracer "
            "extension currently connected to the MCP bridge. Use this to "
            "verify that Packet Tracer loaded the expected .pts package."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
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
                    "enum": DEVICE_MODELS,
                    "description": (
                        "Device model. Includes enterprise routers/switches, "
                        "wireless devices, HomeRouter-PT-AC, WLC/AP models, "
                        "cameras, RFID devices, MCU/SBC boards, and many IoT Things."
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
                    "anyOf": [
                        {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 3,
                        },
                        {
                            "type": "string",
                            "pattern": r"^\d+(?:/\d+){0,2}$",
                        },
                    ],
                    "description": (
                        "Slot identifier. Accepts simple numeric slots like 0-3 "
                        "or hierarchical slot paths such as '0/0' or '0/0/1'."
                    ),
                },
                "model": {
                    "type": "string",
                    "description": "Module model, e.g. HWIC-2T (serial), NM-4E (ethernet), GLC-TE (SFP).",
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
                "device1Interface": PORT_NAME_SCHEMA,
                "device2Name": {"type": "string"},
                "device2Interface": PORT_NAME_SCHEMA,
                "linkType": {
                    "type": "string",
                    "enum": LINK_TYPES,
                    "description": (
                        "Cable type. Supports LAN/WAN cables plus Packet Tracer IoT/media "
                        "links such as wireless, coaxial, cellular, usb, and custom_io."
                    ),
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
                            "port": PORT_NAME_SCHEMA,
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
        "name": "configureEndDeviceIp",
        "description": "Configure IP settings on a PC, IoT device, home gateway port, or other end device.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Device name (must exist)."},
                "interfaceName": {
                    "type": "string",
                    "description": (
                        "Network interface to configure. Optional; when omitted the bridge "
                        "tries common defaults such as FastEthernet0, Wireless0, Internet, "
                        "or GigabitEthernet 1."
                    ),
                },
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
        "name": "configureWireless",
        "description": (
            "Configure wireless settings on an AP, HomeRouter, WLC-accessed radio, "
            "wireless client, or IoT endpoint. Supports SSID, PSK/WEP auth, channel, "
            "SSID broadcast, and MAC filtering."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Device name (must exist)."},
                "ssid": {"type": "string", "description": "SSID string."},
                "authType": {
                    "type": "string",
                    "enum": WIRELESS_AUTH_TYPES,
                    "description": (
                        "Authentication type. 'open' maps to Packet Tracer eAuthenOpen=6; "
                        "'none', 'null', and 'iot-open' map to eAuthenNull=0 for devices "
                        "whose default IoT profiles use null authentication."
                    ),
                },
                "encryption": {
                    "type": "string",
                    "enum": WIRELESS_ENCRYPTION_TYPES,
                    "description": "Encryption type: none, wep-64, wep-128, tkip, or aes.",
                },
                "password": {
                    "type": "string",
                    "description": "PSK/WPA passphrase when authType is wpa-psk or wpa2-psk.",
                },
                "wepKey": {
                    "type": "string",
                    "description": "WEP key when authType is wep.",
                },
                "ssidBroadcastEnabled": {
                    "type": "boolean",
                    "description": "Enable or disable SSID broadcast on wireless servers.",
                },
                "standardChannel": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 11,
                    "description": "2.4GHz standard channel number (1-11).",
                },
                "wideChannel": {
                    "anyOf": [
                        {"type": "string", "enum": ["auto"]},
                        {"type": "integer", "minimum": 3, "maximum": 9},
                    ],
                    "description": "40MHz wide channel selection. Use 'auto' or channels 3-9.",
                },
                "networkType": {
                    "type": "string",
                    "enum": WIRELESS_NETWORK_TYPES,
                    "description": "Wireless network type: disabled, b, g, bg-mixed, n, a, or mixed.",
                },
                "wirelessPort": {
                    "type": "string",
                    "description": "Optional radio/port selector such as 'Wireless0', 'Wireless 1', or 'Wireless 4'.",
                },
                "macFilterEnabled": {
                    "type": "boolean",
                    "description": "Enable or disable wireless MAC filtering on wireless servers.",
                },
                "allowAccess": {
                    "type": "boolean",
                    "description": "When MAC filtering is enabled: true = allow listed MACs, false = deny listed MACs.",
                },
                "macFilterEntries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "MAC addresses to add to the filter table.",
                },
                "clearMacFilter": {
                    "type": "boolean",
                    "description": "Clear the MAC filter table before adding macFilterEntries.",
                },
                "resetAssociations": {
                    "type": "boolean",
                    "description": "Reset wireless associations so new filters/settings take effect immediately.",
                },
                "dhcpEnabled": {
                    "type": "boolean",
                    "description": "For wireless clients, enable DHCP in the selected wireless profile.",
                },
                "ipaddress": {
                    "type": "string",
                    "description": "For wireless clients with DHCP disabled, profile IPv4 address.",
                },
                "subnetMask": {
                    "type": "string",
                    "description": "For wireless clients with DHCP disabled, profile subnet mask.",
                },
                "defaultGateway": {
                    "type": "string",
                    "description": "For wireless clients with DHCP disabled, profile default gateway.",
                },
                "dnsServer": {
                    "type": "string",
                    "description": "For wireless clients with DHCP disabled, profile DNS server.",
                },
            },
            "required": ["deviceName"],
        },
    },
    {
        "name": "configureDhcpServer",
        "description": (
            "Configure Packet Tracer DHCP server processes on servers, home gateways, or "
            "other supported devices. Supports enabling/disabling the service, managing pools, "
            "and setting excluded ranges."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Device name (must exist)."},
                "portName": {
                    "type": "string",
                    "description": "Optional port selector for devices that expose multiple DHCP server processes.",
                },
                "enabled": {
                    "type": "boolean",
                    "description": "Enable or disable the DHCP server process.",
                },
                "poolName": {
                    "type": "string",
                    "description": "Pool name to create, update, or remove.",
                },
                "removePool": {
                    "type": "boolean",
                    "description": "Remove the named DHCP pool instead of creating/updating it.",
                },
                "networkAddress": {
                    "type": "string",
                    "description": "Network address for the DHCP pool.",
                },
                "subnetMask": {
                    "type": "string",
                    "description": "Subnet mask for the DHCP pool.",
                },
                "defaultGateway": {
                    "type": "string",
                    "description": "Default router/gateway handed out by the DHCP pool.",
                },
                "dnsServer": {
                    "type": "string",
                    "description": "DNS server handed out by the DHCP pool.",
                },
                "startIp": {
                    "type": "string",
                    "description": "First leasable IP address.",
                },
                "endIp": {
                    "type": "string",
                    "description": "Last leasable IP address.",
                },
                "maxUsers": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Maximum users/leases for the DHCP pool.",
                },
                "clearExcludedRanges": {
                    "type": "boolean",
                    "description": "Remove all excluded address ranges before applying excludedRanges.",
                },
                "excludedRanges": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "startIp": {"type": "string"},
                            "endIp": {"type": "string"},
                        },
                        "required": ["startIp", "endIp"],
                    },
                    "description": "Excluded address ranges to add to the DHCP server process.",
                },
            },
            "required": ["deviceName"],
        },
    },
    {
        "name": "configureHomeRouter",
        "description": (
            "Configure HomeRouter-PT-AC / Linksys-style gateway features such as WAN mode, "
            "default gateway, remote management, NAT port forwarding, and DMZ."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Wireless router / home gateway device name."},
                "internetConnectionType": {
                    "type": "string",
                    "enum": HOME_ROUTER_WAN_TYPES,
                    "description": "WAN/Internet mode: dhcp, pppoe, or static.",
                },
                "defaultGateway": {
                    "type": "string",
                    "description": "Default gateway for the home router.",
                },
                "remoteManagementEnabled": {
                    "type": "boolean",
                    "description": "Enable or disable remote management.",
                },
                "clearNatEntries": {
                    "type": "boolean",
                    "description": "Remove all existing NAT/port-forwarding entries before applying natEntries.",
                },
                "natEntries": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "externalPort": {"type": "integer", "minimum": 1, "maximum": 65535},
                            "internalPort": {"type": "integer", "minimum": 1, "maximum": 65535},
                            "protocol": {"type": "string", "enum": HOME_ROUTER_NAT_PROTOCOLS},
                            "ipAddress": {"type": "string"},
                            "enabled": {"type": "boolean"},
                        },
                        "required": ["name", "externalPort", "internalPort", "protocol", "ipAddress"],
                    },
                    "description": "Port-forwarding / NAT entries to add.",
                },
                "dmzEnabled": {
                    "type": "boolean",
                    "description": "Enable or disable DMZ.",
                },
                "dmzIpAddress": {
                    "type": "string",
                    "description": "DMZ target IP address when dmzEnabled is true.",
                },
            },
            "required": ["deviceName"],
        },
    },
    {
        "name": "controlIotDevice",
        "description": (
            "Control MCU/SBC/Thing-class IoT devices. Supports digital and analog outputs, "
            "enabling OPC/CIP/industrial services, and Thing rotation/custom text overlays."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "IoT device name (must exist)."},
                "digitalOutputs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "slot": {"type": "integer", "minimum": 0},
                            "value": {"type": "integer"},
                        },
                        "required": ["slot", "value"],
                    },
                    "description": "Digital slot writes, e.g. [{slot: 0, value: 1}].",
                },
                "analogOutputs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "slot": {"type": "integer", "minimum": 0},
                            "value": {"type": "integer"},
                        },
                        "required": ["slot", "value"],
                    },
                    "description": "Analog slot writes, e.g. [{slot: 0, value: 512}].",
                },
                "opcEnabled": {
                    "type": "boolean",
                    "description": "Enable or disable OPC on supported MCU/SBC/Thing devices.",
                },
                "cipEnabled": {
                    "type": "boolean",
                    "description": "Enable or disable CIP on supported MCU/SBC/Thing devices.",
                },
                "profinetPorts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports on which to enable Profinet.",
                },
                "goosePublisherPorts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports on which to enable GOOSE publisher.",
                },
                "gooseSubscriberPorts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports on which to enable GOOSE subscriber.",
                },
                "svPublisherPorts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports on which to enable sampled-value publisher.",
                },
                "svSubscriberPorts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports on which to enable sampled-value subscriber.",
                },
                "thingRotation": {
                    "type": "number",
                    "description": "Workspace rotation angle for Thing-style devices.",
                },
                "customTexts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "x": {"type": "integer"},
                            "y": {"type": "integer"},
                            "width": {"type": "integer", "minimum": 1},
                            "height": {"type": "integer", "minimum": 1},
                            "text": {"type": "string"},
                        },
                        "required": ["text"],
                    },
                    "description": "Custom text labels to place on Thing-style devices.",
                },
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
    {
        "name": "setSimulationMode",
        "description": (
            "Switch Packet Tracer between simulation mode and realtime mode. "
            "Simulation mode is required before sending PDUs or stepping through traffic."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "toSimMode": {
                    "type": "boolean",
                    "description": "true = simulation mode, false = realtime mode.",
                },
            },
            "required": ["toSimMode"],
        },
    },
    {
        "name": "getSimulationStatus",
        "description": (
            "Query the current simulation state: mode (realtime or simulation), "
            "elapsed simulation time, PDU frame count, and current frame index."
        ),
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "stepSimulation",
        "description": (
            "Step the simulation forward or backward, or reset it entirely. "
            "PT must already be in simulation mode (use setSimulationMode first)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "direction": {
                    "type": "string",
                    "enum": ["forward", "backward", "reset"],
                    "description": (
                        "'forward' advances one step, 'backward' goes back one step, "
                        "'reset' clears all PDUs and returns to time 0."
                    ),
                },
                "steps": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "description": "Number of steps to take (ignored for 'reset'). Defaults to 1.",
                },
            },
            "required": ["direction"],
        },
    },
    {
        "name": "sendPdu",
        "description": (
            "Add an ICMP ping PDU between two devices using PT's native Simple PDU mechanism. "
            "Automatically enables simulation mode if not already active. "
            "Use stepSimulation to advance and getPduResults to check if the ping succeeded."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "sourceDevice": {
                    "type": "string",
                    "description": "Name of the source device.",
                },
                "destinationDevice": {
                    "type": "string",
                    "description": "Name of the destination device.",
                },
            },
            "required": ["sourceDevice", "destinationDevice"],
        },
    },
    {
        "name": "renameDevice",
        "description": "Rename an existing device. The new name must be unique in the workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Current device name."},
                "newName": {"type": "string", "description": "New unique name for the device."},
            },
            "required": ["deviceName", "newName"],
        },
    },
    {
        "name": "moveDevice",
        "description": "Move a device to new coordinates on the logical workspace canvas.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Device to reposition."},
                "x": {"type": "number", "description": "New X coordinate."},
                "y": {"type": "number", "description": "New Y coordinate."},
            },
            "required": ["deviceName", "x", "y"],
        },
    },
    {
        "name": "setPower",
        "description": "Power a device on or off.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {"type": "string", "description": "Device name."},
                "power": {
                    "type": "boolean",
                    "description": "true = power on, false = power off.",
                },
            },
            "required": ["deviceName", "power"],
        },
    },
    {
        "name": "getPduResults",
        "description": (
            "Read the outcome of PDUs in the current simulation - "
            "source, destination, traffic type, and status (accepted/dropped/in_transit/etc). "
            "Call after stepSimulation to verify connectivity. "
            "Use the types filter to show only ICMP, TCP, etc. and hide STP/DTP background noise."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Only return frames matching these traffic type names "
                        "(e.g. [\"ICMP\"], [\"ICMP\",\"ARP\"]). Omit to return all frames."
                    ),
                },
            },
            "required": [],
        },
    },
    {
        "name": "getCommandLog",
        "description": (
            "Read the IOS command history logged by Packet Tracer. "
            "Optionally filter by device name and cap the number of returned entries."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "deviceName": {
                    "type": "string",
                    "description": "Return only entries from this device. Omit to return all devices.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 500,
                    "description": "Maximum entries to return, newest first. Defaults to 50.",
                },
            },
            "required": [],
        },
    },
]

TOOLS_BY_NAME: dict[str, dict] = {t["name"]: t for t in TOOLS}
