// User-callable functions exposed by the cisco-pt-mcp bridge.
// Each returns { success: bool, ... } and is invoked via $se('runCode', 'return <fn>(<args>);').

var CISCO_PT_MCP_EXTENSION_VERSION = "0.1.13";
var CISCO_PT_MCP_BRIDGE_HOST = "127.0.0.1";
var CISCO_PT_MCP_BRIDGE_PORT = 7531;
var CISCO_PT_MCP_IOT_AUTOMATION_RULES = {};
var CISCO_PT_MCP_IOT_AUTOMATION_LOG = [];
var CISCO_PT_MCP_IOT_AUTOMATION_LOG_LIMIT = 80;

function fail(prefix, err) {
  var msg = (err && (err.message || String(err))) || "unknown error";
  return { success: false, error: prefix ? prefix + ": " + msg : msg };
}

function isFn(value, name) {
  return value && typeof value[name] === "function";
}

function getDeviceByName(deviceName) {
  return ipc.network().getDevice(deviceName);
}

function getPortWithFallbacks(device, explicitPortName, fallbackPortNames) {
  var portName = explicitPortName;
  var port = null;
  if (portName) {
    port = device.getPort(portName);
  } else {
    for (var i = 0; i < fallbackPortNames.length; i++) {
      port = device.getPort(fallbackPortNames[i]);
      if (port) {
        portName = fallbackPortNames[i];
        break;
      }
    }
  }
  return { port: port, portName: portName };
}

function getFirstProcess(device, processNames) {
  for (var i = 0; i < processNames.length; i++) {
    try {
      var process = device.getProcess(processNames[i]);
      if (process) return process;
    } catch (e) {}
  }
  return null;
}

function dedupeStrings(values) {
  var out = [];
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (!value) continue;
    if (!seen[value]) {
      seen[value] = true;
      out.push(value);
    }
  }
  return out;
}

function getActiveLogicalWorkspace() {
  return ipc.appWindow().getActiveWorkspace().getLogicalWorkspace();
}

function getPortLink(port) {
  if (!port || !isFn(port, "getLink")) return null;
  try {
    return port.getLink();
  } catch (e) {
    return null;
  }
}

function callPortEnabler(device, methodName, portNames) {
  if (!Array.isArray(portNames) || portNames.length === 0) return 0;
  if (!isFn(device, methodName)) {
    throw new Error(methodName + " is not supported on " + device.getName());
  }
  for (var i = 0; i < portNames.length; i++) {
    device[methodName](portNames[i]);
  }
  return portNames.length;
}

function getProcessCapabilities(device, processNames) {
  var out = {};
  for (var i = 0; i < processNames.length; i++) {
    var processName = processNames[i];
    try {
      var process = device.getProcess(processName);
      if (process) {
        out[processName] = true;
      }
    } catch (e) {
      out[processName] = false;
    }
  }
  return out;
}

function readDeviceExternalAttributes(device, attributeNames) {
  var result = {};
  if (!Array.isArray(attributeNames)) return result;
  for (var i = 0; i < attributeNames.length; i++) {
    var name = attributeNames[i];
    if (!name) continue;
    try {
      if (isFn(device, "getDeviceExternalAttributeValue")) {
        result[name] = device.getDeviceExternalAttributeValue(String(name));
      } else {
        result[name] = null;
      }
    } catch (e) {
      result[name] = { error: String(e && e.message ? e.message : e) };
    }
  }
  return result;
}

function listCustomVars(device) {
  var vars = [];
  if (!isFn(device, "getCustomVarsCount") || !isFn(device, "getCustomVarNameAt")) return vars;
  try {
    var count = Number(device.getCustomVarsCount());
    for (var i = 0; i < count; i++) {
      var name = String(device.getCustomVarNameAt(i));
      var value = "";
      if (isFn(device, "getCustomVarValueStrAt")) {
        value = String(device.getCustomVarValueStrAt(i));
      }
      vars.push({ name: name, value: value });
    }
  } catch (e) {}
  return vars;
}

function numericValue(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  var text = String(value).trim();
  if (!text) return NaN;
  var lowered = text.toLowerCase();
  if (lowered === "true" || lowered === "on" || lowered === "open" || lowered === "high") return 1;
  if (lowered === "false" || lowered === "off" || lowered === "closed" || lowered === "low") return 0;
  var match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number(text);
}

function getDevicePosition(device) {
  if (!device) return null;
  try {
    if (isFn(device, "getCenterXCoordinate") && isFn(device, "getCenterYCoordinate")) {
      return {
        x: Number(device.getCenterXCoordinate()),
        y: Number(device.getCenterYCoordinate()),
        source: "center",
      };
    }
  } catch (e) {}
  try {
    if (isFn(device, "getXCoordinate") && isFn(device, "getYCoordinate")) {
      return {
        x: Number(device.getXCoordinate()),
        y: Number(device.getYCoordinate()),
        source: "logical",
      };
    }
  } catch (e2) {}
  return null;
}

function getActiveEnvironment() {
  try {
    var workspace = ipc.appWindow().getActiveWorkspace();
    if (workspace && isFn(workspace, "getRootPhysicalObject")) {
      var root = workspace.getRootPhysicalObject();
      if (root && isFn(root, "getEnvironment")) return root.getEnvironment();
    }
    if (workspace && isFn(workspace, "getCurrentPhysicalObject")) {
      var current = workspace.getCurrentPhysicalObject();
      if (current && isFn(current, "getEnvironment")) return current.getEnvironment();
    }
  } catch (e) {}
  return null;
}

function readEnvironmentValueByKey(key) {
  var env = getActiveEnvironment();
  if (!env) {
    return { found: false, error: "Active physical environment is not available" };
  }
  var envKey = String(key);
  try {
    if (isFn(env, "getMetricValue")) {
      return { found: true, value: env.getMetricValue(envKey), key: envKey, source: "environmentMetric" };
    }
  } catch (e) {}
  try {
    if (isFn(env, "getEnvironmentValue")) {
      return { found: true, value: env.getEnvironmentValue(envKey), key: envKey, source: "environmentValue" };
    }
  } catch (e2) {}
  try {
    if (isFn(env, "getValueWithUnit")) {
      return { found: true, value: env.getValueWithUnit(envKey), key: envKey, source: "environmentValueWithUnit" };
    }
  } catch (e3) {}
  return { found: false, error: "Environment key is not readable: " + envKey };
}

function readFirstDeviceAttribute(device, cond) {
  var names = [];
  if (cond.attributeName) names.push(String(cond.attributeName));
  if (Array.isArray(cond.attributeNames)) {
    for (var i = 0; i < cond.attributeNames.length; i++) {
      if (cond.attributeNames[i]) names.push(String(cond.attributeNames[i]));
    }
  }
  for (var j = 0; j < names.length; j++) {
    try {
      if (isFn(device, "getDeviceExternalAttributeValue")) {
        var value = device.getDeviceExternalAttributeValue(names[j]);
        if (value !== undefined && value !== null && String(value) !== "") {
          return { found: true, value: value, source: "externalAttribute", attributeName: names[j] };
        }
      }
    } catch (e) {}
  }
  return { found: false };
}

function readFirstEnvironmentValue(cond) {
  var keys = [];
  if (cond.environmentKey) keys.push(String(cond.environmentKey));
  if (Array.isArray(cond.environmentKeys)) {
    for (var i = 0; i < cond.environmentKeys.length; i++) {
      if (cond.environmentKeys[i]) keys.push(String(cond.environmentKeys[i]));
    }
  }
  for (var j = 0; j < keys.length; j++) {
    var result = readEnvironmentValueByKey(keys[j]);
    if (result.found) return result;
  }
  return { found: false, error: keys.length > 0 ? "None of the environment keys were readable" : "" };
}

function logIotAutomationEvent(entry) {
  entry.time = (new Date()).toISOString();
  CISCO_PT_MCP_IOT_AUTOMATION_LOG.push(entry);
  while (CISCO_PT_MCP_IOT_AUTOMATION_LOG.length > CISCO_PT_MCP_IOT_AUTOMATION_LOG_LIMIT) {
    CISCO_PT_MCP_IOT_AUTOMATION_LOG.shift();
  }
}

function applyIotControlOptions(deviceName, options) {
  var device = getDeviceByName(deviceName);
  if (!device) {
    return {
      success: false,
      error: `Device ${deviceName} not found`,
      applied: [],
    };
  }

  var applied = [];

  if (Array.isArray(options.digitalOutputs) && options.digitalOutputs.length > 0) {
    if (!isFn(device, "digitalWrite")) {
      return { success: false, error: `Digital outputs are not supported on ${deviceName}`, applied: applied };
    }
    for (var i = 0; i < options.digitalOutputs.length; i++) {
      var digital = options.digitalOutputs[i] || {};
      device.digitalWrite(Number(digital.slot), Number(digital.value));
    }
    applied.push("digitalOutputs");
  }

  if (Array.isArray(options.analogOutputs) && options.analogOutputs.length > 0) {
    if (!isFn(device, "analogWrite")) {
      return { success: false, error: `Analog outputs are not supported on ${deviceName}`, applied: applied };
    }
    for (var j = 0; j < options.analogOutputs.length; j++) {
      var analog = options.analogOutputs[j] || {};
      device.analogWrite(Number(analog.slot), Number(analog.value));
    }
    applied.push("analogOutputs");
  }

  if (Array.isArray(options.subComponents) && options.subComponents.length > 0) {
    if (!isFn(device, "setSubComponentIndex")) {
      return { success: false, error: `Sub-component switching is not supported on ${deviceName}`, applied: applied };
    }
    for (var s = 0; s < options.subComponents.length; s++) {
      var sub = options.subComponents[s] || {};
      device.setSubComponentIndex(String(sub.name), Number(sub.index));
    }
    applied.push("subComponents");
  }

  if (options.serialOutput !== undefined && options.serialOutput !== null) {
    if (!isFn(device, "addSerialOutputs")) {
      return { success: false, error: `Serial output is not supported on ${deviceName}`, applied: applied };
    }
    device.addSerialOutputs(String(options.serialOutput));
    applied.push("serialOutput");
  }

  if (options.clearSerialOutputs === true) {
    if (!isFn(device, "clearSerialOutputs")) {
      return { success: false, error: `Clearing serial output is not supported on ${deviceName}`, applied: applied };
    }
    device.clearSerialOutputs();
    applied.push("clearSerialOutputs");
  }

  if (options.thingRotation !== undefined && options.thingRotation !== null) {
    var workspace = getActiveLogicalWorkspace();
    if (!workspace || !isFn(workspace, "setThingRotation")) {
      return { success: false, error: `Thing rotation is not supported in this Packet Tracer build`, applied: applied };
    }
    workspace.setThingRotation(deviceName, Number(options.thingRotation));
    applied.push("thingRotation");
  }

  if (options.moveTo && options.moveTo.x !== undefined && options.moveTo.y !== undefined) {
    if (!isFn(device, "moveToLocation")) {
      return { success: false, error: `Moving device is not supported on ${deviceName}`, applied: applied };
    }
    device.moveToLocation(Number(options.moveTo.x), Number(options.moveTo.y));
    applied.push("moveTo");
  }

  if (Array.isArray(options.customTexts) && options.customTexts.length > 0) {
    var workspaceForText = getActiveLogicalWorkspace();
    if (!workspaceForText || !isFn(workspaceForText, "setThingCustomText")) {
      return { success: false, error: `Thing custom text is not supported in this Packet Tracer build`, applied: applied };
    }
    for (var k = 0; k < options.customTexts.length; k++) {
      var label = options.customTexts[k] || {};
      workspaceForText.setThingCustomText(
        deviceName,
        Number(label.x || 0),
        Number(label.y || 0),
        Number(label.width || 120),
        Number(label.height || 24),
        String(label.text || "")
      );
    }
    applied.push("customTexts");
  }

  return {
    success: true,
    applied: applied,
  };
}

