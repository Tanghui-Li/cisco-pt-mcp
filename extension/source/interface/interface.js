/* global io, $se */
// Webview-side bridge: forwards Socket.IO tool_call events to PT's scripting
// host via $se('runCode', ...) and emits the result back as tool_result.
// Wire protocol must match mcp_server/bridge.py.

(function () {
  var MCP_URL = "http://127.0.0.1:7531";

  var $statusDot   = document.getElementById("status-dot");
  var $statusText  = document.getElementById("status-text");
  var $sid         = document.getElementById("sid");
  var $toolCount   = document.getElementById("tool-count");
  var $log         = document.getElementById("log");

  var toolsHandled = 0;

  function setStatus(state, label) {
    if ($statusDot)  $statusDot.className = "dot " + state;
    if ($statusText) $statusText.textContent = label || state;
  }

  function logLine(text, cls) {
    if (!$log) return;
    var line = document.createElement("div");
    line.className = "line" + (cls ? " " + cls : "");
    var ts = new Date().toTimeString().slice(0, 8);
    line.innerHTML = '<span class="ts">' + ts + "</span>  " + escapeHtml(text);
    $log.appendChild(line);
    // Cap log at ~200 lines.
    while ($log.childNodes.length > 200) $log.removeChild($log.firstChild);
    $log.scrollTop = $log.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Builds "return <fn>(<args>);" and ships it through PT's scripting host
  // via $se('runCode', ...). runCode() (in source/runcode.js) wraps the
  // return value as { success, result, code }.
  function executePTCode(funcName, args) {
    return new Promise(function (resolve, reject) {
      try {
        var argsStr = (args || []).map(function (a) {
          if (typeof a === "string") {
            return '"' + a.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
                          .replace(/\n/g, "\\n").replace(/\r/g, "\\r")
                          .replace(/\t/g, "\\t") + '"';
          }
          if (a === null || a === undefined) return "undefined";
          if (typeof a === "boolean") return String(a);
          if (Array.isArray(a) || typeof a === "object") return JSON.stringify(a);
          return String(a);
        }).join(", ");

        var wrapped = $se("runCode", "return " + funcName + "(" + argsStr + ");");

        var payload;
        if (typeof wrapped === "string") {
          try { payload = JSON.parse(wrapped); } catch (_) { payload = wrapped; }
        } else {
          payload = wrapped;
        }

        // runCode wraps the userfunctions return as {success, result, code}.
        // Unwrap so the server sees the userfunctions return shape directly.
        if (payload && typeof payload === "object"
            && "result" in payload && "success" in payload && "code" in payload) {
          payload = payload.result;
        }

        resolve(payload);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Maps tool_name -> ordered argument list for the JS function in
  // userfunctions.js. Keep aligned with mcp_server/tools.py.
  var TOOL_ARGS = {
    addDevice:           ["deviceName", "deviceModel", "x", "y"],
    addModule:           ["deviceName", "slot", "model"],
    addLink:             ["device1Name", "device1Interface",
                          "device2Name", "device2Interface", "linkType"],
    removeDevice:        ["deviceNames"],
    removeLink:          ["links"],
    configurePcIp:       ["deviceName", "dhcpEnabled", "ipaddress",
                          "subnetMask", "defaultGateway", "dnsServer"],
    configureIosDevice:  ["deviceName", "commands"],
    getNetwork:          [],
    getDeviceInfo:       ["deviceName"],
  };

  function buildPositionalArgs(tool, input) {
    var spec = TOOL_ARGS[tool];
    if (!spec) return [];
    var out = [];
    for (var i = 0; i < spec.length; i++) out.push(input[spec[i]]);
    return out;
  }

  setStatus("connecting", "connecting");
  logLine("connecting to " + MCP_URL);

  var socket = io(MCP_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", function () {
    setStatus("connected", "connected");
    if ($sid) $sid.textContent = socket.id;
    logLine("connected sid=" + socket.id, "ok");
  });

  socket.on("connect_error", function (err) {
    setStatus("offline", "offline");
    logLine("connect_error: " + ((err && err.message) || err), "err");
  });

  socket.on("disconnect", function (reason) {
    setStatus("connecting", "reconnecting");
    if ($sid) $sid.textContent = "—";
    logLine("disconnect: " + reason, "err");
  });

  socket.on("tool_call", function (data) {
    data = data || {};
    var tool = data.tool_name;
    var args = data.tool_input || {};
    var tcid = data.tool_call_id;

    if (!tool || !tcid) {
      logLine("malformed tool_call", "err");
      return;
    }

    logLine("→ " + tool + " " + JSON.stringify(args).slice(0, 80));

    var positional = buildPositionalArgs(tool, args);

    executePTCode(tool, positional)
      .then(function (result) {
        toolsHandled++;
        if ($toolCount) $toolCount.textContent = String(toolsHandled);

        var ok = result && result.success !== false;
        logLine("← " + tool + (ok ? " ok" : " err: " + (result && result.error)), ok ? "ok" : "err");

        if (!socket.connected) return;
        socket.emit("tool_result", {
          tool_call_id: tcid,
          tool_name:    tool,
          tool_input:   args,
          result:       result,
        });
      })
      .catch(function (err) {
        toolsHandled++;
        if ($toolCount) $toolCount.textContent = String(toolsHandled);

        var msg = (err && err.message) || String(err);
        logLine("← " + tool + " threw: " + msg, "err");

        if (!socket.connected) return;
        socket.emit("tool_result", {
          tool_call_id: tcid,
          tool_name:    tool,
          tool_input:   args,
          result: {
            success: false,
            error:   msg,
            tool:    tool,
            args:    args,
          },
        });
      });
  });
})();
