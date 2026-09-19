#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "GateLogic.js"), "utf8")
  .replace(/^\.pragma library\s*/, "");
const Gate = { Math, Date, Number, String, Array, Object, JSON, isFinite, console };
vm.createContext(Gate);
vm.runInContext(src, Gate);

const now = "2026-09-19T21:00:00.000Z";

assert.strictEqual(Gate.normalizeDecision("go"), "GO");
assert.strictEqual(Gate.normalizeDecision("Hold"), "HOLD");
assert.strictEqual(Gate.normalizeDecision("n"), "NO");
assert.strictEqual(Gate.normalizeDecision("maybe"), "", "never invent a decision");
assert.strictEqual(Gate.normalizeDecision(""), "");

const empty = Gate.parsePayload("{}");
assert.strictEqual(empty.live, false);
assert.strictEqual(empty.mode, "demo");
assert.strictEqual(empty.decision, "");
assert.strictEqual(empty.empty, true);

const missing = Gate.parsePayload("");
assert.strictEqual(missing.live, false);
assert.strictEqual(missing.decision, "");

const garbage = Gate.parsePayload("not-json");
assert.strictEqual(garbage.ok, false);
assert.strictEqual(garbage.live, false);
assert.strictEqual(garbage.decision, "");

const invalidDecision = Gate.parsePayload('{"decision":"MAYBE","title":"x"}');
assert.strictEqual(invalidDecision.live, false);
assert.strictEqual(invalidDecision.decision, "");
assert.strictEqual(invalidDecision.title, "x");

const liveHold = Gate.parsePayload(JSON.stringify({
  decision: "HOLD",
  title: "Deploy to prod?",
  reason: "no rollback",
  risks: ["prod write"],
  source: "manual"
}));
assert.strictEqual(liveHold.live, true);
assert.strictEqual(liveHold.mode, "live");
assert.strictEqual(liveHold.decision, "HOLD");
assert.strictEqual(liveHold.source, "manual");
assert.strictEqual(liveHold.risks.length, 1);
assert.strictEqual(String(liveHold.risks[0]), "prod write");

const hermes = Gate.parsePayload('{"decision":"NO","title":"rm -rf","source":"hermes"}');
assert.strictEqual(hermes.live, true);
assert.strictEqual(hermes.source, "hermes");
assert.ok(Gate.honestyLine(Gate.decorateGate(hermes, "live")).indexOf("not an agent bridge") !== -1);
assert.ok(Gate.neverClaimsAgentBridge(Gate.honestyLine(Gate.decorateGate(hermes, "live"))));

const forced = Gate.parsePayload('{"decision":"GO","demo":true}');
assert.strictEqual(forced.live, false);
assert.strictEqual(forced.forceDemo, true);

const sourceDemo = Gate.parsePayload('{"decision":"HOLD","source":"demo"}');
assert.strictEqual(sourceDemo.live, false);

const samples = Gate.demoSamples();
assert.strictEqual(samples.length, 3);
assert.strictEqual(samples[0].decision, "HOLD");
assert.strictEqual(samples[1].decision, "NO");
assert.strictEqual(samples[2].decision, "GO");
samples.forEach(function(sample) {
  assert.strictEqual(sample.source, "demo");
  const gate = Gate.decorateGate(sample, "demo");
  assert.strictEqual(gate.live, false);
  assert.strictEqual(gate.mode, "demo");
  assert.strictEqual(Gate.modeLabel(gate.mode), "DEMO");
  assert.ok(gate.title.indexOf("DEMO") === 0, "DEMO titles stay labeled when cropped");
  assert.ok(Gate.honestyLine(gate).indexOf("DEMO") !== -1);
  assert.ok(Gate.neverClaimsAgentBridge(Gate.honestyLine(gate)));
});

let state = Gate.emptyState();
assert.strictEqual(Gate.pendingCount(state), 0);

state = Gate.resolveOpen("{}", state);
assert.strictEqual(state.showing.mode, "demo");
assert.strictEqual(state.showing.decision, "", "empty payload never invents HOLD");
assert.strictEqual(state.showing.live, false);
assert.ok(state.showing.title.indexOf("DEMO") !== -1);
assert.strictEqual(Gate.pendingCount(state), 0, "DEMO does not inflate PENDING");
assert.strictEqual(Gate.defaultFocus(state.showing), "", "no default pillar without a verdict");
assert.strictEqual(Gate.recommendedLine(state.showing), "no verdict in payload");
assert.ok(state.showing.reason.indexOf("does not block") !== -1);

state = Gate.resolveOpen("{}", state);
assert.strictEqual(state.showing.decision, "", "empty summons stay empty, they do not cycle HOLD");

