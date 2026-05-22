# Changelog

## 0.1.9

- Added `getBridgeInfo` so users can verify which Packet Tracer `.pts` bridge is loaded.
- Added explicit `none`, `null`, and `iot-open` authentication aliases for Packet Tracer `eAuthenNull = 0`, while keeping `open` mapped to documented `eAuthenOpen = 6`.
- Expanded README for fork attribution, local development, Packet Tracer packaging, and wireless caveats.
- Updated package metadata for the `mallocInf/cisco-pt-mcp` fork.

## 0.1.8

- Aligned open wireless handling with Packet Tracer IoT default profiles that report `authenType = 0`.
- Documented the `eAuthenNull` versus `eAuthenOpen` behavior difference observed in Packet Tracer IoT devices.

## 0.1.7

- Added wireless client profile fallback attempts for multiple AP MAC formats and authentication variants.
- Added static IPv4 profile parameters to `configureWireless`.

## 0.1.6

- Expanded device, link, DHCP, home-router, wireless, and IoT tool support.
- Added richer `getDeviceInfo` diagnostics for wireless and IOS-capable devices.
