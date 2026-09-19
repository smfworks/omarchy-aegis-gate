# Aegis Gate

Fullscreen sci-fi **GO / HOLD / NO** approval HUD for [Omarchy](https://omarchy.org)
Quattro. A starship airlock shield: dimmed overlay, hexagonal chrome, giant
tricolor decision pillars, reason text, risk chips, confirm.

Plugin id: `smf.aegis-gate`. Overlay plus a tiny bar-widget summoner /
PENDING chip. From [SMF Works](https://github.com/smfworks); destined for
mikesai6 Omarchy installs when that bundle is used.

Spiritual sibling of the web app
[Refuse Card](https://github.com/smfworks/refuse-card) — same GO / HOLD / NO
stamp language, native Omarchy overlay instead of a shareable card.

Sibling plugins:
[Orbit Dock](https://github.com/smfworks/omarchy-orbit-dock),
[Ghost Trace](https://github.com/smfworks/omarchy-ghost-trace).

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
```

```
bind = SUPER, A, exec, omarchy-shell shell toggle smf.aegis-gate '{}'
```

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
(`hermes` | `manual` | `demo`). Click the bar chip to toggle the same overlay.

## Keys

- `Escape` closes
- `1` / `G` focuses **GO**
- `2` / `H` focuses **HOLD**
- `3` / `N` focuses **NO**
- `Enter` confirms the selected action, writes a receipt, and closes
- Click a pillar to focus and confirm
- Click the dimmed backdrop to dismiss without confirming

## DEMO vs LIVE

The honesty chip is labeled so a screenshot is self-describing:

- **LIVE** — summon JSON included a valid `decision`. The payload is held in
  memory while the overlay stays loaded (`keepLoaded`)
- **DEMO** — empty, invalid, or missing `decision`, or `source: "demo"` /
  `{"demo":true}`. A curated sample gate still fills the HUD (HOLD, then NO,
  then GO on later empty summons). DEMO never pretends it came from a live
  agent

Aegis Gate **does not invent a verdict** when the payload has no `decision`.
Partial text without a verdict is shown as DEMO with `no verdict in payload`.

This is a **manual / summon HUD**. It does not intercept Hermes, tool calls,
or deploys. A future agent bridge would need a real hook; this plugin does
not claim that wiring.

## PENDING chip

The bar widget shows **PENDING** only when a real LIVE payload is held in
memory. DEMO samples do not inflate the count. Dismissing with Escape keeps
the live payload; confirming clears it. Empty summon while a live payload is
held reopens that gate instead of replacing it with DEMO.

## Receipts

On confirm, Aegis Gate appends one JSON line to:

```
~/.local/share/smf-aegis-gate/receipts.jsonl
```

If that path is not writable, the HUD says so instead of pretending the
choice was stored. Each line records `choice`, `recommended`, `title`,
`reason`, `risks`, `mode`, `source`, and `live`.

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