let demoTour = Gate.resolveOpen('{"demo":true}', Gate.emptyState());
assert.strictEqual(demoTour.showing.decision, "HOLD");
assert.strictEqual(demoTour.showing.live, false);
assert.ok(demoTour.showing.title.indexOf("DEMO") === 0);
assert.strictEqual(Gate.pendingCount(demoTour), 0);
demoTour = Gate.resolveOpen('{"demo":true}', demoTour);
assert.strictEqual(demoTour.showing.decision, "NO", "explicit demo:true cycles DEMO samples");
demoTour = Gate.resolveOpen('{"demo":true}', demoTour);
assert.strictEqual(demoTour.showing.decision, "GO");
demoTour = Gate.resolveOpen('{"demo":true}', demoTour);
assert.strictEqual(demoTour.showing.decision, "HOLD");

const liveJson = '{"decision":"HOLD","title":"Deploy to prod?","reason":"no rollback","risks":["prod write"],"source":"manual"}';
state = Gate.resolveOpen(liveJson, state);
assert.strictEqual(state.showing.live, true);
assert.strictEqual(state.showing.title, "Deploy to prod?");
assert.strictEqual(Gate.pendingCount(state), 1);
assert.strictEqual(Gate.pendingPayload(state, now).pending, 1);
assert.strictEqual(Gate.parsePendingFile(Gate.receiptLine(Gate.pendingPayload(state, now))), 1);

const reopened = Gate.resolveOpen("{}", state);
assert.strictEqual(reopened.showing.live, true, "empty summon keeps held LIVE payload");
assert.strictEqual(reopened.showing.title, "Deploy to prod?");
assert.strictEqual(Gate.pendingCount(reopened), 1);

const demoOverLive = Gate.resolveOpen('{"demo":true}', reopened);
assert.strictEqual(demoOverLive.showing.live, false);
assert.strictEqual(Gate.pendingCount(demoOverLive), 1, "forced DEMO does not drop the held LIVE payload");

const partial = Gate.parsePayload('{"title":"Ship it","reason":"looks fine"}');
assert.strictEqual(partial.decision, "");
assert.strictEqual(partial.live, false);
const partialOpen = Gate.resolveOpen('{"title":"Ship it","reason":"looks fine"}', Gate.emptyState());
assert.strictEqual(partialOpen.showing.live, false);
assert.strictEqual(partialOpen.showing.decision, "", "do not invent HOLD for a title-only payload");
assert.ok(partialOpen.showing.title.indexOf("Ship it") !== -1);
assert.ok(partialOpen.showing.title.indexOf("DEMO") === 0);
assert.strictEqual(Gate.recommendedLine(partialOpen.showing), "no verdict in payload");
assert.strictEqual(Gate.pendingCount(partialOpen), 0);
assert.strictEqual(Gate.defaultFocus(partialOpen.showing), "", "do not invent HOLD focus");
assert.strictEqual(Gate.canConfirm(""), false);
assert.strictEqual(Gate.canConfirm("HOLD"), true);

const confirmed = Gate.confirm(state, "NO", now);
assert.strictEqual(confirmed.error, "");
assert.strictEqual(confirmed.receipt.choice, "NO");
assert.strictEqual(confirmed.receipt.recommended, "HOLD");
assert.strictEqual(confirmed.receipt.live, true);
assert.strictEqual(confirmed.receipt.mode, "live");
assert.strictEqual(confirmed.receipt.ts, now);
assert.strictEqual(confirmed.clearPending, true);
assert.strictEqual(Gate.pendingCount(confirmed.state), 1, "confirm keeps LIVE pending until the receipt write succeeds");
assert.strictEqual(Gate.pendingCount(Gate.clearPending(confirmed.state)), 0, "clearPending after a successful write");

const noChoice = Gate.confirm(state, "", now);
assert.strictEqual(noChoice.error, "no action selected");
assert.strictEqual(noChoice.receipt, null);
assert.strictEqual(noChoice.clearPending, false);
assert.strictEqual(Gate.pendingCount(noChoice.state), 1, "refused confirm does not drop LIVE pending");

assert.strictEqual(Gate.focusFromKey("g"), "GO");
assert.strictEqual(Gate.focusFromKey("1"), "GO");
assert.strictEqual(Gate.focusFromKey("h"), "HOLD");
assert.strictEqual(Gate.focusFromKey("2"), "HOLD");
assert.strictEqual(Gate.focusFromKey("n"), "NO");
assert.strictEqual(Gate.focusFromKey("3"), "NO");
assert.strictEqual(Gate.focusFromKey("x"), "");
assert.strictEqual(Gate.decisionIndex("GO"), 0);
assert.strictEqual(Gate.decisionIndex("HOLD"), 1);
assert.strictEqual(Gate.decisionIndex("NO"), 2);
assert.strictEqual(Gate.decisionColor("GO"), "#3DDC97");
assert.strictEqual(Gate.decisionColor("HOLD"), "#F5A524");
assert.strictEqual(Gate.decisionColor("NO"), "#FF4D6D");

