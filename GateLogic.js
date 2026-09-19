.pragma library

// Aegis Gate helpers. LIVE requires a valid GO/HOLD/NO in the summon
// payload. Missing or invalid decision never invents a verdict. DEMO
// samples are labeled DEMO and never inflate the PENDING chip.

var DECISIONS = ["GO", "HOLD", "NO"]
var PLUGIN_ID = "smf.aegis-gate"
var SHARE_DIR = "smf-aegis-gate"
var RECEIPTS_FILE = "receipts.jsonl"
var PENDING_FILE = "pending.json"
var MAX_RISKS = 8

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value))
}

function number(value) {
  var n = Number(value)
  return isFinite(n) ? n : 0
}

function trimStr(value) {
  return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
}

function normalizeDecision(value) {
  var s = trimStr(value).toUpperCase()
  if (s === "GO" || s === "G") return "GO"
  if (s === "HOLD" || s === "H") return "HOLD"
  if (s === "NO" || s === "N") return "NO"
  return ""
}

function normalizeSource(value) {
  var s = trimStr(value).toLowerCase()
  if (s === "hermes" || s === "manual" || s === "demo" || s === "summon") return s
  if (!s) return ""
  return s.replace(/[^a-z0-9._-]/g, "").slice(0, 32)
}

function cloneRisks(risks) {
  var list = risks
  var out = []
  if (list === undefined || list === null) return out
  if (typeof list === "string") list = [list]
  for (var i = 0; i < list.length && out.length < MAX_RISKS; i++) {
    var risk = trimStr(list[i])
    if (risk) out.push(risk)
  }
  return out
}

function emptyState() {
  return {
    pending: null,
    demoIndex: 0,
    showing: null
  }
}

function emptyGate() {
  return {
    decision: "",
    title: "",
    reason: "",
    risks: [],
    source: "demo",
    mode: "demo",
    live: false
  }
}

function hasGateContent(gate) {
  if (!gate) return false
  if (trimStr(gate.title)) return true
  if (trimStr(gate.reason)) return true
  return cloneRisks(gate.risks).length > 0
}

function parseJsonObject(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: {} }
  var text = trimStr(raw)
  if (text === "") return { ok: true, value: {} }
  try {
    var value = JSON.parse(text)
    if (!value || typeof value !== "object" || value instanceof Array)
      return { ok: false, value: {} }
    return { ok: true, value: value }
  } catch (e) {
    return { ok: false, value: {} }
  }
}

function parsePayload(raw) {
  var parsed = parseJsonObject(raw)
  var payload = parsed.value
  var decision = normalizeDecision(payload.decision || payload.verdict || payload.choice)
  var source = normalizeSource(payload.source)
  var forceDemo = payload.demo === true || payload.forceDemo === true || source === "demo"
  var title = trimStr(payload.title || payload.summary || payload.action)
  var reason = trimStr(payload.reason)
  if (!reason && payload.reasons && payload.reasons.length)
    reason = trimStr(payload.reasons[0])
  var risks = cloneRisks(payload.risks)
  if (risks.length === 0 && payload.reasons)
    risks = cloneRisks(payload.reasons)
  var live = parsed.ok && !forceDemo && decision !== ""
  return {
    decision: decision,
    title: title,
    reason: reason,
    risks: risks,
    source: source,
    mode: live ? "live" : "demo",
    live: live,
    forceDemo: forceDemo,
    empty: !title && !reason && !decision && risks.length === 0,
    ok: parsed.ok
  }
}

function demoSamples() {
  return [
    {
      decision: "HOLD",
      title: "Deploy to staging?",
      reason: "Sample HOLD for the DEMO airlock. Not a live agent, tool, or deploy gate.",
      risks: ["unreviewed diff", "weekend window", "no rollback drill"],
      source: "demo"
    },
    {
      decision: "NO",
      title: "Wipe the build cache?",
      reason: "Sample NO. Destructive-looking demo only — Aegis Gate is not blocking any process.",
      risks: ["irreversible", "shared runner"],
      source: "demo"
    },
    {
      decision: "GO",
      title: "Lint the README?",
      reason: "Sample GO. Local read-shaped demo. No agent is waiting on this HUD.",
      risks: ["docs only"],
      source: "demo"
    }
  ]
}