function evaluateIotCondition(condition) {
  var cond = condition || {};
  var operator = String(cond.operator || "always").toLowerCase();
  var actual = cond.overrideValue;
  var source = "overrideValue";

  if (operator === "always") {
    return { met: true, actualValue: true, expectedValue: true, operator: operator, source: "always" };
  }

  if (operator === "all" || operator === "and" || operator === "any" || operator === "or") {
    var conditions = Array.isArray(cond.conditions) ? cond.conditions : [];
    var childResults = [];
    var anyMode = operator === "any" || operator === "or";
    var met = anyMode ? false : true;
    if (conditions.length === 0) {
      return { met: false, error: "Composite condition requires a non-empty conditions array", operator: operator };
    }
    for (var c = 0; c < conditions.length; c++) {
      var child = evaluateIotCondition(conditions[c]);
      childResults.push(child);
      if (anyMode && child.met) met = true;
      if (!anyMode && !child.met) met = false;
    }
    return {
      met: met,
      operator: operator,
      conditions: childResults,
    };
  }

  if (operator === "not") {
    var nested = evaluateIotCondition(cond.condition || {});
    return {
      met: !nested.met,
      operator: operator,
      condition: nested,
    };
  }

  if (operator === "near" || operator === "within" || operator === "distance<=") {
    var sourceDevice = getDeviceByName(cond.deviceName);
    var targetDeviceName = cond.targetDeviceName || cond.nearDeviceName;
    var targetDevice = targetDeviceName ? getDeviceByName(targetDeviceName) : null;
    if (!sourceDevice || !targetDevice) {
      return {
        met: false,
        error: "Near condition requires existing deviceName and targetDeviceName",
        operator: operator,
      };
    }
    var sourcePos = getDevicePosition(sourceDevice);
    var targetPos = getDevicePosition(targetDevice);
    if (!sourcePos || !targetPos) {
      return {
        met: false,
        error: "Could not read logical coordinates for near condition",
        operator: operator,
      };
    }
    var dx = sourcePos.x - targetPos.x;
    var dy = sourcePos.y - targetPos.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var maxDistance = Number(cond.maxDistance !== undefined ? cond.maxDistance : cond.value);
    if (!isFinite(maxDistance) || maxDistance <= 0) maxDistance = 120;
    return {
      met: distance <= maxDistance,
      actualValue: distance,
      expectedValue: maxDistance,
      operator: operator,
      source: "logicalDistance",
      deviceName: cond.deviceName,
      targetDeviceName: targetDeviceName,
      sourcePosition: sourcePos,
      targetPosition: targetPos,
    };
  }

  if (actual === undefined && cond.deviceName) {
    var device = getDeviceByName(cond.deviceName);
    if (!device) {
      return { met: false, error: `Condition device ${cond.deviceName} not found`, operator: operator };
    }
    var attributeResult = readFirstDeviceAttribute(device, cond);
    if (attributeResult.found) {
      actual = attributeResult.value;
      source = attributeResult.source;
    } else if (cond.useSensorState === true && isFn(device, "getSensorState")) {
      actual = device.getSensorState();
      source = "sensorState";
    } else {
      return {
        met: false,
        error: "No condition value available; provide overrideValue or a readable attributeName/useSensorState",
        operator: operator,
      };
    }
  }

  if (actual === undefined && (cond.environmentKey || Array.isArray(cond.environmentKeys))) {
    var envResult = readFirstEnvironmentValue(cond);
    if (envResult.found) {
      actual = envResult.value;
      source = envResult.source;
    } else {
      return {
        met: false,
        error: envResult.error || "No readable environment value",
        operator: operator,
      };
    }
  }

  var expected = cond.value;
  var actualNumber = numericValue(actual);
  var expectedNumber = numericValue(expected);
  var met = false;

  if (operator === ">" || operator === "gt") met = actualNumber > expectedNumber;
  else if (operator === ">=" || operator === "gte") met = actualNumber >= expectedNumber;
  else if (operator === "<" || operator === "lt") met = actualNumber < expectedNumber;
  else if (operator === "<=" || operator === "lte") met = actualNumber <= expectedNumber;
  else if (operator === "==" || operator === "=" || operator === "eq") met = String(actual) === String(expected);
  else if (operator === "!=" || operator === "ne") met = String(actual) !== String(expected);
  else if (operator === "truthy") met = !!actual;
  else if (operator === "falsy") met = !actual;
  else throw new Error("Unsupported condition operator: " + operator);

  return {
    met: met,
    actualValue: actual,
    expectedValue: expected,
    operator: operator,
    source: source,
  };
}

function defaultIotAutomationActions(ruleName) {
  if (ruleName === "wind-close-window") {
    return [{
      deviceName: "Window",
      digitalOutputs: [{ slot: 0, value: 0 }],
    }];
  }
  if (ruleName === "rfid-open-door") {
    return [{
      deviceName: "DOOR-ACCESS",
      digitalOutputs: [{ slot: 0, value: 1 }],
    }];
  }
  return [];
}

function defaultIotAutomationCondition(ruleName) {
  if (ruleName === "wind-close-window") {
    return {
      operator: "any",
      conditions: [
        {
          environmentKeys: ["Wind", "Wind Speed", "WindSpeed", "wind", "wind speed"],
          operator: ">=",
          value: 20,
        },
        {
          deviceName: "Wind_Detector",
          attributeNames: ["Wind", "Wind Speed", "WindSpeed", "wind", "wind speed", "speed", "Speed", "level", "Level", "value", "Value"],
          useSensorState: true,
          operator: ">=",
          value: 1,
        },
      ],
    };
  }
  if (ruleName === "rfid-open-door") {
    return {
      deviceName: "RFID-CARD-ADMIN",
      targetDeviceName: "RFID-ACCESS",
      operator: "near",
      maxDistance: 120,
    };
  }
  return { operator: "always" };
}

function resolveIotAutomationInputs(ruleName, condition, actions) {
  var normalizedRule = String(ruleName || "custom").toLowerCase();
  return {
    ruleName: normalizedRule,
    condition: condition || defaultIotAutomationCondition(normalizedRule),
    actions: Array.isArray(actions) && actions.length > 0
      ? actions
      : defaultIotAutomationActions(normalizedRule),
  };
}

function executeIotAutomationRule(ruleName, condition, actions, dryRun) {
  var resolved = resolveIotAutomationInputs(ruleName, condition, actions);
  var conditionResult = evaluateIotCondition(resolved.condition || { operator: "always" });

  if (!conditionResult.met) {
    return {
      success: true,
      ruleName: resolved.ruleName,
      condition: conditionResult,
      actionsApplied: [],
      message: "Condition was not met; no IoT action applied",
    };
  }

  if (dryRun === true) {
    return {
      success: true,
      ruleName: resolved.ruleName,
      condition: conditionResult,
      dryRun: true,
      plannedActions: resolved.actions,
      actionsApplied: [],
    };
  }

  var actionResults = [];
  for (var i = 0; i < resolved.actions.length; i++) {
    var action = resolved.actions[i] || {};
    if (!action.deviceName) {
      actionResults.push({ success: false, error: "Action missing deviceName", actionIndex: i });
      continue;
    }
    var result = applyIotControlOptions(action.deviceName, action);
    result.deviceName = action.deviceName;
    result.actionIndex = i;
    actionResults.push(result);
    if (!result.success) {
      return {
        success: false,
        ruleName: resolved.ruleName,
        condition: conditionResult,
        actionsApplied: actionResults,
        error: result.error,
      };
    }
  }

  return {
    success: true,
    ruleName: resolved.ruleName,
    condition: conditionResult,
    actionsApplied: actionResults,
    message: "IoT automation rule executed",
  };
}

function iotAutomationTick(ruleName) {
  var rule = CISCO_PT_MCP_IOT_AUTOMATION_RULES[ruleName];
  if (!rule || !rule.enabled) return;
  var conditionResult = evaluateIotCondition(rule.condition || { operator: "always" });
  var shouldApply = !!conditionResult.met;
  if (rule.triggerMode === "rising" && rule.lastMet === true) shouldApply = false;
  if (rule.triggerMode === "once" && rule.triggerCount > 0) shouldApply = false;

  var actionResults = [];
  var error = "";
  if (shouldApply) {
    for (var i = 0; i < rule.actions.length; i++) {
      var action = rule.actions[i] || {};
      if (!action.deviceName) {
        actionResults.push({ success: false, error: "Action missing deviceName", actionIndex: i });
        error = "Action missing deviceName";
        break;
      }
      var result = applyIotControlOptions(action.deviceName, action);
      result.deviceName = action.deviceName;
      result.actionIndex = i;
      actionResults.push(result);
      if (!result.success) {
        error = result.error || "Action failed";
        break;
      }
    }
    if (!error) rule.triggerCount += 1;
  }

  rule.tickCount += 1;
  rule.lastMet = !!conditionResult.met;
  rule.lastRunAt = (new Date()).toISOString();
  rule.lastResult = {
    success: error ? false : true,
    ruleName: ruleName,
    condition: conditionResult,
    actionsApplied: actionResults,
    skippedByTriggerMode: conditionResult.met && !shouldApply,
    error: error,
  };
  logIotAutomationEvent({
    ruleName: ruleName,
    conditionMet: !!conditionResult.met,
    actionCount: actionResults.length,
    skippedByTriggerMode: conditionResult.met && !shouldApply,
    error: error,
  });

  if (rule.triggerMode === "once" && rule.triggerCount > 0) {
    stopIotAutomation(ruleName);
  }
}

function automationRuleSnapshot(rule) {
  if (!rule) return null;
  return {
    ruleName: rule.ruleName,
    enabled: rule.enabled,
    intervalMs: rule.intervalMs,
    triggerMode: rule.triggerMode,
    tickCount: rule.tickCount,
    triggerCount: rule.triggerCount,
    lastMet: rule.lastMet,
    lastRunAt: rule.lastRunAt,
    lastResult: rule.lastResult,
    condition: rule.condition,
    actions: rule.actions,
  };
}

var WIRELESS_AUTH_TYPES = {
  none: 0,
  null: 0,
  "iot-open": 0,
  open: 6,
  wep: 1,
  "wpa-psk": 2,
  "wpa2-psk": 4,
};

var WIRELESS_ENCRYPT_TYPES = {
  none: 0,
  "wep-64": 1,
  "wep-128": 2,
  tkip: 3,
  aes: 4,
};

var WIRELESS_NETWORK_TYPES = {
  disabled: 0,
  b: 1,
  g: 2,
  "bg-mixed": 3,
  n: 4,
  a: 5,
  mixed: 7,
};

var HOME_ROUTER_INTERNET_TYPES = {
  dhcp: 0,
  pppoe: 1,
  static: 2,
};

var HOME_ROUTER_NAT_PROTOCOLS = {
  tcp: 0,
  udp: 1,
  both: 2,
};

getBridgeInfo = function () {
  return {
    success: true,
    name: "cisco-pt-mcp",
    extensionVersion: CISCO_PT_MCP_EXTENSION_VERSION,
    bridge: {
      host: CISCO_PT_MCP_BRIDGE_HOST,
      port: CISCO_PT_MCP_BRIDGE_PORT,
      transport: "socket.io/websocket",
    },
    packetTracerApi: {
      ipcAvailable: typeof ipc !== "undefined",
      networkAvailable: typeof ipc !== "undefined" && isFn(ipc, "network"),
      appWindowAvailable: typeof ipc !== "undefined" && isFn(ipc, "appWindow"),
    },
    capabilities: [
      "workspace",
      "devices",
      "links",
      "modules",
      "ios",
      "simulation",
      "wireless",
      "dhcp",
      "home-router",
      "iot",
      "iot-automation",
      "environment",
      "topology-audit",
    ],
  };
};

var WIDE_CHANNEL_VALUES = {
  auto: 0,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 5,
  8: 6,
  9: 7,
};

function mapEnumValue(mapping, rawValue, fieldName) {
  if (rawValue === undefined || rawValue === null) return null;
  var key = String(rawValue).toLowerCase();
  if (!mapping.hasOwnProperty(key)) {
    throw new Error("Unsupported " + fieldName + ": " + rawValue);
  }
  return mapping[key];
}