const pillars = Gate.pillarModel("HOLD");
assert.strictEqual(pillars.length, 3);
assert.strictEqual(pillars[1].selected, true);
assert.strictEqual(pillars[0].selected, false);
const none = Gate.pillarModel("");
assert.ok(none.every(function(p) { return p.selected === false; }), "no pillar preselected without a verdict");

assert.ok(Gate.receiptsPath("/home/ada").indexOf("/.local/share/smf-aegis-gate/receipts.jsonl") !== -1);
assert.ok(Gate.pendingPath("/home/ada").indexOf("/.local/share/smf-aegis-gate/pending.json") !== -1);

const spec = Gate.writeSpec("receipts", "/home/ada", "{\"choice\":\"GO\"}");
assert.strictEqual(String(spec.argv[0]), "bash");
assert.strictEqual(String(spec.argv[1]), "-c");
assert.strictEqual(String(spec.argv[4]), "/home/ada/.local/share/smf-aegis-gate");
assert.ok(String(spec.argv[2]).indexOf(">>") !== -1);
assert.ok(String(spec.argv[2]).indexOf("$2") !== -1, "JSON body is not interpolated into the shell script");
assert.strictEqual(Gate.writeReady(spec), true);
assert.strictEqual(Gate.writeReady(Gate.writeSpec("receipts", "", "{\"choice\":\"GO\"}")), false, "empty HOME is not writable");
assert.strictEqual(Gate.receiptFailureMessage(), "receipts not writable · ~/.local/share/smf-aegis-gate");
assert.strictEqual(Gate.receiptStatusForWrite(false, "/tmp/x"), Gate.receiptFailureMessage());
assert.ok(Gate.receiptStatusForWrite(true, "/tmp/x").indexOf("/tmp/x") !== -1);

const pendingSpec = Gate.writeSpec("pending", "/home/ada", "{\"pending\":0}");
assert.ok(String(pendingSpec.argv[2]).indexOf(">") !== -1);
assert.ok(String(pendingSpec.argv[2]).indexOf(">>") === -1);
assert.strictEqual(Gate.writeReady(pendingSpec), true);

const os = require("os");
const { spawnSync } = require("child_process");
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-gate-"));
const writeLine = Gate.receiptLine({ choice: "GO", live: true, title: "tmp" });
const write = Gate.writeSpec("receipts", tmpHome, writeLine);
const ran = spawnSync(write.argv[0], write.argv.slice(1), { encoding: "utf8" });
assert.strictEqual(ran.status, 0, ran.stderr || "receipt write failed");
assert.ok(fs.existsSync(write.file));
assert.ok(fs.readFileSync(write.file, "utf8").indexOf("\"choice\":\"GO\"") !== -1);
const pendingBody = Gate.receiptLine({ pending: 0 });
const pendingWrite = Gate.writeSpec("pending", tmpHome, pendingBody);
const ranPending = spawnSync(pendingWrite.argv[0], pendingWrite.argv.slice(1), { encoding: "utf8" });
assert.strictEqual(ranPending.status, 0, ranPending.stderr || "pending write failed");
assert.strictEqual(Gate.parsePendingFile(fs.readFileSync(pendingWrite.file, "utf8")), 0);

assert.strictEqual(Gate.parsePendingFile('{"pending":1}'), 1);
assert.strictEqual(Gate.parsePendingFile('{"pending":0}'), 0);
assert.strictEqual(Gate.parsePendingFile("nope"), 0);
assert.strictEqual(Gate.parsePendingFile(JSON.stringify({ pending: 0, title: "DEMO" })), 0);

const hex = Gate.hexPoints(0, 0, 10, 0);
assert.strictEqual(hex.length, 6);
assert.ok(hex.every(function(pt) {
  return typeof pt.x === "number" && typeof pt.y === "number";
}));

