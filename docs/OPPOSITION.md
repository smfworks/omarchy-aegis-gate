# Opposition: do not trust Aegis Gate as an agent gate yet

Adversarial review of `smfworks/omarchy-aegis-gate` at `192a450`
(`smf.aegis-gate` v0.1.0, plugin #1). Evidence is from `GateLogic.js`,
`Overlay.qml`, `BarWidget.qml`, `manifest.json`, `README.md`,
`preview/index.html`, and `tests/test_gate_logic.js`.

This plugin sells a fullscreen **GO / HOLD / NO** airlock as an approval
HUD. Plugin #1 already tried to be honest: LIVE needs a real verdict,
DEMO has a chip, PENDING is supposed to ignore samples, receipts try to
say when the JSONL path is not writable, and the README says “manual /
summon HUD.” The leftover lies are on the **face** and on the **close
path**. A screenshot of the pillars still looks like an agent decided.
Enter still confirms a verdict the payload never sent. A failed receipt
write still closes the overlay and drops the held LIVE payload.

Method: assume a user screenshots the HUD (or the PENDING chip) and
treats GO / HOLD / NO as a live agent, tool, or deploy gate. Argue
against that trust. Example inputs are concrete.

This same PR records the opposition **and** lands the P0 + high-P1
fixes in §8. The analysis below is the pre-fix evidence.

---

## 1. Executive opposition

I would not put Hermes, a tool runner, or a deploy script behind this
HUD. Empty `omarchy-shell shell toggle smf.aegis-gate '{}'` paints a
full **HOLD** airlock titled “Deploy to staging?” with weekend-window
risk chips. That is a curated DEMO sample, but the core card does not
say DEMO — only a small top chip does. `defaultFocus` then invents
**HOLD** whenever the payload has no verdict, so Enter writes a HOLD
receipt without the operator choosing. Confirm clears the LIVE pending
slot *before* `receipts.jsonl` appends; `closeFallback` dismisses in
900ms even when the writer never exits; `closeAfterWrite` dismisses on
a non-zero exit too. `source: "hermes"` is a sticker. There is no
Hermes hook, no tool interceptor, no exec wrapper. The manifest still
calls this an HUD “for agent, tool, and deploy gates.” Do not
screenshot this and call the agent gated.

Verdict: **HOLD the HUD. Do not use it as an agent gate.**

---

## 2. P0 — trust breakers (must-fix)

### P0.1 DEMO looking like a LIVE agent decision

`resolveOpen` on an empty or missing payload does not stay empty. It
loads `demoSamples()[0]`, a HOLD titled “Deploy to staging?”:

```javascript
if (parsed.forceDemo || !next.pending) {
  var samples = demoSamples()
  var idx = ((next.demoIndex % samples.length) + samples.length) % samples.length
  next.showing = decorateGate(samples[idx], "demo")
```

`decorateGate` will stamp `mode: "demo"` and `source: "demo"`. The
honesty chip in `Overlay.qml` is a 38px caption at the top of a
fullscreen layer-shell window. The core card — the thing a screenshot
crops to — prints `AEGIS GATE`, the operational title, the reason, and
the risk chips. Nothing in that card says DEMO. The recommended line
for a sample is `DEMO sample HOLD`, 12px, under the risks.

The samples are chosen to look like real gates:

| Sample | Face | Why it reads LIVE |
|--------|------|-------------------|
| HOLD | “Deploy to staging?” / unreviewed diff / weekend window | Same language as a real ship check |
| NO | “Wipe the build cache?” / irreversible | Looks like a refuse of a destructive tool |
| GO | “Lint the README?” | Looks like an agent was allowed to proceed |

`preview/index.html` scene `demo` is that same HOLD. A recording of the
preview is indistinguishable from a LIVE HOLD unless the viewer reads
the 13px chip.

LIVE vs DEMO is also easy to miss because LIVE uses the HOLD amber
(`#F5A524`) and DEMO uses theme accent. A LIVE HOLD and a DEMO HOLD
are the same three pillars and the same hexagonal ring. The chip is
the only difference.

**Fix contract:** a cropped core card must still be self-describing.
DEMO titles carry `DEMO ·`. Empty summons do not borrow a sample
verdict. LIVE stays LIVE only when the summon JSON had a real
`GO`/`HOLD`/`NO`.

### P0.2 Empty payload invents HOLD

`parsePayload("{}")` correctly returns `decision: ""` and `live:
false`. The face does not honor that.

Three independent HOLD inventions:

1. **Sample fill.** Empty summon with no held LIVE payload cycles
   HOLD → NO → GO (`resolveOpen`, first sample HOLD). Tests on
   `192a450` *require* this: `resolveOpen("{}", state)` must show
   HOLD. The test suite is protecting the lie.
2. **`defaultFocus`.** `return decision || "HOLD"`. Title-only
   `{"title":"Ship it","reason":"looks fine"}` keeps `decision: ""`
   (good) and then focuses HOLD anyway (bad). The same test file
   asserts both: `showing.decision === ""` and
   `defaultFocus(...) === "HOLD"`.
3. **Overlay initial property.** `property string selectedAction: "HOLD"`.
   Before `open()` runs, and any time `defaultFocus` returns empty,
   the QML side is already on HOLD.

Enter then confirms HOLD. `confirm()` only rejects an empty *choice*,
not an invented one. The receipt’s `recommended` field is `""` for a
title-only payload and `choice` is `"HOLD"`. The JSONL line looks like
an operator refused to proceed. They did not. They opened an empty
airlock and hit Enter.

**Fix contract:** missing or invalid `decision` never becomes HOLD on
the face, in focus, or in a receipt. Enter without an explicit GO /
HOLD / NO is `no action selected`.

### P0.3 Keyboard confirm without a clear decision

`Overlay.qml` keys:

```qml
} else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
  root.confirmSelected()
```

`confirmSelected` only checks `Gate.normalizeDecision(root.selectedAction)`.
Because of P0.2 that string is HOLD on first paint. There is no
“operator has chosen” bit. Arrow keys, hover on a pillar, and the
initial property all look the same as a deliberate 2/H.

Click-on-pillar is an explicit choice (focus + confirm). Enter on a
LIVE payload that *arrived* with HOLD is also a clear decision — the
summon JSON named it. Enter on `{}`, on `{"title":"Ship it"}`, or on a
DEMO sample the operator never asked for, is not.

`closeFallback` (900ms) then hides the overlay. The operator cannot
see that the confirmed action was the invented HOLD.

**Fix contract:** no default focus when the payload has no verdict.
Enter / `confirmSelected` no-ops with a visible “select GO, HOLD, or
NO first.” Pillar click and 1/G 2/H 3/N remain the explicit path.

### P0.4 Claiming Hermes / tool blocking without a hook

There is no interceptor.

| Surface | Claim | Reality |
|---------|-------|---------|
| `manifest.json` `description` | “approval HUD for agent, tool, and deploy gates” | Summon-only overlay |
| `barWidget.category` | `Agents` | A bar chip that `toggle`s `'{}'` |
| Repo description | “sci-fi GO/HOLD/NO agent approval HUD” | Same plugin |
| `source: "hermes"` | honesty line “summoned as hermes” | A string in JSON. Nothing talks to Hermes |
| Plugin name / chrome | AEGIS GATE, airlock, PENDING | Implies a process is held |

What the process actually does: `open(payloadJson)` parses JSON,
paints pillars, and on confirm appends a line under
`~/.local/share/smf-aegis-gate/receipts.jsonl`. No `ptrace`, no
wrapper binary, no Hermes Desktop approval socket, no
`before_tool_call`, no systemd inhibitor, no deploy lockfile.

`honestyLine` already says “HUD does not block tools” / “manual HUD,
not an agent bridge.” The README says the same. The **manifest and
the name of the thing** still sell a gate. A plugin picker screenshot
shows “agent, tool, and deploy gates.” That is the claim operators
will believe.

`neverClaimsAgentBridge()` only rejects three substrings
(`blocking hermes`, `blocked the agent`, `tool call intercepted`).
It does not read the manifest sentence that does the damage.

**Fix contract:** product copy (manifest, README, HUD, preview) may
only describe a **summon HUD**. Hermes/tool/deploy interlock language
is a future hook, not this plugin.

---

## 3. P1 — high (correctness on the close path)

### P1.1 Receipts fail silently on the path that matters

`receiptWriter.onExited` *does* set
`receipts not writable · ~/.local/share/smf-aegis-gate` when
`exitCode !== 0`. That is not enough.

**A. Confirm clears LIVE pending before the write.**

```javascript
if (gate.live) next.pending = null
```

`finishConfirm` assigns `root.gateState = result.state`, then
`persistPending()` writes `{pending:0}`, then starts the receipt
Process. If the append fails, the LIVE payload is already gone. The
operator has no receipt and no PENDING chip. The airlock lied twice.

**B. Failure still closes the overlay.**

```qml
onExited: {
  if (root.confirming) {
    if (receiptWriter.exitCode === 0) {
      root.receiptStatus = "receipt · " + root.lastReceiptPath
    } else {
      root.receiptStatus = "receipts not writable · ~/.local/share/smf-aegis-gate"
    }
    closeAfterWrite.restart()
  }
}
```

220ms later the HUD is gone. The error lives in a 0.5-opacity footer
that is no longer on screen.

**C. `closeFallback` dismisses if `onExited` never fires.**

900ms timer, started unconditionally after `runWriter`. Empty `HOME`,
a Process that never starts, or a hung `bash` → overlay closes,
`receiptStatus` still `writing …`, no line on disk.

**D. Empty HOME is not refused.**

`shareDir("")` is `""`. `writeSpec` still builds
`mkdir -p "" && printf … >> ""`. Overlay does not check
`writeReady`. `pendingWriter` has no `onExited` at all.

**Fix contract:** do not clear pending until the receipt append
exits 0. On failure or unready path, stay open, keep the LIVE
payload, put the error on the footer. No dismiss-on-timeout.

### P1.2 PENDING must only count a live held payload

`pendingCount` on `192a450` already requires
`pending.live === true && pending.mode === "live"`. That is the
right contract. It is not the whole story.

- Empty `{}` still *shows* a HOLD sample. The chip stays 0 (good)
  while the fullscreen HUD says HOLD (P0.1). Screenshot-trust moves
  from the chip to the overlay.
- `parsePendingFile` trusts any `{"pending": N}`. A stale or
  hand-written `pending.json` with `pending: 1` lights the bar even
  when Overlay’s memory is empty. The bar never sees `live` /
  `mode` — only the integer.
- `pendingWriter` failures are ignored, so a LIVE hold can exist in
  memory with a chip that still says `AG`.

High-P1 remaining work: keep the live-only counter, stop DEMO from
looking pending on the *overlay*, and do not let confirm-before-write
zero the chip (P1.1).

### P1.3 README honesty: summon HUD, not a hard interlock

The README already has a “DEMO vs LIVE” section and a sentence that
this is a manual / summon HUD. It also walks operators through
`omarchy plugin add … --enable` and a SUPER+A bind to `toggle '{}'`.
That bind is the empty-payload HOLD invention (P0.2). The install
path does not point at `docs/OPPOSITION.md`. The first paragraph
still frames a “starship airlock shield” as an approval HUD for
Omarchy Quattro without saying, in the opening, that **nothing is
blocked**.

**Fix contract:** lead with “summon HUD, not an agent interlock.”
Link this opposition. Document that `{}` does not invent a verdict
and that `{"demo":true}` is the only way to tour labeled samples.

---

## 4. P2 — still open after this PR

- No Hermes / tool / deploy hook. Building one is a different
  plugin (or a later major version), not a paint pass.
- `source: "hermes"` remains a label. A future bridge should refuse
  that source until a real waiter exists.
- Bar `FileView` of `pending.json` can desync from overlay memory
  (1.5s poll, integer-only schema).
- `bash -c` receipt writer is a user-local append, not an audit
  log. No fsync, no hash chain, no signature.
- Preview HTML is a sibling skin, not Quickshell. This environment
  cannot run `omarchy-shell`.
- `category: "Agents"` still parks the chip next to real agent
  widgets. Changing marketplace taxonomy is out of scope.
- Repo GitHub description still says “agent approval HUD.”

---

## 5. Quick wins (what this PR must land)

1. Empty / invalid / missing `decision` never becomes HOLD.
2. `defaultFocus` returns `""` without a verdict; Overlay initial
   `selectedAction` is empty; Enter refuses with a visible error.
3. DEMO titles prefix `DEMO ·`. Honesty chip + source line stay on
   the card. LIVE only when the payload carried GO/HOLD/NO and was
   not `demo` / `source: "demo"`.
4. PENDING stays 0 unless a LIVE payload is held. Confirm does not
   drop that hold until the receipt write exits 0.
5. Receipt failure: stay open, keep pending, footer
   `receipts not writable · ~/.local/share/smf-aegis-gate`.
   Unready HOME is the same error, immediately.
6. Manifest + README: summon HUD, not a hard agent interlock. Link
   this document. `neverClaimsAgentBridge` keeps scanning product
   copy.
7. Tests for (1)–(6), including the title-only payload, empty `{}`,
   explicit `{"demo":true}` tour, confirm-without-choice, and
   write-not-ready.

---

## 6. Suggested ship (this PR)

**Title:** Honest aegis — OPPOSITION + trust fixes.

Do not restyle the airlock. Change the trust contract so a
screenshot is *disprovable*:

- DEMO cannot be cropped into a LIVE agent decision.
- `{}` is an empty DEMO airlock, not HOLD.
- Enter does not confirm an unchosen verdict.
- Receipts that fail are visible and do not erase PENDING.
- Copy stops claiming a Hermes/tool interlock that does not exist.

---

## 7. What already held on `192a450`

- **`parsePayload` does not invent a verdict in the data model.**
  `MAYBE`, empty string, and garbage JSON are `decision: ""` and
  `live: false`. Title-only payloads stay non-live.
- **`pendingCount` ignores DEMO** when `pending.live` / `mode` are
  set correctly.
- **Honesty chip exists** (`modeLabel`, `honestyLine`).
- **Receipt argv does not interpolate JSON into the shell script**
  (`printf '%s\n' "$2"`).
- **Quattro overlay shape is largely correct:** `smf.aegis-gate`
  (not `omarchy.*`), `overlay` + `bar-widget`, `open` / `close`,
  `keepLoaded`, layer-shell namespace `smf-aegis-gate`, Escape,
  no symlinks.
- **USD / cost is not a problem here** — this plugin does not
  touch Hermes billing.
- **MIT LICENSE** and tests for the helpers that already existed.

None of that makes the HUD screenshot-safe as an agent gate. It
means this PR can stay small: face labels, no invented HOLD, visible
receipt failure, README honesty, tests.

---

## 8. Addressed in this PR

Product follow-up in the same change as this document:

| Item | Change |
|------|--------|
| P0.1 DEMO≈LIVE | `decorateGate` prefixes DEMO titles. Core card shows `sourceLabel`. Empty `{}` no longer loads a sample HOLD. |
| P0.2 invent HOLD | `resolveOpen("{}")` shows a DEMO airlock with `decision: ""`. Samples only for explicit `{"demo":true}` / `source: "demo"` with no other content. |
| P0.3 Enter | `defaultFocus` is `""` without a verdict. Overlay `selectedAction` starts empty. `confirm` / `confirmSelected` return `no action selected`. |
| P0.4 fake interlock | Manifest description is a summon HUD. README leads with “not a hard agent interlock” and links here. |
| P1.1 receipts | `confirm` does not clear pending. Overlay clears only after exit 0. Failure / unready HOME stays open with `receiptFailureMessage`. `closeFallback` removed. |
| P1.2 PENDING | Still live-only. Confirm-before-write no longer zeros the chip. |
| P1.3 README | Summon HUD, opposition link, `{}` vs `{"demo":true}` documented. |
| Tests | Empty `{}`, title-only, defaultFocus, confirm-without-choice, writeReady, clearPending, product-copy scan. |

Still open: the real Hermes/tool hook (P2), bar-file desync, GitHub
repo description.

Until a waiter exists that can actually block a tool call, treat
every GO on this HUD as a human stamp on a picture — not a gate.