function mapStandardChannel(channel) {
  if (channel === undefined || channel === null) return null;
  var value = Number(channel);
  if (value < 1 || value > 11 || Math.floor(value) !== value) {
    throw new Error("Unsupported standardChannel: " + channel);
  }
  return value - 1;
}

function mapWideChannel(channel) {
  if (channel === undefined || channel === null) return null;
  var key = String(channel).toLowerCase();
  if (!WIDE_CHANNEL_VALUES.hasOwnProperty(key)) {
    throw new Error("Unsupported wideChannel: " + channel);
  }
  return WIDE_CHANNEL_VALUES[key];
}

function getWirelessProcess(device, wirelessPort) {
  var processNames = ["WirelessServer", "WirelessClient", "WirelessCommon", "AccessPoint", "WlcProcess"];
  for (var i = 0; i < processNames.length; i++) {
    try {
      var process = device.getProcess(processNames[i]);
      if (!process) continue;
      if (!isFn(process, "setSsid") && !isFn(process, "setAuthenType") && !isFn(process, "setEncryptType")) {
        continue;
      }
      if (wirelessPort !== undefined && wirelessPort !== null) {
        if (!isFn(process, "setPort")) continue;
        var portSetResult = process.setPort(wirelessPort);
        if (portSetResult === false) continue;
      }
      return process;
    } catch (e) {}
  }
  return null;
}

function applyWirelessClientProfile(process, ssid, authType, encryption, password, wepKey, networkType) {
  if (!ssid || !isFn(process, "setCurrentProfileStringIPs")) return false;

  var profileOptions = arguments.length >= 8 && arguments[7] ? arguments[7] : {};
  var profileName = String(ssid);
  var apMac = findVisibleWirelessNetworkMac(process, ssid);
  var currentProfile = null;
  try {
    if (isFn(process, "getCurrentProfile")) currentProfile = process.getCurrentProfile();
  } catch (e) {}

  var netType = networkType !== undefined && networkType !== null
    ? mapEnumValue(WIRELESS_NETWORK_TYPES, networkType, "networkType")
    : profileNumberOrDefault(currentProfile, "networkType", WIRELESS_NETWORK_TYPES["bg-mixed"]);
  var auth = authType !== undefined && authType !== null
    ? mapEnumValue(WIRELESS_AUTH_TYPES, authType, "authType")
    : WIRELESS_AUTH_TYPES.open;
  var encrypt = encryption !== undefined && encryption !== null
    ? mapEnumValue(WIRELESS_ENCRYPT_TYPES, encryption, "encryption")
    : WIRELESS_ENCRYPT_TYPES.none;

  var dhcpOn = profileOptions.dhcpEnabled !== undefined && profileOptions.dhcpEnabled !== null
    ? !!profileOptions.dhcpEnabled
    : true;
  var ipAddress = dhcpOn ? "0.0.0.0" : (profileOptions.ipaddress || "0.0.0.0");
  var subnet = dhcpOn ? "0.0.0.0" : (profileOptions.subnetMask || "0.0.0.0");
  var gateway = dhcpOn ? "0.0.0.0" : (profileOptions.defaultGateway || "0.0.0.0");
  var dns = dhcpOn ? "0.0.0.0" : (profileOptions.dnsServer || "0.0.0.0");

  var authCandidates = [];
  pushUnique(authCandidates, auth);
  pushUnique(authCandidates, profileNumberOrDefault(currentProfile, "authenType", null));
  if (auth === WIRELESS_AUTH_TYPES.open) pushUnique(authCandidates, 0);

  var macCandidates = [];
  pushUnique(macCandidates, apMac);
  pushUnique(macCandidates, normalizeMacForProfile(apMac));
  pushUnique(macCandidates, safeToString(safeGet(currentProfile, "macAddress")));
  pushUnique(macCandidates, "");

  var errors = [];
  for (var authIdx = 0; authIdx < authCandidates.length; authIdx++) {
    for (var macIdx = 0; macIdx < macCandidates.length; macIdx++) {
      var args = [
        profileName,
        String(ssid),
        netType,
        macCandidates[macIdx],
        authCandidates[authIdx],
        encrypt,
        wepKey || "",
        "",
        password || "",
        dhcpOn,
        true,
        ipAddress,
        subnet,
        gateway,
        dns
      ];
      var baseLabel = "auth=" + authCandidates[authIdx] + ",mac=" + (macCandidates[macIdx] || "<empty>");

      var callResult = tryWirelessProfileCall(process, args, 15, baseLabel + ",argc=15", errors);
      if (callResult.success) return callResult.result;

      callResult = tryWirelessProfileCall(process, args.concat([""]), 16, baseLabel + ",argc=16", errors);
      if (callResult.success) return callResult.result;

      callResult = tryWirelessProfileCall(process, args, 14, baseLabel + ",argc=14", errors);
      if (callResult.success) return callResult.result;
    }
  }

  var error = new Error("all wireless profile variants failed: " + errors.slice(0, 8).join(" | "));
  error.profileErrors = errors;
  throw error;
}

function findVisibleWirelessNetworkMac(process, ssid) {
  if (!isFn(process, "getCurrentNetworkCount") || !isFn(process, "getCurrentNetworkAt")) return "";
  try {
    var count = process.getCurrentNetworkCount();
    for (var i = 0; i < count; i++) {
      var profile = process.getCurrentNetworkAt(i);
      if (!profile) continue;
      var profileSsid = safeToString(safeGet(profile, "ssid"));
      if (profileSsid === String(ssid)) {
        return safeToString(safeGet(profile, "macAddress"));
      }
    }
  } catch (e) {}
  return "";
}

function profileNumberOrDefault(profile, prop, fallback) {
  var value = safeGet(profile, prop);
  if (value === undefined || value === null || value === "") return fallback;
  var parsed = parseInt(safeToString(value), 10);
  return isNaN(parsed) ? fallback : parsed;
}

function pushUnique(values, value) {
  if (value === undefined || value === null) return;
  for (var i = 0; i < values.length; i++) {
    if (values[i] === value) return;
  }
  values.push(value);
}

function normalizeMacForProfile(mac) {
  var raw = safeToString(mac).replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  if (raw.length !== 12) return "";
  return raw.substr(0, 2) + ":" + raw.substr(2, 2) + ":" + raw.substr(4, 2) + ":" +
    raw.substr(6, 2) + ":" + raw.substr(8, 2) + ":" + raw.substr(10, 2);
}

function tryWirelessProfileCall(process, args, argc, label, errors) {
  try {
    var result;
    if (argc === 14) {
      result = process.setCurrentProfileStringIPs(
        args[0], args[1], args[2], args[3], args[4], args[5], args[6],
        args[7], args[8], args[9], args[10], args[11], args[12], args[13]
      );
    } else if (argc === 16) {
      result = process.setCurrentProfileStringIPs(
        args[0], args[1], args[2], args[3], args[4], args[5], args[6],
        args[7], args[8], args[9], args[10], args[11], args[12], args[13],
        args[14], args[15]
      );
    } else {
      result = process.setCurrentProfileStringIPs(
        args[0], args[1], args[2], args[3], args[4], args[5], args[6],
        args[7], args[8], args[9], args[10], args[11], args[12], args[13],
        args[14]
      );
    }
    if (result !== false) return { success: true, result: result };
    errors.push(label + " returned false");
  } catch (e) {
    errors.push(label + " threw " + safeToString(e && (e.message || e)));
  }
  return { success: false };
}

function safeGet(obj, prop) {
  try {
    if (obj && obj[prop] !== undefined && obj[prop] !== null) return obj[prop];
  } catch (e) {}
  return null;
}

function safeToString(value) {
  if (value === undefined || value === null) return "";
  try {
    return String(value);
  } catch (e) {
    return "";
  }
}

function objectToPlain(value, depth) {
  if (value === undefined || value === null) return value;
  if (depth <= 0) return safeToString(value);
  if (typeof value !== "object") return value;

  var out = { stringValue: safeToString(value) };
  try {
    for (var key in value) {
      try {
        var member = value[key];
        if (typeof member !== "function") {
          out[key] = objectToPlain(member, depth - 1);
        }
      } catch (memberError) {
        out[key] = "error: " + safeToString(memberError && (memberError.message || memberError));
      }
    }
  } catch (e) {
    out.error = safeToString(e && (e.message || e));
  }
  return out;
}

function wirelessProfileToObject(profile) {
  if (!profile) return null;
  return {
    name: safeToString(safeGet(profile, "name")),
    ssid: safeToString(safeGet(profile, "ssid")),
    macAddress: safeToString(safeGet(profile, "macAddress")),
    authenType: safeToString(safeGet(profile, "authenType")),
    networkType: safeToString(safeGet(profile, "networkType")),
    ipAddress: safeToString(safeGet(profile, "ipAddress")),
    subnetMask: safeToString(safeGet(profile, "subnetMask")),
    defaultGateway: safeToString(safeGet(profile, "defaultGateway")),
    dnsServer: safeToString(safeGet(profile, "dnsServer")),
    isDhcpEnabled: safeToString(safeGet(profile, "isDhcpEnabled")),
  };
}

function getWirelessDiagnostics(device) {
  var process = getFirstProcess(device, ["WirelessClient", "WirelessServer", "WirelessCommon", "AccessPoint", "WlcProcess"]);
  if (!process) return null;

  var info = {};
  try {
    if (isFn(process, "getSsid")) info.ssid = safeToString(process.getSsid());
    if (isFn(process, "getAuthenType")) info.authenType = safeToString(process.getAuthenType());
    if (isFn(process, "getEncryptType")) info.encryptType = safeToString(process.getEncryptType());
    if (isFn(process, "getStandardChannel")) info.standardChannel = safeToString(process.getStandardChannel());
    if (isFn(process, "getCurrentApMac")) info.currentApMac = safeToString(process.getCurrentApMac());
    if (isFn(process, "getCurrentProfile")) info.currentProfile = wirelessProfileToObject(process.getCurrentProfile());
    if (isFn(process, "getCurrentNetworkCount") && isFn(process, "getCurrentNetworkAt")) {
      var networks = [];
      var count = process.getCurrentNetworkCount();
      for (var i = 0; i < count; i++) {
        networks.push(wirelessProfileToObject(process.getCurrentNetworkAt(i)));
      }
      info.visibleNetworks = networks;
    }
  } catch (e) {
    info.error = safeToString(e && (e.message || e));
  }
  return info;
}

function getIosProbe(device) {
  if (!isFn(device, "enterCommand")) return null;
  try {
    if (isFn(device, "skipBoot")) device.skipBoot();
    var result = device.enterCommand("show ip interface brief", "enable");
    return objectToPlain(result, 2);
  } catch (e) {
    return "error: " + safeToString(e && (e.message || e));
  }
}

function legacyProfileArgs(process, ssid, authType, encryption, password, wepKey, networkType) {
  var profileName = String(ssid);
  var netType = networkType !== undefined && networkType !== null
    ? mapEnumValue(WIRELESS_NETWORK_TYPES, networkType, "networkType")
    : WIRELESS_NETWORK_TYPES["bg-mixed"];
  var auth = authType !== undefined && authType !== null
    ? mapEnumValue(WIRELESS_AUTH_TYPES, authType, "authType")
    : WIRELESS_AUTH_TYPES.open;
  var encrypt = encryption !== undefined && encryption !== null
    ? mapEnumValue(WIRELESS_ENCRYPT_TYPES, encryption, "encryption")
    : WIRELESS_ENCRYPT_TYPES.none;

  return [
    profileName,
    String(ssid),
    netType,
    findVisibleWirelessNetworkMac(process, ssid),
    auth,
    encrypt,
    wepKey || "",
    "",
    password || "",
    true,
    true,
    "0.0.0.0",
    "0.0.0.0",
    "0.0.0.0",
    "0.0.0.0"
  ];
}