const overlay = fs.readFileSync(path.join(__dirname, "..", "Overlay.qml"), "utf8");
assert.ok(overlay.includes("function open(payloadJson)"));
assert.ok(overlay.includes("function close()"));
assert.ok(overlay.includes("WlrLayershell.namespace: \"smf-aegis-gate\""));
assert.ok(overlay.includes("Qt.Key_Escape"));
assert.ok(overlay.includes("Qt.Key_G"));
assert.ok(overlay.includes("Qt.Key_H"));
assert.ok(overlay.includes("Qt.Key_N"));
assert.ok(overlay.includes("confirmPulse"));
assert.ok(overlay.includes("property string selectedAction: \"\""));
assert.ok(overlay.includes("Gate.canConfirm"));
assert.ok(overlay.includes("select GO, HOLD, or NO first"));
assert.ok(overlay.includes("receiptFailureMessage"));
assert.ok(overlay.includes("writeReady"));
assert.ok(overlay.includes("clearPending"));
assert.ok(!overlay.includes("closeFallback"));
assert.ok(!overlay.includes("omarchy.aegis"));
assert.ok(Gate.neverClaimsAgentBridge(overlay));

const bar = fs.readFileSync(path.join(__dirname, "..", "BarWidget.qml"), "utf8");
assert.ok(bar.includes("moduleName: \"smf.aegis-gate\""));
assert.ok(bar.includes("pendingCount"));
assert.ok(bar.includes("omarchy-shell shell toggle smf.aegis-gate '{}'"));

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
assert.strictEqual(manifest.id, "smf.aegis-gate");
assert.ok(!String(manifest.id).startsWith("omarchy."));
assert.deepStrictEqual(manifest.kinds, ["overlay", "bar-widget"]);
assert.strictEqual(manifest.entryPoints.overlay, "Overlay.qml");
assert.strictEqual(manifest.entryPoints.barWidget, "BarWidget.qml");
assert.strictEqual(manifest.keepLoaded, true);
assert.strictEqual(manifest.author, "SMF Works");
assert.strictEqual(manifest.license, "MIT");
assert.ok(String(manifest.description).indexOf("summon HUD") !== -1);
assert.ok(String(manifest.description).indexOf("not a Hermes or tool interlock") !== -1);
assert.ok(Gate.neverClaimsAgentBridge(manifest.description));
assert.ok(!fs.lstatSync(path.join(__dirname, "..", "Overlay.qml")).isSymbolicLink());
assert.ok(!fs.lstatSync(path.join(__dirname, "..", "BarWidget.qml")).isSymbolicLink());
assert.ok(!fs.lstatSync(path.join(__dirname, "..", "GateLogic.js")).isSymbolicLink());
assert.ok(!fs.lstatSync(path.join(__dirname, "..", "manifest.json")).isSymbolicLink());
assert.ok(!fs.lstatSync(path.join(__dirname, "..", "docs", "OPPOSITION.md")).isSymbolicLink());

const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
assert.ok(readme.includes("omarchy plugin add https://github.com/smfworks/omarchy-aegis-gate.git --enable"));
assert.ok(readme.includes("omarchy-shell shell summon smf.aegis-gate"));
assert.ok(readme.includes("unsandboxed"));
assert.ok(readme.includes("DEMO"));
assert.ok(readme.includes("LIVE"));
assert.ok(readme.includes("~/.local/share/smf-aegis-gate/receipts.jsonl"));
assert.ok(readme.includes("refuse-card"));
assert.ok(readme.includes("omarchy-orbit-dock"));
assert.ok(readme.includes("omarchy-ghost-trace"));
assert.ok(readme.includes("summon HUD, not a hard agent interlock") || readme.includes("not a hard agent interlock"));
assert.ok(readme.includes("docs/OPPOSITION.md"));
assert.ok(readme.includes("{\"demo\":true}") || readme.includes("demo\":true"));
assert.ok(readme.includes("Escape") || readme.includes("`Escape`"));
assert.ok(Gate.neverClaimsAgentBridge(readme));

const preview = fs.readFileSync(path.join(__dirname, "..", "preview", "index.html"), "utf8");
assert.ok(preview.includes("DEMO airlock"));
assert.ok(preview.includes("no verdict in payload"));
assert.ok(preview.includes("select GO, HOLD, or NO first"));
assert.ok(Gate.neverClaimsAgentBridge(preview));

const opposition = fs.readFileSync(path.join(__dirname, "..", "docs", "OPPOSITION.md"), "utf8");
assert.ok(opposition.includes("do not trust Aegis Gate as an agent gate yet"));
assert.ok(opposition.includes("DEMO looking like a LIVE"));
assert.ok(opposition.includes("invents HOLD") || opposition.includes("invent HOLD"));
assert.ok(opposition.includes("receipts fail silently") || opposition.includes("Receipts fail"));
assert.ok(opposition.includes("Keyboard confirm"));
assert.ok(opposition.includes("Hermes") && opposition.includes("hook"));

console.log("ok - GateLogic helpers");