function decorateGate(base, mode) {
  var live = mode === "live"
  var g = base || {}
  var decision = normalizeDecision(g.decision)
  var title = trimStr(g.title)
  var reason = trimStr(g.reason)
  if (!title)
    title = live ? "Untitled gate" : "DEMO airlock"
  if (!reason && !live)
    reason = "No summon payload. Showing a labeled DEMO sample — not a live agent."
  return {
    decision: decision,
    title: title,
    reason: reason,
    risks: cloneRisks(g.risks),
    source: live ? (normalizeSource(g.source) || "summon") : "demo",
    mode: live ? "live" : "demo",
    live: live
  }
}

function cloneGate(gate) {
  if (!gate) return null
  return decorateGate(gate, gate.live ? "live" : "demo")
}

function resolveOpen(payloadJson, state) {
  state = state || emptyState()
  var parsed = parsePayload(payloadJson)
  var next = {
    pending: cloneGate(state.pending),
    demoIndex: Math.round(number(state.demoIndex)) || 0,
    showing: null
  }
  if (parsed.live) {
    next.pending = decorateGate(parsed, "live")
    next.showing = cloneGate(next.pending)
    return next
  }
  if (hasGateContent(parsed) && !parsed.decision) {
    next.showing = decorateGate(parsed, "demo")
    return next
  }
  if (parsed.forceDemo || !next.pending) {
    var samples = demoSamples()
    var idx = ((next.demoIndex % samples.length) + samples.length) % samples.length
    next.showing = decorateGate(samples[idx], "demo")
    next.demoIndex = idx + 1
    return next
  }
  next.showing = cloneGate(next.pending)
  return next
}

function pendingCount(state) {
  if (!state || !state.pending) return 0
  if (state.pending.live === true && state.pending.mode === "live")
    return 1
  return 0
}

function isoNow(now) {
  if (typeof now === "string" && now) return now
  var ts = now instanceof Date ? now : new Date()
  try {
    return ts.toISOString()
  } catch (e) {
    return String(now || "")
  }
}

function confirm(state, choice, now) {
  var action = normalizeDecision(choice)
  if (!action) {
    return {
      state: state || emptyState(),
      receipt: null,
      error: "no action selected"
    }
  }
  var gate = (state && state.showing) ? cloneGate(state.showing) : emptyGate()
  var receipt = {
    ts: isoNow(now),
    choice: action,
    recommended: normalizeDecision(gate.decision),
    title: gate.title,
    reason: gate.reason,
    risks: cloneRisks(gate.risks),
    mode: gate.mode || "demo",
    source: gate.source || "",
    live: gate.live === true
  }
  var next = {
    pending: cloneGate(state && state.pending),
    demoIndex: state ? Math.round(number(state.demoIndex)) || 0 : 0,
    showing: gate
  }
  if (gate.live) next.pending = null
  return { state: next, receipt: receipt, error: "" }
}

function focusFromKey(text, keyName) {
  var t = trimStr(text).toUpperCase()
  var k = trimStr(keyName).toUpperCase()
  if (t === "1" || t === "G" || k === "1" || k === "G" || k === "KEY_1" || k === "KEY_G")
    return "GO"
  if (t === "2" || t === "H" || k === "2" || k === "H" || k === "KEY_2" || k === "KEY_H")
    return "HOLD"
  if (t === "3" || t === "N" || k === "3" || k === "N" || k === "KEY_3" || k === "KEY_N")
    return "NO"
  return ""
}

function decisionIndex(decision) {
  var d = normalizeDecision(decision)
  if (d === "GO") return 0
  if (d === "HOLD") return 1
  if (d === "NO") return 2
  return -1
}