function getDhcpServerProcess(device, portName) {
  var direct = getFirstProcess(device, ["DhcpServerProcess"]);
  if (direct) return direct;

  var main = getFirstProcess(device, ["DhcpServerMainProcess"]);
  if (!main || !isFn(main, "getDhcpServerProcessByPortName")) return null;

  var candidatePorts = dedupeStrings([
    portName,
    "FastEthernet0",
    "GigabitEthernet0",
    "GigabitEthernet0/0/0",
    "GigabitEthernet 1",
    "Ethernet0",
    "Wireless0",
    "Wireless 1",
    "Internet",
  ]);

  for (var i = 0; i < candidatePorts.length; i++) {
    try {
      var process = main.getDhcpServerProcessByPortName(candidatePorts[i]);
      if (process) return process;
    } catch (e) {}
  }
  return null;
}

function getDhcpPool(process, poolName) {
  if (!isFn(process, "getPool")) return null;
  try {
    var pool = process.getPool(poolName);
    if (!pool) return null;
    if (!isFn(pool, "getDhcpPoolName")) return pool;
    return String(pool.getDhcpPoolName()) === String(poolName) ? pool : null;
  } catch (e) {
    return null;
  }
}

function ensureDhcpPool(process, poolName) {
  var pool = getDhcpPool(process, poolName);
  if (pool) return pool;
  if (!isFn(process, "addPool")) return null;
  process.addPool(poolName);
  return getDhcpPool(process, poolName);
}

addDevice = function (deviceName, deviceModel, x, y) {
  try {
    var deviceType = allDeviceTypes[deviceModel];

    if (deviceType === undefined) {
      return {
        success: false,
        error: `Unknown device model: ${deviceModel}`,
      };
    }

    var originalDeviceName = ipc
      .appWindow()
      .getActiveWorkspace()
      .getLogicalWorkspace()
      .addDevice(deviceType, deviceModel, x, y);

    if (!originalDeviceName) {
      return {
        success: false,
        error: `Failed to add device ${deviceName} (${deviceModel})`,
      };
    }

    var device = ipc.network().getDevice(originalDeviceName);
    device.setName(deviceName);

    if (deviceType <= 1 || deviceType == 16) {
      device.skipBoot();
    }

    return {
      success: true,
      message: `Device ${deviceName} added successfully`,
    };
  } catch (error) {
    return fail("Error adding device", error);
  }
};

addModule = function (deviceName, slot, model) {
  try {
    var device = getDeviceByName(deviceName);

    if (!device) {
      return {
        success: false,
        error: `Device ${deviceName} not found`,
      };
    }

    var moduleType = allModuleTypes[model];

    if (moduleType === undefined) {
      return {
        success: false,
        error: `Unknown module model: ${model}`,
      };
    }

    var powerState = device.getPower();
    device.setPower(false);

    var result = device.addModule(slot, moduleType, model);

    if (powerState) {
      device.setPower(true);
      device.skipBoot();
    }

    if (result != true) {
      return {
        success: false,
        error: `Failed to add module ${model} to slot ${slot} on ${deviceName}`,
      };
    }

    return {
      success: true,
      message: `Module ${model} added to ${deviceName} slot ${slot}`,
    };
  } catch (error) {
    return fail("Error adding module", error);
  }
};

addLink = function (
  device1Name,
  device1Interface,
  device2Name,
  device2Interface,
  linkType
) {
  try {
    var linkTypeValue = allLinkTypes[linkType];

    if (linkTypeValue === undefined) {
      return {
        success: false,
        error: `Unknown link type: ${linkType}`,
      };
    }

    var result = ipc
      .appWindow()
      .getActiveWorkspace()
      .getLogicalWorkspace()
      .createLink(
        device1Name,
        device1Interface,
        device2Name,
        device2Interface,
        linkTypeValue
      );

    if (result != true) {
      return {
        success: false,
        error: `Failed to create link between ${device1Name}:${device1Interface} and ${device2Name}:${device2Interface}`,
      };
    }

    return {
      success: true,
      message: `Link created between ${device1Name} and ${device2Name}`,
    };
  } catch (error) {
    return fail("Error creating link", error);
  }
};

configureEndDeviceIp = function (
  deviceName,
  dhcpEnabled,
  ipaddress,
  subnetMask,
  defaultGateway,
  dnsServer,
  interfaceName
) {
  try {
    var device = getDeviceByName(deviceName);

    if (!device) {
      return {
        success: false,
        error: `Device ${deviceName} not found`,
      };
    }

    var portInfo = getPortWithFallbacks(device, interfaceName, [
      "FastEthernet0",
      "Wireless0",
      "GigabitEthernet0/0/0",
      "GigabitEthernet0",
      "GigabitEthernet 1",
      "Ethernet0",
      "Internet",
      "Wireless 1",
    ]);
    var port = portInfo.port;
    var portName = portInfo.portName;

    if (!port) {
      return {
        success: false,
        error: `Could not find a valid network interface on ${deviceName}`,
      };
    }

    if (dhcpEnabled !== undefined && dhcpEnabled !== null) {
      if (isFn(device, "setDhcpFlag")) {
        device.setDhcpFlag(dhcpEnabled);
      }
      if (isFn(port, "setDhcpClientFlag")) {
        port.setDhcpClientFlag(dhcpEnabled);
      }
    }
    if (ipaddress && subnetMask && isFn(port, "setIpSubnetMask")) {
      port.setIpSubnetMask(ipaddress, subnetMask);
    }
    if (defaultGateway) {
      if (isFn(port, "setDefaultGateway")) {
        port.setDefaultGateway(defaultGateway);
      } else if (isFn(device, "setDefaultGateway")) {
        device.setDefaultGateway(defaultGateway);
      }
    }
    if (dnsServer) {
      if (isFn(port, "setDnsServerIp")) {
        port.setDnsServerIp(dnsServer);
      } else if (isFn(device, "setDnsServerIp")) {
        device.setDnsServerIp(dnsServer);
      }
    }

    return {
      success: true,
      message: `IP configuration applied to ${deviceName} on interface ${portName}`,
    };
  } catch (error) {
    return fail("Error configuring end device IP", error);
  }
};

configureWireless = function (
  deviceName,
  ssid,
  authType,
  encryption,
  password,
  wepKey,
  ssidBroadcastEnabled,
  standardChannel,
  wideChannel,
  networkType,
  wirelessPort,
  macFilterEnabled,
  allowAccess,
  macFilterEntries,
  clearMacFilter,
  resetAssociations,
  dhcpEnabled,
  ipaddress,
  subnetMask,
  defaultGateway,
  dnsServer
) {
  try {
    var device = getDeviceByName(deviceName);

    if (!device) {
      return {
        success: false,
        error: `Device ${deviceName} not found`,
      };
    }

    var process = getWirelessProcess(device, wirelessPort);
    if (!process) {
      return {
        success: false,
        error: wirelessPort
          ? `Could not find a wireless process on ${deviceName} for port ${wirelessPort}`
          : `Could not find a configurable wireless process on ${deviceName}`,
      };
    }

    var applied = [];
    var warnings = [];

    if (ssid !== undefined && ssid !== null) {
      if (!isFn(process, "setSsid")) {
        return { success: false, error: `SSID is not supported on ${deviceName}` };
      }
      process.setSsid(ssid);
      applied.push("ssid");
    }

    if (authType !== undefined && authType !== null) {
      if (!isFn(process, "setAuthenType")) {
        return { success: false, error: `Authentication mode is not supported on ${deviceName}` };
      }
      process.setAuthenType(mapEnumValue(WIRELESS_AUTH_TYPES, authType, "authType"));
      applied.push("authType");
    }

    if (encryption !== undefined && encryption !== null) {
      if (!isFn(process, "setEncryptType")) {
        return { success: false, error: `Encryption mode is not supported on ${deviceName}` };
      }
      process.setEncryptType(mapEnumValue(WIRELESS_ENCRYPT_TYPES, encryption, "encryption"));
      applied.push("encryption");
    }

    if (password !== undefined && password !== null) {
      if (!isFn(process, "getWpaProcess")) {
        return { success: false, error: `WPA passphrase is not supported on ${deviceName}` };
      }
      var wpaProcess = process.getWpaProcess();
      if (!isFn(wpaProcess, "setPasswd")) {
        return { success: false, error: `WPA passphrase is not supported on ${deviceName}` };
      }
      wpaProcess.setPasswd(password);
      applied.push("password");
    }

    if (wepKey !== undefined && wepKey !== null) {
      if (!isFn(process, "getWepProcess")) {
        return { success: false, error: `WEP key is not supported on ${deviceName}` };
      }
      var wepProcess = process.getWepProcess();
      if (!isFn(wepProcess, "setKey")) {
        return { success: false, error: `WEP key is not supported on ${deviceName}` };
      }
      wepProcess.setKey(wepKey);
      applied.push("wepKey");
    }

    if (ssidBroadcastEnabled !== undefined && ssidBroadcastEnabled !== null) {
      if (!isFn(process, "setSsidBrdCastEnabled")) {
        return { success: false, error: `SSID broadcast control is not supported on ${deviceName}` };
      }
      process.setSsidBrdCastEnabled(ssidBroadcastEnabled);
      applied.push("ssidBroadcastEnabled");
    }

    if (standardChannel !== undefined && standardChannel !== null) {
      if (!isFn(process, "setStandardChannel")) {
        return { success: false, error: `Standard channel is not supported on ${deviceName}` };
      }
      process.setStandardChannel(mapStandardChannel(standardChannel));
      applied.push("standardChannel");
    }

    if (wideChannel !== undefined && wideChannel !== null) {
      if (!isFn(process, "setWideChannel")) {
        return { success: false, error: `Wide channel is not supported on ${deviceName}` };
      }
      process.setWideChannel(mapWideChannel(wideChannel));
      applied.push("wideChannel");
    }

    if (networkType !== undefined && networkType !== null) {
      if (!isFn(process, "setNetworkType")) {
        return { success: false, error: `Wireless network type is not supported on ${deviceName}` };
      }
      process.setNetworkType(mapEnumValue(WIRELESS_NETWORK_TYPES, networkType, "networkType"));
      applied.push("networkType");
    }

    if (ssid !== undefined && ssid !== null && isFn(process, "setCurrentProfileStringIPs")) {
      try {
        var profileResult = applyWirelessClientProfile(
          process,
          ssid,
          authType,
          encryption,
          password,
          wepKey,
          networkType,
          {
            dhcpEnabled: dhcpEnabled,
            ipaddress: ipaddress,
            subnetMask: subnetMask,
            defaultGateway: defaultGateway,
            dnsServer: dnsServer,
          }
        );
        if (profileResult === false) {
          warnings.push("Wireless client profile returned false on " + deviceName);
        } else {
          applied.push("clientProfile");
        }
      } catch (profileError) {
        warnings.push("Wireless client profile failed on " + deviceName + ": " + safeToString(profileError && (profileError.message || profileError)));
      }
    }

    if (macFilterEnabled !== undefined && macFilterEnabled !== null) {
      if (!isFn(process, "setMacFilterEnabled")) {
        return { success: false, error: `MAC filtering is not supported on ${deviceName}` };
      }
      process.setMacFilterEnabled(macFilterEnabled);
      applied.push("macFilterEnabled");
    }

    if (allowAccess !== undefined && allowAccess !== null) {
      if (!isFn(process, "setAllowAccess")) {
        return { success: false, error: `MAC filter allow/deny mode is not supported on ${deviceName}` };
      }
      process.setAllowAccess(allowAccess);
      applied.push("allowAccess");
    }

    if (clearMacFilter) {
      if (!isFn(process, "removeAllMacEntries")) {
        return { success: false, error: `MAC filter table reset is not supported on ${deviceName}` };
      }
      process.removeAllMacEntries();
      applied.push("clearMacFilter");
    }

    if (Array.isArray(macFilterEntries) && macFilterEntries.length > 0) {
      if (!isFn(process, "addToMacFilterAddrList")) {
        return { success: false, error: `MAC filter entry updates are not supported on ${deviceName}` };
      }
      for (var i = 0; i < macFilterEntries.length; i++) {
        process.addToMacFilterAddrList(macFilterEntries[i]);
      }
      applied.push("macFilterEntries");
    }

    if (resetAssociations) {
      if (!isFn(process, "resetAllAssociations")) {
        return { success: false, error: `Association reset is not supported on ${deviceName}` };
      }
      process.resetAllAssociations();
      applied.push("resetAssociations");
    }

    if (wirelessPort !== undefined && wirelessPort !== null) {
      applied.push("wirelessPort");
    }

    if (applied.length === 0) {
      return {
        success: false,
        error: "No wireless settings were provided",
      };
    }

    return {
      success: true,
      message: `Wireless configuration applied to ${deviceName}`,
      applied: applied,
      warnings: warnings,
    };
  } catch (error) {
    return fail("Error configuring wireless", error);
  }
};

