# Changelog

## 0.1.15

- Added custom variable writes for Thing-class IoT devices so MCP rules can drive prebuilt Door/Window state variables, not only raw I/O pins.
- Extended `inspectIotDevice` with optional sub-component index probes and truncated `serializeToXml()` previews for debugging Packet Tracer Thing internals.

## 0.1.14

- Accepted both `deviceName + targetDeviceName` and `targetDeviceName + nearDeviceName` forms for IoT proximity conditions.

## 0.1.13

- Added persistent IoT automation timers with `startIotAutomation`, `stopIotAutomation`, and `getIotAutomationStatus`.
- Extended IoT conditions with proximity checks, composite conditions, candidate device attributes, sensor-state fallback, and physical-environment values.
- Added `inspectEnvironment` and `configureEnvironment` so demos can inspect or adjust Packet Tracer environment keys such as wind before running IoT rules.

## 0.1.12

- Added `inspectIotDevice` to expose IoT/Thing capabilities, selected external attributes, slot counts, IoE client presence, and custom variables.
- Added `runIotAutomation` for MCP-side one-shot IoT condition/action workflows such as wind-triggered window closure and RFID-triggered door opening.
- Expanded `controlIotDevice` with sub-component switching, serial output notes, serial clearing, and action-time device movement.
- Documented the Packet Tracer limitation that GUI IoE Registration Server Conditions rules are visible in the UI but are not exposed as writable `IpcAPI` server methods.

## 0.1.11

- Fixed topology connection reconstruction by using the documented `Cable::getOtherPort()`, `Cable::getPort1()`, `Cable::getPort2()`, and `Antenna::getReceiverAt()` APIs.
- Improved `getNetwork` discovery statistics so Packet Tracer link discovery failures are easier to diagnose.

## 0.1.10

- Added port-level link discovery fallback for Packet Tracer builds where `Network::getLinkCount()` reports zero while `Port::getLink()` is available.
- Added richer interface diagnostics in `getNetwork`, including remote port names, link light status, protocol/port state, wireless flag, and port type.
- Added `auditNetwork` for generic topology health checks covering expected devices, disconnected nodes, wireless association, and optional green-link validation.

## 0.1.9

- Added `getBridgeInfo` so users can verify which Packet Tracer `.pts` bridge is loaded.
- Added explicit `none`, `null`, and `iot-open` authentication aliases for Packet Tracer `eAuthenNull = 0`, while keeping `open` mapped to documented `eAuthenOpen = 6`.
- Expanded README for fork attribution, local development, Packet Tracer packaging, and wireless caveats.
- Updated package metadata for the `Tanghui-Li/cisco-pt-mcp` fork.

## 0.1.8

- Aligned open wireless handling with Packet Tracer IoT default profiles that report `authenType = 0`.
- Documented the `eAuthenNull` versus `eAuthenOpen` behavior difference observed in Packet Tracer IoT devices.

## 0.1.7

- Added wireless client profile fallback attempts for multiple AP MAC formats and authentication variants.
- Added static IPv4 profile parameters to `configureWireless`.

## 0.1.6

- Expanded device, link, DHCP, home-router, wireless, and IoT tool support.
- Added richer `getDeviceInfo` diagnostics for wireless and IOS-capable devices.