function decisionColor(decision) {
  var d = normalizeDecision(decision)
  if (d === "GO") return "#3DDC97"
  if (d === "HOLD") return "#F5A524"
  if (d === "NO") return "#FF4D6D"
  return "#8B93A7"
}

function modeLabel(mode) {
  return mode === "live" ? "LIVE" : "DEMO"
}

function sourceLabel(source, live) {
  if (!live) return "DEMO sample"
  var s = normalizeSource(source)
  if (s === "hermes") return "summoned as hermes"
  if (s === "manual") return "manual summon"
  if (s === "summon") return "shell summon"
  if (s) return "source " + s
  return "shell summon"
}

function honestyLine(gate) {
  if (!gate || !gate.live)
    return "DEMO gate · not a live agent · HUD does not block tools"
  return "LIVE payload · " + sourceLabel(gate.source, true) + " · manual HUD, not an agent bridge"
}

function recommendedLine(gate) {
  if (!gate) return "no verdict in payload"
  var decision = normalizeDecision(gate.decision)
  if (!decision) return "no verdict in payload"
  if (!gate.live) return "DEMO sample " + decision
  return "payload " + decision
}

function defaultFocus(gate) {
  var decision = normalizeDecision(gate && gate.decision)
  return decision || "HOLD"
}

function shareDir(home) {
  var h = trimStr(home)
  if (!h) return ""
  return h.replace(/\/+$/, "") + "/.local/share/" + SHARE_DIR
}

function receiptsPath(home) {
  var dir = shareDir(home)
  return dir ? dir + "/" + RECEIPTS_FILE : ""
}

function pendingPath(home) {
  var dir = shareDir(home)
  return dir ? dir + "/" + PENDING_FILE : ""
}

function pendingPayload(state, now) {
  var count = pendingCount(state)
  if (count <= 0) return { pending: 0 }
  var gate = state.pending
  return {
    pending: count,
    title: gate.title,
    decision: gate.decision,
    updatedAt: isoNow(now)
  }
}

function receiptLine(receipt) {
  return JSON.stringify(receipt)
}

function writeSpec(kind, home, body) {
  var dir = shareDir(home)
  var file = kind === "pending" ? pendingPath(home) : receiptsPath(home)
  var op = kind === "receipts" ? ">>" : ">"
  return {
    dir: dir,
    file: file,
    body: String(body || ""),
    argv: [
      "bash",
      "-c",
      "umask 077; mkdir -p \"$1\" && printf '%s\\n' \"$2\" " + op + " \"$3\"",
      "smf-aegis-gate",
      dir,
      String(body || ""),
      file
    ]
  }
}

function pillarModel(selected) {
  var sel = normalizeDecision(selected)
  return [
    { id: "GO", key: "1 / G", label: "GO", hint: "proceed", selected: sel === "GO" },
    { id: "HOLD", key: "2 / H", label: "HOLD", hint: "review", selected: sel === "HOLD" },
    { id: "NO", key: "3 / N", label: "NO", hint: "refuse", selected: sel === "NO" }
  ]
}

function parsePendingFile(raw) {
  try {
    var obj = JSON.parse(raw || "{}") || {}
    var n = Math.round(number(obj.pending))
    return clamp(n, 0, 99)
  } catch (e) {
    return 0
  }
}

function hexPoints(cx, cy, radius, rotation) {
  var out = []
  var rot = number(rotation)
  for (var i = 0; i < 6; i++) {
    var a = rot + Math.PI / 6 + i * Math.PI / 3
    out.push({
      x: cx + radius * Math.cos(a),
      y: cy + radius * Math.sin(a)
    })
  }
  return out
}

function neverClaimsAgentBridge(text) {
  var s = String(text || "").toLowerCase()
  if (s.indexOf("blocking hermes") !== -1) return false
  if (s.indexOf("blocked the agent") !== -1) return false
  if (s.indexOf("tool call intercepted") !== -1) return false
  return true
}