configureDhcpServer = function (
  deviceName,
  portName,
  enabled,
  poolName,
  removePool,
  networkAddress,
  subnetMask,
  defaultGateway,
  dnsServer,
  startIp,
  endIp,
  maxUsers,
  clearExcludedRanges,
  excludedRanges
) {
  try {
    var device = getDeviceByName(deviceName);
    if (!device) {
      return {
        success: false,
        error: `Device ${deviceName} not found`,
      };
    }

    var process = getDhcpServerProcess(device, portName);
    if (!process) {
      return {
        success: false,
        error: portName
          ? `Could not find a DHCP server process on ${deviceName} for port ${portName}`
          : `Could not find a DHCP server process on ${deviceName}`,
      };
    }

    var applied = [];

    if (enabled !== undefined && enabled !== null) {
      if (!isFn(process, "setEnable")) {
        return { success: false, error: `DHCP enable/disable is not supported on ${deviceName}` };
      }
      process.setEnable(enabled);
      applied.push("enabled");
    }

    if (clearExcludedRanges) {
      if (!(isFn(process, "getExcludedAddressCount") && isFn(process, "getExcludedAddressAt") && isFn(process, "removeExcludedAddress"))) {
        return { success: false, error: `Excluded range reset is not supported on ${deviceName}` };
      }
      for (var rangeIndex = process.getExcludedAddressCount() - 1; rangeIndex >= 0; rangeIndex--) {
        var range = process.getExcludedAddressAt(rangeIndex);
        if (range && range.length >= 2) {
          process.removeExcludedAddress(range[0], range[1]);
        }
      }
      applied.push("clearExcludedRanges");
    }

    if (Array.isArray(excludedRanges) && excludedRanges.length > 0) {
      if (!isFn(process, "addExcludedAddress")) {
        return { success: false, error: `Excluded range updates are not supported on ${deviceName}` };
      }
      for (var i = 0; i < excludedRanges.length; i++) {
        var excluded = excludedRanges[i] || {};
        if (excluded.startIp && excluded.endIp) {
          process.addExcludedAddress(excluded.startIp, excluded.endIp);
        }
      }
      applied.push("excludedRanges");
    }

    if (removePool) {
      if (!poolName) {
        return { success: false, error: "poolName is required when removePool is true" };
      }
      if (!isFn(process, "removePool")) {
        return { success: false, error: `Pool removal is not supported on ${deviceName}` };
      }
      process.removePool(poolName);
      applied.push("removePool");
    }

    var poolFieldsRequested =
      poolName ||
      networkAddress ||
      subnetMask ||
      defaultGateway ||
      dnsServer ||
      startIp ||
      endIp ||
      maxUsers;

    if (poolFieldsRequested && !removePool) {
      if (!poolName) {
        return { success: false, error: "poolName is required when updating DHCP pool settings" };
      }
      var pool = ensureDhcpPool(process, poolName);
      if (!pool) {
        return {
          success: false,
          error: `Could not create or retrieve DHCP pool ${poolName} on ${deviceName}`,
        };
      }

      if (networkAddress && isFn(pool, "setNetworkAddress")) {
        pool.setNetworkAddress(networkAddress);
        applied.push("networkAddress");
      }

      if (subnetMask) {
        if (isFn(pool, "setNetworkMask")) {
          var maskNetworkAddress = networkAddress;
          if (!maskNetworkAddress && isFn(pool, "getNetworkAddress")) {
            maskNetworkAddress = pool.getNetworkAddress();
          }
          if (!maskNetworkAddress) {
            return { success: false, error: "networkAddress is required before subnetMask can be applied" };
          }
          pool.setNetworkMask(maskNetworkAddress, subnetMask);
          applied.push("subnetMask");
        } else {
          return { success: false, error: `Subnet mask updates are not supported on ${deviceName}` };
        }
      }

      if (defaultGateway) {
        if (!isFn(pool, "setDefaultRouter")) {
          return { success: false, error: `Default gateway updates are not supported on ${deviceName}` };
        }
        pool.setDefaultRouter(defaultGateway);
        applied.push("defaultGateway");
      }

      if (dnsServer) {
        if (!isFn(pool, "setDnsServerIp")) {
          return { success: false, error: `DNS updates are not supported on ${deviceName}` };
        }
        pool.setDnsServerIp(dnsServer);
        applied.push("dnsServer");
      }

      if (startIp) {
        if (!isFn(pool, "setStartIp")) {
          return { success: false, error: `Start IP updates are not supported on ${deviceName}` };
        }
        pool.setStartIp(startIp);
        applied.push("startIp");
      }

      if (endIp) {
        if (!isFn(pool, "setEndIp")) {
          return { success: false, error: `End IP updates are not supported on ${deviceName}` };
        }
        pool.setEndIp(endIp);
        applied.push("endIp");
      }

      if (maxUsers !== undefined && maxUsers !== null) {
        if (!isFn(pool, "setMaxUsers")) {
          return { success: false, error: `maxUsers is not supported on ${deviceName}` };
        }
        pool.setMaxUsers(maxUsers);
        applied.push("maxUsers");
      }
    }

    if (applied.length === 0) {
      return {
        success: false,
        error: "No DHCP settings were provided",
      };
    }

    return {
      success: true,
      message: `DHCP configuration applied to ${deviceName}`,
      applied: applied,
    };
  } catch (error) {
    return fail("Error configuring DHCP server", error);
  }
};

configureHomeRouter = function (
  deviceName,
  internetConnectionType,
  defaultGateway,
  remoteManagementEnabled,
  clearNatEntries,
  natEntries,
  dmzEnabled,
  dmzIpAddress
) {
  try {
    var device = getDeviceByName(deviceName);
    if (!device) {
      return {
        success: false,
        error: `Device ${deviceName} not found`,
      };
    }

    var applied = [];

    if (internetConnectionType !== undefined && internetConnectionType !== null) {
      if (!isFn(device, "setInternetConnectionType")) {
        return { success: false, error: `Internet connection type is not supported on ${deviceName}` };
      }
      device.setInternetConnectionType(
        mapEnumValue(HOME_ROUTER_INTERNET_TYPES, internetConnectionType, "internetConnectionType")
      );
      applied.push("internetConnectionType");
    }

    if (defaultGateway) {
      if (!isFn(device, "setDefaultGateway")) {
        return { success: false, error: `Default gateway is not supported on ${deviceName}` };
      }
      device.setDefaultGateway(defaultGateway);
      applied.push("defaultGateway");
    }

    if (remoteManagementEnabled !== undefined && remoteManagementEnabled !== null) {
      if (!isFn(device, "setRemoteManagementEnable")) {
        return { success: false, error: `Remote management is not supported on ${deviceName}` };
      }
      device.setRemoteManagementEnable(remoteManagementEnabled);
      applied.push("remoteManagementEnabled");
    }

    if (clearNatEntries) {
      if (!isFn(device, "removeAllNatEntries")) {
        return { success: false, error: `NAT entry reset is not supported on ${deviceName}` };
      }
      device.removeAllNatEntries();
      applied.push("clearNatEntries");
    }

    if (Array.isArray(natEntries) && natEntries.length > 0) {
      if (!isFn(device, "addNatEntry")) {
        return { success: false, error: `NAT entries are not supported on ${deviceName}` };
      }
      for (var i = 0; i < natEntries.length; i++) {
        var entry = natEntries[i] || {};
        device.addNatEntry(
          entry.name,
          entry.externalPort,
          entry.internalPort,
          mapEnumValue(HOME_ROUTER_NAT_PROTOCOLS, entry.protocol, "protocol"),
          entry.ipAddress,
          entry.enabled !== false
        );
      }
      applied.push("natEntries");
    }

    if (dmzEnabled === false) {
      if (!isFn(device, "removeDMZEntry")) {
        return { success: false, error: `DMZ is not supported on ${deviceName}` };
      }
      device.removeDMZEntry();
      applied.push("dmzDisabled");
    } else if (dmzEnabled === true || (dmzIpAddress !== undefined && dmzIpAddress !== null)) {
      if (!dmzIpAddress) {
        return { success: false, error: "dmzIpAddress is required when enabling DMZ" };
      }
      if (!isFn(device, "setDMZEntry")) {
        return { success: false, error: `DMZ is not supported on ${deviceName}` };
      }
      device.setDMZEntry(true, dmzIpAddress);
      applied.push("dmzEnabled");
    }

    if (applied.length === 0) {
      return {
        success: false,
        error: "No home router settings were provided",
      };
    }

    return {
      success: true,
      message: `Home router configuration applied to ${deviceName}`,
      applied: applied,
    };
  } catch (error) {
    return fail("Error configuring home router", error);
  }
};

controlIotDevice = function (
  deviceName,
  digitalOutputs,
  analogOutputs,
  opcEnabled,
  cipEnabled,
  profinetPorts,
  goosePublisherPorts,
  gooseSubscriberPorts,
  svPublisherPorts,
  svSubscriberPorts,
  thingRotation,
  customTexts,
  subComponents,
  serialOutput,
  clearSerialOutputs,
  moveTo
) {
  try {
    var device = getDeviceByName(deviceName);
    if (!device) {
      return {
        success: false,
        error: `Device ${deviceName} not found`,
      };
    }

    var applied = [];

    var basicControl = applyIotControlOptions(deviceName, {
      digitalOutputs: digitalOutputs,
      analogOutputs: analogOutputs,
      thingRotation: thingRotation,
      customTexts: customTexts,
      subComponents: subComponents,
      serialOutput: serialOutput,
      clearSerialOutputs: clearSerialOutputs,
      moveTo: moveTo,
    });
    if (!basicControl.success) {
      return basicControl;
    }
    applied = applied.concat(basicControl.applied);

    if (opcEnabled === true) {
      if (!isFn(device, "enableOpc")) {
        return { success: false, error: `OPC is not supported on ${deviceName}` };
      }
      device.enableOpc();
      applied.push("opcEnabled");
    } else if (opcEnabled === false) {
      if (!isFn(device, "disableOpc")) {
        return { success: false, error: `OPC disable is not supported on ${deviceName}` };
      }
      device.disableOpc();
      applied.push("opcDisabled");
    }

    if (cipEnabled === true) {
      if (!isFn(device, "enableCip")) {
        return { success: false, error: `CIP is not supported on ${deviceName}` };
      }
      device.enableCip();
      applied.push("cipEnabled");
    } else if (cipEnabled === false) {
      if (!isFn(device, "disableCip")) {
        return { success: false, error: `CIP disable is not supported on ${deviceName}` };
      }
      device.disableCip();
      applied.push("cipDisabled");
    }

    if (callPortEnabler(device, "enableProfinetOnPort", profinetPorts) > 0) {
      applied.push("profinetPorts");
    }
    if (callPortEnabler(device, "enableGoosePublisherOnPort", goosePublisherPorts) > 0) {
      applied.push("goosePublisherPorts");
    }
    if (callPortEnabler(device, "enableGooseSubscriberOnPort", gooseSubscriberPorts) > 0) {
      applied.push("gooseSubscriberPorts");
    }
    if (callPortEnabler(device, "enableSvPublisherOnPort", svPublisherPorts) > 0) {
      applied.push("svPublisherPorts");
    }
    if (callPortEnabler(device, "enableSvSubscriberOnPort", svSubscriberPorts) > 0) {
      applied.push("svSubscriberPorts");
    }

    if (applied.length === 0) {
      return {
        success: false,
        error: "No IoT control settings were provided",
      };
    }

    return {
      success: true,
      message: `IoT control applied to ${deviceName}`,
      applied: applied,
    };
  } catch (error) {
    return fail("Error controlling IoT device", error);
  }
};

