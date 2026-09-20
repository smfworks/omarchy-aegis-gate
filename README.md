# Aegis Gate

Fullscreen sci-fi **GO / HOLD / NO** summon HUD for [Omarchy](https://omarchy.org)
Quattro. A starship airlock shield: dimmed overlay, hexagonal chrome, giant
tricolor decision pillars, reason text, risk chips, confirm.

**This is a summon HUD, not a hard agent interlock.** It does not intercept
Hermes, tool calls, or deploys. A future agent bridge would need a real hook;
this plugin does not have one. Adversarial review:
[docs/OPPOSITION.md](docs/OPPOSITION.md).

Plugin id: `smf.aegis-gate`. Overlay plus a tiny bar-widget summoner /
PENDING chip. From [SMF Works](https://github.com/smfworks); destined for
mikesai6 Omarchy installs when that bundle is used.

Spiritual sibling of the web app
[Refuse Card](https://github.com/smfworks/refuse-card) — same GO / HOLD / NO
stamp language, native Omarchy overlay instead of a shareable card.

Sibling plugins:
[Orbit Dock](https://github.com/smfworks/omarchy-orbit-dock),
[Ghost Trace](https://github.com/smfworks/omarchy-ghost-trace).

## Demo

Aegis Gate on Omarchy (mikesai6) — GO / HOLD / NO summon HUD (DEMO samples + labeled HOLD/NO/GO).

https://github.com/smfworks/omarchy-aegis-gate/releases/download/demo/demo.mp4

## Install

```sh
omarchy plugin add https://github.com/smfworks/omarchy-aegis-gate.git --enable
```

Plugins run **unsandboxed** inside the long-lived `omarchy-shell` process, with
your user permissions. Review this repo before enabling.

Optional bar chip (right section by default):

```sh
omarchy bar move smf.aegis-gate --section right
```

## Summon

Fullscreen `overlay`, same contract as first-party pickers and
`smf.orbit-dock` / `smf.ghost-trace`:

```sh
omarchy-shell shell summon smf.aegis-gate '{"decision":"HOLD","title":"…","reason":"…"}'
omarchy-shell shell hide smf.aegis-gate
omarchy-shell shell toggle smf.aegis-gate '{}'
omarchy-shell shell summon smf.aegis-gate '{"demo":true}'
```

```
bind = SUPER, A, exec, omarchy-shell shell toggle smf.aegis-gate '{}'
```

`{}` opens a labeled **DEMO airlock with no verdict**. It does not invent
HOLD. `{"demo":true}` cycles labeled DEMO samples (HOLD, then NO, then GO).
Neither path blocks an agent.

Payload:

```json
{
  "decision": "HOLD",
  "title": "Deploy to prod?",
  "reason": "Migration has no rollback",
  "risks": ["prod write", "no canary"],
  "source": "manual"
}
```

`decision` must be `GO`, `HOLD`, or `NO`. `source` is a label only
(`hermes` | `manual` | `demo`) — `hermes` does not hook Hermes. Click the
bar chip to toggle the same overlay.

## Keys

- `Escape` closes
- `1` / `G` focuses **GO**
- `2` / `H` focuses **HOLD**
- `3` / `N` focuses **NO**
- `Enter` confirms the selected action, writes a receipt, and closes.
  With no pillar selected, Enter does nothing but say so — it does not
  invent HOLD
- Click a pillar to focus and confirm
- Click the dimmed backdrop to dismiss without confirming

## DEMO vs LIVE

The honesty chip and the core card are labeled so a screenshot is
self-describing:

- **LIVE** — summon JSON included a valid `decision`. The payload is held in
  memory while the overlay stays loaded (`keepLoaded`)
- **DEMO** — empty, invalid, or missing `decision`, or `source: "demo"` /
  `{"demo":true}`. Titles carry `DEMO ·`. DEMO never pretends it came from a
  live agent

Aegis Gate **does not invent a verdict** when the payload has no `decision`.
Empty `{}` is a DEMO airlock with `no verdict in payload`. Partial text
without a verdict is shown the same way.

## PENDING chip

The bar widget shows **PENDING** only when a real LIVE payload is held in
memory. DEMO samples do not inflate the count. Dismissing with Escape keeps
the live payload; confirming clears it only after the receipt file append
succeeds. Empty summon while a live payload is held reopens that gate
instead of replacing it with DEMO.

## Receipts

On confirm, Aegis Gate appends one JSON line to:

```
~/.local/share/smf-aegis-gate/receipts.jsonl
```

If that path is not writable, the HUD stays open, keeps any LIVE pending
payload, and says `receipts not writable · ~/.local/share/smf-aegis-gate`
instead of pretending the choice was stored. Each line records `choice`,
`recommended`, `title`, `reason`, `risks`, `mode`, `source`, and `live`.

## Contract

- `schemaVersion: 1`, id `smf.aegis-gate` (not `omarchy.*`)
- `kinds: ["overlay", "bar-widget"]`
- `entryPoints.overlay: "Overlay.qml"`, `entryPoints.barWidget: "BarWidget.qml"`
- `open(payloadJson)` / `close()` for `shell summon` / `shell hide`
- `keepLoaded: true` so the layer-shell window and pending LIVE payload
  survive between summons
- Bar click runs `omarchy-shell shell toggle smf.aegis-gate '{}'`
- Imports `qs.Ui` / `qs.Commons`; no symlinks

```sh
omarchy plugin validate .
```

## Tests

```sh
node tests/test_gate_logic.js
```

## Remove

```sh
omarchy plugin remove smf.aegis-gate
```

## License

MIT. Copyright (c) 2026 SMF Works.