inspectIotDevice = function (deviceName, attributeNames) {
  try {
    var device = getDeviceByName(deviceName);
    if (!device) {
      return { success: false, error: `Device ${deviceName} not found` };
    }

    var info = {
      name: String(device.getName()),
      model: "",
      type: device.getType ? device.getType() : null,
      capabilities: {
        digitalWrite: isFn(device, "digitalWrite"),
        analogWrite: isFn(device, "analogWrite"),
        setSubComponentIndex: isFn(device, "setSubComponentIndex"),
        serialOutputs: isFn(device, "addSerialOutputs"),
        sensorType: isFn(device, "getSensorType"),
        sensorState: isFn(device, "getSensorState"),
        deviceExternalAttributes: isFn(device, "getDeviceExternalAttributes"),
        deviceExternalAttributeValue: isFn(device, "getDeviceExternalAttributeValue"),
      },
      processes: getProcessCapabilities(device, ["IoEClient", "IoeClient", "WirelessClient", "WirelessServer"]),
      slots: {},
      customVars: listCustomVars(device),
      requestedAttributes: readDeviceExternalAttributes(device, attributeNames),
    };

    try {
      info.model = device.getDescriptor().getModelName();
    } catch (e) {}
    try {
      if (isFn(device, "getSensorType")) info.sensorType = String(device.getSensorType());
    } catch (e2) {
      info.sensorTypeError = String(e2 && e2.message ? e2.message : e2);
    }
    try {
      if (isFn(device, "getSensorState")) info.sensorState = device.getSensorState();
    } catch (e3) {
      info.sensorStateError = String(e3 && e3.message ? e3.message : e3);
    }
    try {
      if (isFn(device, "getDeviceExternalAttributes")) {
        info.deviceExternalAttributes = String(device.getDeviceExternalAttributes());
      }
    } catch (e4) {
      info.deviceExternalAttributesError = String(e4 && e4.message ? e4.message : e4);
    }
    try {
      if (isFn(device, "getAnalogSlotsCount")) info.slots.analog = Number(device.getAnalogSlotsCount());
      if (isFn(device, "getDigitalSlotsCount")) info.slots.digital = Number(device.getDigitalSlotsCount());
      if (isFn(device, "getSlotsCount")) info.slots.total = Number(device.getSlotsCount());
    } catch (e5) {
      info.slots.error = String(e5 && e5.message ? e5.message : e5);
    }

    return {
      success: true,
      result: info,
    };
  } catch (error) {
    return fail("Error inspecting IoT device", error);
  }
};

runIotAutomation = function (ruleName, condition, actions, dryRun) {
  try {
    return executeIotAutomationRule(ruleName, condition, actions, dryRun);
  } catch (error) {
    return fail("Error running IoT automation", error);
  }
};

startIotAutomation = function (ruleName, condition, actions, intervalMs, triggerMode, runImmediately) {
  try {
    var resolved = resolveIotAutomationInputs(ruleName, condition, actions);
    if (!Array.isArray(resolved.actions) || resolved.actions.length === 0) {
      return {
        success: false,
        error: "No IoT automation actions were provided and no built-in actions matched the rule name",
      };
    }

    var normalizedMode = String(triggerMode || "continuous").toLowerCase();
    if (normalizedMode !== "continuous" && normalizedMode !== "rising" && normalizedMode !== "once") {
      return { success: false, error: "triggerMode must be continuous, rising, or once" };
    }

    var normalizedInterval = Number(intervalMs || 1000);
    if (!isFinite(normalizedInterval) || normalizedInterval < 200) normalizedInterval = 1000;
    if (normalizedInterval > 60000) normalizedInterval = 60000;

    stopIotAutomation(resolved.ruleName);

    var rule = {
      ruleName: resolved.ruleName,
      condition: resolved.condition,
      actions: resolved.actions,
      intervalMs: normalizedInterval,
      triggerMode: normalizedMode,
      enabled: true,
      tickCount: 0,
      triggerCount: 0,
      lastMet: false,
      lastRunAt: null,
      lastResult: null,
      timerId: null,
    };
    CISCO_PT_MCP_IOT_AUTOMATION_RULES[resolved.ruleName] = rule;

    rule.timerId = setInterval(function () {
      iotAutomationTick(resolved.ruleName);
    }, normalizedInterval);

    if (runImmediately !== false) {
      iotAutomationTick(resolved.ruleName);
    }

    return {
      success: true,
      message: "IoT automation rule started",
      rule: automationRuleSnapshot(rule),
    };
  } catch (error) {
    return fail("Error starting IoT automation", error);
  }
};

stopIotAutomation = function (ruleName) {
  try {
    var normalizedRule = String(ruleName || "all").toLowerCase();
    var stopped = [];
    var names = [];
    if (normalizedRule === "all") {
      for (var name in CISCO_PT_MCP_IOT_AUTOMATION_RULES) {
        if (CISCO_PT_MCP_IOT_AUTOMATION_RULES.hasOwnProperty(name)) names.push(name);
      }
    } else {
      names.push(normalizedRule);
    }

    for (var i = 0; i < names.length; i++) {
      var rule = CISCO_PT_MCP_IOT_AUTOMATION_RULES[names[i]];
      if (!rule) continue;
      if (rule.timerId !== null && rule.timerId !== undefined) {
        clearInterval(rule.timerId);
      }
      rule.enabled = false;
      rule.timerId = null;
      stopped.push(names[i]);
    }

    return {
      success: true,
      stopped: stopped,
    };
  } catch (error) {
    return fail("Error stopping IoT automation", error);
  }
};

getIotAutomationStatus = function (ruleName) {
  try {
    var normalizedRule = ruleName ? String(ruleName).toLowerCase() : "";
    var rules = {};
    for (var name in CISCO_PT_MCP_IOT_AUTOMATION_RULES) {
      if (!CISCO_PT_MCP_IOT_AUTOMATION_RULES.hasOwnProperty(name)) continue;
      if (normalizedRule && name !== normalizedRule) continue;
      rules[name] = automationRuleSnapshot(CISCO_PT_MCP_IOT_AUTOMATION_RULES[name]);
    }
    return {
      success: true,
      rules: rules,
      recentEvents: CISCO_PT_MCP_IOT_AUTOMATION_LOG.slice(-20),
    };
  } catch (error) {
    return fail("Error reading IoT automation status", error);
  }
};

inspectEnvironment = function (environmentKeys) {
  try {
    var env = getActiveEnvironment();
    if (!env) {
      return { success: false, error: "Active physical environment is not available" };
    }
    var keys = [];
    try {
      if (isFn(env, "getEnvironmentKeys")) {
        var rawKeys = env.getEnvironmentKeys();
        for (var i = 0; i < rawKeys.length; i++) keys.push(String(rawKeys[i]));
      }
    } catch (e) {}

    var requested = {};
    var requestedKeys = Array.isArray(environmentKeys) && environmentKeys.length > 0 ? environmentKeys : keys;
    for (var j = 0; j < requestedKeys.length; j++) {
      var key = String(requestedKeys[j]);
      var item = {};
      try {
        if (isFn(env, "getMetricValue")) item.metricValue = env.getMetricValue(key);
      } catch (e2) {}
      try {
        if (isFn(env, "getEnvironmentValue")) item.value = env.getEnvironmentValue(key);
      } catch (e3) {}
      try {
        if (isFn(env, "getValueWithUnit")) item.valueWithUnit = String(env.getValueWithUnit(key));
      } catch (e4) {}
      try {
        if (isFn(env, "getUnit")) item.unit = String(env.getUnit(key));
      } catch (e5) {}
      try {
        if (isFn(env, "getEnvironment")) {
          var options = env.getEnvironment(key);
          if (options) {
            if (isFn(options, "getName")) item.name = String(options.getName());
            if (isFn(options, "getID")) item.id = String(options.getID());
            if (isFn(options, "getCategory")) item.category = String(options.getCategory());
            if (isFn(options, "getValue")) item.optionValue = options.getValue();
            if (isFn(options, "getManualAdjustment")) item.manualAdjustment = options.getManualAdjustment();
            if (isFn(options, "isActive")) item.active = options.isActive();
          }
        }
      } catch (e6) {}
      requested[key] = item;
    }

    return {
      success: true,
      environmentKeys: keys,
      requested: requested,
    };
  } catch (error) {
    return fail("Error inspecting environment", error);
  }
};

configureEnvironment = function (environmentKey, value, manualAdjustment, active) {
  try {
    var env = getActiveEnvironment();
    if (!env) {
      return { success: false, error: "Active physical environment is not available" };
    }
    if (!environmentKey) {
      return { success: false, error: "environmentKey is required" };
    }

    var key = String(environmentKey);
    var applied = [];
    var options = null;
    try {
      if (isFn(env, "getEnvironment")) options = env.getEnvironment(key);
    } catch (e) {}
    if (!options) {
      return { success: false, error: "Environment key is not available: " + key };
    }

    if (value !== undefined && value !== null) {
      if (!isFn(options, "setValue")) {
        return { success: false, error: "setValue is not supported for environment key " + key };
      }
      options.setValue(Number(value));
      applied.push("value");
    }
    if (manualAdjustment !== undefined && manualAdjustment !== null) {
      if (isFn(env, "setManualAdjustment")) {
        env.setManualAdjustment(key, Number(manualAdjustment));
      } else if (isFn(options, "setManualAdjustment")) {
        options.setManualAdjustment(Number(manualAdjustment));
      } else {
        return { success: false, error: "manualAdjustment is not supported for environment key " + key };
      }
      applied.push("manualAdjustment");
    }
    if (active !== undefined && active !== null) {
      if (!isFn(options, "setActive")) {
        return { success: false, error: "setActive is not supported for environment key " + key };
      }
      options.setActive(!!active);
      applied.push("active");
    }

    if (applied.length === 0) {
      return { success: false, error: "No environment settings were provided" };
    }

    return {
      success: true,
      environmentKey: key,
      applied: applied,
      current: inspectEnvironment([key]),
    };
  } catch (error) {
    return fail("Error configuring environment", error);
  }
};

configureIosDevice = function (deviceName, commands) {
  try {
    var device = getDeviceByName(deviceName);

    if (!device) {
      return {
        success: false,
        error: `Device ${deviceName} not found`,
      };
    }

    device.skipBoot();
    var commandsArray = commands.split("\n");
    device.enterCommand("!", "global");

    for (var c = 0; c < commandsArray.length; c++) {
      var command = commandsArray[c];
      if (command.trim()) {
        device.enterCommand(command, "");
      }
    }

    device.enterCommand("write memory", "enable");

    return {
      success: true,
      message: `Configuration applied to ${deviceName} (${commandsArray.length} commands)`,
    };
  } catch (error) {
    return fail("Error configuring IOS device", error);
  }
};

getNetwork = function () {
  try {
    var deviceCount = ipc.network().getDeviceCount();
    var devices = [];
    var connections = [];
    var portRecords = [];
    var portOwners = {};
    var seenConnections = {};
    var network = ipc.network();
    var linkCount = isFn(network, "getLinkCount") ? network.getLinkCount() : 0;
    var discoveryStats = {
      networkLinks: 0,
      portLinkPairs: 0,
      cableOtherPortPairs: 0,
      antennaPairs: 0,
    };

    function safeCall(obj, methodName, args) {
      if (!obj) return null;
      try {
        if (typeof obj[methodName] === "function") {
          return obj[methodName].apply(obj, args || []);
        }
      } catch (e) {}
      return null;
    }

    function safePortCall(port, methodName) {
      return safeCall(port, methodName, []);
    }

    function getLinkType(link) {
      return safeCall(link, "getConnectionType", []);
    }

    function endpointKey(deviceName, portName) {
      return String(deviceName) + "::" + String(portName);
    }

    function addConnection(device1Name, port1Name, device2Name, port2Name, link, discovery) {
      if (!device1Name || !device2Name || !port1Name || !port2Name) return false;
      if (device1Name === device2Name && port1Name === port2Name) return false;

      var ep1 = endpointKey(device1Name, port1Name);
      var ep2 = endpointKey(device2Name, port2Name);
      var key = ep1 < ep2 ? ep1 + "--" + ep2 : ep2 + "--" + ep1;
      if (seenConnections[key]) return false;
      seenConnections[key] = true;

      connections.push({
        from: device1Name,
        fromInterface: port1Name,
        to: device2Name,
        toInterface: port2Name,
        type: getLinkType(link),
        discovery: discovery,
      });
      return true;
    }

    function getPortNameSafe(port) {
      if (!port) return "";
      var name = safeCall(port, "getName", []);
      return name === null ? "" : safeToString(name);
    }

    function getPortOwnerName(port) {
      var owner = safeCall(port, "getOwnerDevice", []);
      if (!owner) return "";
      var name = safeCall(owner, "getName", []);
      return name === null ? "" : safeToString(name);
    }

    function rememberPortOwner(portName, port, deviceName) {
      if (!portOwners[portName]) portOwners[portName] = [];
      portOwners[portName].push({ deviceName: deviceName, port: port });
    }

    function findPortOwner(port, remotePortName) {
      if (!port) return null;
      var portName = port.getName();
      var candidates = portOwners[portName] || [];

      if (candidates.length === 1) {
        return candidates[0].deviceName;
      }

      for (var idx = 0; idx < candidates.length; idx++) {
        var candidatePort = candidates[idx].port;
        if (!candidatePort) continue;
        if (candidatePort === port) return candidates[idx].deviceName;
        if (remotePortName && isFn(candidatePort, "getRemotePortName")) {
          try {
            if (String(candidatePort.getRemotePortName()) === String(remotePortName)) {
              return candidates[idx].deviceName;
            }
          } catch (e) {}
        }
      }

      var portLink = getPortLink(port);
      if (portLink) {
        for (var jdx = 0; jdx < candidates.length; jdx++) {
          if (getPortLink(candidates[jdx].port) === portLink) {
            return candidates[jdx].deviceName;
          }
        }
      }

      return null;
    }

    function findOwnerName(port, remotePortName) {
      return getPortOwnerName(port) || findPortOwner(port, remotePortName);
    }

    function addCableConnectionFromLink(link, discovery) {
      var p1 = safeCall(link, "getPort1", []);
      var p2 = safeCall(link, "getPort2", []);
      if (!p1 || !p2) return false;

      var port1Name = getPortNameSafe(p1);
      var port2Name = getPortNameSafe(p2);
      var device1Name = findOwnerName(p1, port2Name);
      var device2Name = findOwnerName(p2, port1Name);
      return addConnection(device1Name, port1Name, device2Name, port2Name, link, discovery);
    }

    function addAntennaConnections(antenna, discovery) {
      var sourcePort = safeCall(antenna, "getPort", []);
      if (!sourcePort) return 0;
      var sourcePortName = getPortNameSafe(sourcePort);
      var sourceDeviceName = findOwnerName(sourcePort, "");
      if (!sourceDeviceName || !sourcePortName) return 0;

      var count = safeCall(antenna, "getReceiverCount", []);
      var added = 0;
      count = count === null ? 0 : Number(count);
      for (var idx = 0; idx < count; idx++) {
        var receiver = safeCall(antenna, "getReceiverAt", [idx]);
        var receiverPort = safeCall(receiver, "getPort", []);
        if (!receiverPort) continue;
        var receiverPortName = getPortNameSafe(receiverPort);
        var receiverDeviceName = findOwnerName(receiverPort, sourcePortName);
        if (addConnection(
          sourceDeviceName,
          sourcePortName,
          receiverDeviceName,
          receiverPortName,
          antenna,
          discovery
        )) {
          added++;
        }
      }
      return added;
    }

    for (var i = 0; i < deviceCount; i++) {
      var device = ipc.network().getDeviceAt(i);
      var deviceName = device.getName();

      var interfaces = [];
      var portCount = device.getPortCount();
      for (var j = 0; j < portCount; j++) {
        var port = device.getPortAt(j);
        if (port) {
          var pname = port.getName();
          var link = getPortLink(port);
          var remotePortName = safeToString(safePortCall(port, "getRemotePortName"));
          rememberPortOwner(pname, port, deviceName);
          portRecords.push({
            deviceName: deviceName,
            portName: pname,
            remotePortName: remotePortName,
            port: port,
            link: link,
          });
          interfaces.push({
            name: pname,
            in_use: link !== null,
            remotePortName: remotePortName,
            linkType: getLinkType(link),
            lightStatus: safePortCall(port, "getLightStatus"),
            isPortUp: safePortCall(port, "isPortUp"),
            isProtocolUp: safePortCall(port, "isProtocolUp"),
            isPowerOn: safePortCall(port, "isPowerOn"),
            isWireless: safePortCall(port, "isWirelessPort"),
            portType: safePortCall(port, "getType"),
          });
        }
      }

      devices.push({
        name: deviceName,
        model: device.getModel(),
        type: device.getType(),
        interfaces: interfaces,
      });
    }

    for (var k = 0; k < linkCount; k++) {
      var lnk = network.getLinkAt(k);
      if (!lnk) continue;

      if (addCableConnectionFromLink(lnk, "network.getLinkAt")) {
        discoveryStats.networkLinks++;
      }
      discoveryStats.antennaPairs += addAntennaConnections(lnk, "network.getLinkAt.antenna");
    }

    // Some Packet Tracer builds expose Port::getLink() but report zero links
    // through Network::getLinkCount(). Use the documented Cable::getOtherPort()
    // and Antenna receiver APIs as fallbacks so snapshots still include links.
    for (var a = 0; a < portRecords.length; a++) {
      var left = portRecords[a];
      if (!left.link) continue;
      var otherPort = safeCall(left.link, "getOtherPort", [left.deviceName, left.portName]);
      if (otherPort) {
        var otherPortName = getPortNameSafe(otherPort);
        var otherDeviceName = findOwnerName(otherPort, left.portName);
        if (addConnection(
          left.deviceName,
          left.portName,
          otherDeviceName,
          otherPortName,
          left.link,
          "port.getLink.getOtherPort"
        )) {
          discoveryStats.cableOtherPortPairs++;
        }
      }

      discoveryStats.antennaPairs += addAntennaConnections(left.link, "port.getLink.antenna");

      for (var b = a + 1; b < portRecords.length; b++) {
        var right = portRecords[b];
        if (left.link !== right.link) continue;
        if (addConnection(
          left.deviceName,
          left.portName,
          right.deviceName,
          right.portName,
          left.link,
          "port.getLink"
        )) {
          discoveryStats.portLinkPairs++;
        }
      }
    }

    return {
      success: true,
      result: {
        deviceCount: devices.length,
        connectionCount: connections.length,
        devices: devices,
        connections: connections,
        metadata: {
          linkCountReported: linkCount,
          discoveryStats: discoveryStats,
        },
      },
    };
  } catch (error) {
    return fail("", error);
  }
};

auditNetwork = function (
  expectedDeviceNames,
  allowedDisconnectedDeviceNames,
  wirelessClientDeviceNames,
  requireConnectedDevices,
  requireGreenLinks
) {
  try {
    var net = getNetwork();
    if (!net || !net.success) {
      return net || { success: false, error: "getNetwork failed" };
    }

    var devices = net.result.devices || [];
    var connections = net.result.connections || [];
    var expected = Array.isArray(expectedDeviceNames) ? expectedDeviceNames : [];
    var allowedDisconnected = Array.isArray(allowedDisconnectedDeviceNames) ? allowedDisconnectedDeviceNames : [];
    var wirelessClients = Array.isArray(wirelessClientDeviceNames) ? wirelessClientDeviceNames : [];
    var checkConnected = requireConnectedDevices !== false;
    var checkGreen = requireGreenLinks === true;
    var issues = [];
    var warnings = [];
    var byName = {};
    var endpointCounts = {};

    function auditEndpointKey(deviceName, portName) {
      return String(deviceName) + "::" + String(portName);
    }

    function isAllowedDisconnected(deviceName) {
      for (var i = 0; i < allowedDisconnected.length; i++) {
        if (allowedDisconnected[i] === deviceName) return true;
      }
      return false;
    }

    function rememberEndpoint(deviceName, portName) {
      if (!endpointCounts[deviceName]) endpointCounts[deviceName] = 0;
      endpointCounts[deviceName]++;
      endpointCounts[auditEndpointKey(deviceName, portName)] = 1;
    }

    for (var c = 0; c < connections.length; c++) {
      rememberEndpoint(connections[c].from, connections[c].fromInterface);
      rememberEndpoint(connections[c].to, connections[c].toInterface);
    }

    for (var d = 0; d < devices.length; d++) {
      var device = devices[d];
      byName[device.name] = device;

      if (checkConnected && !isAllowedDisconnected(device.name)) {
        var interfaces = device.interfaces || [];
        var hasNetworkPort = interfaces.length > 0;
        if (hasNetworkPort && !endpointCounts[device.name]) {
          issues.push({
            type: "device-disconnected",
            device: device.name,
            message: device.name + " has interfaces but no discovered links",
          });
        }
      }

      var ifaces = device.interfaces || [];
      for (var p = 0; p < ifaces.length; p++) {
        var iface = ifaces[p];
        if (!iface || !iface.in_use) continue;

        if (!endpointCounts[auditEndpointKey(device.name, iface.name)]) {
          warnings.push({
            type: "used-port-without-connection",
            device: device.name,
            interface: iface.name,
            remotePortName: iface.remotePortName || "",
          });
        }

        if (checkGreen && iface.lightStatus !== null && iface.lightStatus !== 2 && iface.lightStatus !== 3) {
          issues.push({
            type: "link-light-not-green",
            device: device.name,
            interface: iface.name,
            lightStatus: iface.lightStatus,
            message: device.name + " " + iface.name + " light status is " + iface.lightStatus,
          });
        }
      }
    }

    for (var e = 0; e < expected.length; e++) {
      if (!byName[expected[e]]) {
        issues.push({
          type: "missing-device",
          device: expected[e],
          message: expected[e] + " is missing from the workspace",
        });
      }
    }

    for (var w = 0; w < wirelessClients.length; w++) {
      var wirelessName = wirelessClients[w];
      var rawDevice = getDeviceByName(wirelessName);
      if (!rawDevice) {
        issues.push({ type: "missing-wireless-client", device: wirelessName });
        continue;
      }
      var wireless = getWirelessDiagnostics(rawDevice);
      if (!wireless || !wireless.currentApMac) {
        issues.push({
          type: "wireless-not-associated",
          device: wirelessName,
          wireless: wireless,
          message: wirelessName + " is not associated with an AP",
        });
      }
    }

    return {
      success: true,
      result: {
        ok: issues.length === 0,
        issueCount: issues.length,
        warningCount: warnings.length,
        issues: issues,
        warnings: warnings,
        summary: {
          deviceCount: net.result.deviceCount,
          connectionCount: net.result.connectionCount,
          metadata: net.result.metadata,
        },
      },
    };
  } catch (error) {
    return fail("Error auditing network", error);
  }
};

getDeviceInfo = function (deviceName) {
  try {
    var net = getNetwork();
    if (!net || !net.success) {
      return net || { success: false, error: "getNetwork failed" };
    }
    var devices = net.result.devices;
    var connections = net.result.connections;
    for (var i = 0; i < devices.length; i++) {
      if (devices[i].name === deviceName) {
        var rawDevice = getDeviceByName(deviceName);
        var related = [];
        for (var j = 0; j < connections.length; j++) {
          var c = connections[j];
          if (c.from === deviceName || c.to === deviceName) related.push(c);
        }
        return {
          success: true,
          result: {
            device: devices[i],
            connections: related,
            wireless: rawDevice ? getWirelessDiagnostics(rawDevice) : null,
            iosProbe: rawDevice ? getIosProbe(rawDevice) : null,
          },
        };
      }
    }
    return {
      success: false,
      error: `Device ${deviceName} not found`,
    };
  } catch (error) {
    return fail("Error getting device info", error);
  }
};

removeDevice = function (deviceNames) {
  try {
    var devicesToRemove = [];
    if (typeof deviceNames === "string") {
      devicesToRemove = [deviceNames];
    } else if (Array.isArray(deviceNames)) {
      devicesToRemove = deviceNames;
    } else {
      return {
        success: false,
        error:
          "Invalid input: provide a device name string or array of device names",
      };
    }

    var workspace = ipc.appWindow().getActiveWorkspace().getLogicalWorkspace();
    var results = [];
    var successCount = 0;
    var failCount = 0;

    for (var i = 0; i < devicesToRemove.length; i++) {
      var deviceName = devicesToRemove[i];
      var device = getDeviceByName(deviceName);

      if (!device) {
        results.push({
          device: deviceName,
          success: false,
          error: "Device not found",
        });
        failCount++;
      } else {
        var result = workspace.removeDevice(deviceName);

        if (result === true) {
          results.push({
            device: deviceName,
            success: true,
            message: "Removed successfully",
          });
          successCount++;
        } else {
          results.push({
            device: deviceName,
            success: false,
            error: "Failed to remove",
          });
          failCount++;
        }
      }
    }

    return {
      success: failCount === 0,
      totalDevices: devicesToRemove.length,
      successCount: successCount,
      failCount: failCount,
      results: results,
    };
  } catch (error) {
    return fail("Error removing devices", error);
  }
};

setSimulationMode = function (toSimMode) {
  try {
    var sim = ipc.simulation();
    var current = sim.isSimulationMode();
    if (current === toSimMode) {
      return {
        success: true,
        message: "Already in " + (toSimMode ? "simulation" : "realtime") + " mode",
        mode: toSimMode ? "simulation" : "realtime",
      };
    }
    sim.setSimulationMode(toSimMode);
    return {
      success: true,
      message: "Switched to " + (toSimMode ? "simulation" : "realtime") + " mode",
      mode: toSimMode ? "simulation" : "realtime",
    };
  } catch (error) {
    return fail("Error setting simulation mode", error);
  }
};

getSimulationStatus = function () {
  try {
    var sim = ipc.simulation();
    var isSimMode = sim.isSimulationMode();
    var result = { mode: isSimMode ? "simulation" : "realtime" };
    if (isSimMode) {
      result.currentTime = sim.getCurrentSimTime();
      result.frameCount = sim.getFrameInstanceCount();
      result.currentFrameIndex = sim.getCurrentFrameInstanceIndex();
    }
    return { success: true, result: result };
  } catch (error) {
    return fail("Error getting simulation status", error);
  }
};

stepSimulation = function (direction, steps) {
  try {
    var sim = ipc.simulation();
    if (!sim.isSimulationMode()) {
      return {
        success: false,
        error: "Not in simulation mode. Call setSimulationMode(true) first.",
      };
    }
    if (direction === "reset") {
      sim.resetSimulation();
      return { success: true, message: "Simulation reset" };
    }
    var n = steps && steps >= 1 ? Math.min(steps, 100) : 1;
    for (var i = 0; i < n; i++) {
      if (direction === "forward") {
        sim.forward();
      } else if (direction === "backward") {
        sim.backward();
      } else {
        return { success: false, error: "Unknown direction: " + direction };
      }
    }
    return {
      success: true,
      message: direction + " " + n + " step(s)",
      currentTime: sim.getCurrentSimTime(),
      frameCount: sim.getFrameInstanceCount(),
    };
  } catch (error) {
    return fail("Error stepping simulation", error);
  }
};

var PDU_TRAFFIC_TYPES = {
  ICMP: 0,
  TCP: 1,
  UDP: 2,
  HTTP: 17,
  HTTPS: 18,
  DNS: 19,
};

sendPdu = function (sourceDevice, destinationDevice) {
  try {
    var sim = ipc.simulation();
    var modeEnabled = false;
    if (!sim.isSimulationMode()) {
      sim.setSimulationMode(true);
      modeEnabled = true;
    }
    if (!getDeviceByName(sourceDevice)) {
      return { success: false, error: "Source device not found: " + sourceDevice };
    }
    if (!getDeviceByName(destinationDevice)) {
      return { success: false, error: "Destination device not found: " + destinationDevice };
    }
    var errCode = ipc.appWindow().getUserCreatedPDU().addSimplePdu(sourceDevice, destinationDevice);
    // ADD_PDU_ERROR: 0 / falsy = success
    var errStr = String(errCode);
    if (errCode && errStr !== "0") {
      return { success: false, error: "PT rejected PDU (ADD_PDU_ERROR=" + errStr + ")" };
    }
    return {
      success: true,
      message: "ICMP PDU added from " + sourceDevice + " to " + destinationDevice,
      simulationModeEnabled: modeEnabled,
    };
  } catch (error) {
    return fail("Error sending PDU", error);
  }
};

renameDevice = function (deviceName, newName) {
  try {
    var device = getDeviceByName(deviceName);
    if (!device) {
      return { success: false, error: "Device not found: " + deviceName };
    }
    device.setName(newName);
    return { success: true, message: "Renamed " + deviceName + " to " + newName };
  } catch (error) {
    return fail("Error renaming device", error);
  }
};

moveDevice = function (deviceName, x, y) {
  try {
    var device = getDeviceByName(deviceName);
    if (!device) {
      return { success: false, error: "Device not found: " + deviceName };
    }
    device.moveToLocation(x, y);
    return {
      success: true,
      message: "Moved " + deviceName + " to (" + x + ", " + y + ")",
    };
  } catch (error) {
    return fail("Error moving device", error);
  }
};

// Maps both numeric and C++ enum-string forms of eTrafficType to readable names.
// PT's JS host may expose the enum as "0" or as "eTrafficType_Icmp" - handle both.
var TRAFFIC_TYPE_NAMES = {
  "0": "ICMP",  "eTrafficType_Icmp": "ICMP",
  "1": "TCP",   "eTrafficType_Tcp": "TCP",
  "2": "UDP",   "eTrafficType_Udp": "UDP",
  "3": "RIPv1", "eTrafficType_RipV1": "RIPv1",
  "4": "RIPv2", "eTrafficType_RipV2": "RIPv2",
  "5": "ARP",   "eTrafficType_Arp": "ARP",
  "6": "CDP",   "eTrafficType_Cdp": "CDP",
  "7": "DHCP",  "eTrafficType_Dhcp": "DHCP",
  "11": "STP",  "eTrafficType_Stp": "STP",
  "12": "OSPF", "eTrafficType_Ospf": "OSPF",
  "13": "DTP",  "eTrafficType_Dtp": "DTP",
  "17": "HTTP", "eTrafficType_Http": "HTTP",
  "18": "HTTPS","eTrafficType_Https": "HTTPS",
  "19": "DNS",  "eTrafficType_Dns": "DNS",
  "36": "BGP",  "eTrafficType_Bgp": "BGP",
  "1000": "Custom", "eTrafficType_Custom": "Custom",
};

getPduResults = function (types) {
  try {
    var sim = ipc.simulation();
    if (!sim.isSimulationMode()) {
      return { success: false, error: "Not in simulation mode. Call setSimulationMode(true) first." };
    }

    var typeFilter = null;
    if (Array.isArray(types) && types.length > 0) {
      typeFilter = {};
      for (var t = 0; t < types.length; t++) typeFilter[types[t].toUpperCase()] = true;
    }

    var total = sim.getFrameInstanceCount();
    var frames = [];
    for (var i = 0; i < total; i++) {
      var fi = sim.getFrameInstanceAt(i);
      if (!fi) continue;

      var rawType = String(fi.getUserTrafficType());
      var typeName = TRAFFIC_TYPE_NAMES[rawType] || rawType;

      if (typeFilter && !typeFilter[typeName.toUpperCase()]) continue;

      var status = "unknown";
      if (fi.isFrameAccepted())          status = "accepted";
      else if (fi.isFrameDropped())      status = "dropped";
      else if (fi.isFrameNotForwarded()) status = "not_forwarded";
      else if (fi.isFrameUnexpected())   status = "unexpected";
      else if (fi.isFrameCollidedOnLink() || fi.isFrameCollidedAtDevice()) status = "collision";
      else if (fi.isFrameBuffered())     status = "buffered";
      else if (fi.isFrameOnTransit())    status = "in_transit";
      else if (fi.isFrameSent())         status = "sent";

      frames.push({
        index: i,
        source: fi.getSourceString(),
        destination: fi.getDestinationString(),
        trafficType: typeName,
        status: status,
      });
    }
    return {
      success: true,
      result: { totalFrames: total, shown: frames.length, frames: frames },
    };
  } catch (error) {
    return fail("Error getting PDU results", error);
  }
};

getCommandLog = function (deviceName, limit) {
  try {
    var log = ipc.commandLog();
    var total = log.getEntryCount();
    var cap = limit && limit > 0 ? Math.min(limit, 500) : 50;
    var entries = [];

    for (var i = total - 1; i >= 0 && entries.length < cap; i--) {
      var entry = log.getEntryAt(i);
      if (!entry) continue;
      var dev = entry.getDeviceName();
      if (deviceName && dev !== deviceName) continue;
      entries.push({
        timestamp: entry.getTimeToString(),
        device: dev,
        prompt: entry.getPrompt(),
        command: entry.getCommand(),
        resolvedCommand: entry.getResolvedCommand(),
      });
    }

    return {
      success: true,
      result: { totalEntries: total, returned: entries.length, entries: entries },
    };
  } catch (error) {
    return fail("Error getting command log", error);
  }
};

setPower = function (deviceName, power) {
  try {
    var device = getDeviceByName(deviceName);
    if (!device) {
      return { success: false, error: "Device not found: " + deviceName };
    }
    device.setPower(power);
    return {
      success: true,
      message: deviceName + " powered " + (power ? "on" : "off"),
    };
  } catch (error) {
    return fail("Error setting device power", error);
  }
};

removeLink = function (links) {
  try {
    var linksToRemove = [];

    if (typeof links === "object" && links !== null && !Array.isArray(links)) {
      linksToRemove = [links];
    } else if (Array.isArray(links)) {
      linksToRemove = links;
    } else {
      return {
        success: false,
        error:
          "Invalid input: provide link object {device, port} or array of link objects",
      };
    }

    var workspace = ipc.appWindow().getActiveWorkspace().getLogicalWorkspace();
    var results = [];
    var successCount = 0;
    var failCount = 0;

    for (var i = 0; i < linksToRemove.length; i++) {
      var link = linksToRemove[i];
      var deviceName = link.device || link.deviceName;
      var portName = link.port || link.portName;

      if (!deviceName || !portName) {
        results.push({
          device: deviceName,
          port: portName,
          success: false,
          error: "Missing device or port",
        });
        failCount++;
        continue;
      }

      var device = getDeviceByName(deviceName);
      if (!device) {
        results.push({
          device: deviceName,
          port: portName,
          success: false,
          error: "Device not found",
        });
        failCount++;
        continue;
      }

      var result = workspace.deleteLink(deviceName, portName);

      if (result === true) {
        results.push({
          device: deviceName,
          port: portName,
          success: true,
          message: "Link removed successfully",
        });
        successCount++;
      } else {
        results.push({
          device: deviceName,
          port: portName,
          success: false,
          error: "Failed to remove link",
        });
        failCount++;
      }
    }

    return {
      success: failCount === 0,
      totalLinks: linksToRemove.length,
      successCount: successCount,
      failCount: failCount,
      results: results,
    };
  } catch (error) {
    return fail("Error removing links", error);
  }
};
