# Phara-O Mini — Editor / Librarian

A web app to control the **Behringer Phara-O Mini** synthesizer over the
**Web MIDI API**. No backend, no Electron. The synth has no display, so the
whole point of this app is to **show you the numeric value** of every parameter
as you change it.

## Design premise (read this)

The app is **one-way: app → synth**. The hardware has no encoders and no SysEx
state dump, so the app **cannot read the physical knob positions**. For every
parameter it controls, the app is authoritative: you set a value in the UI, the
UI displays it and sends it as a MIDI CC. If a physical knob and the app value
drift apart, that's expected — not a bug.

## Running locally

Web MIDI requires a secure context (`https` or `localhost`) and a Chromium-based
browser (on Linux it talks to ALSA).

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run check      # svelte-check / TypeScript
npm run build      # production build (adapter-auto; Vercel-ready)
npm run preview    # preview the production build
```

When the page loads, click **Connect MIDI** and allow the permission prompt.
The output port whose name contains `PHARA-O` is auto-selected (marked ★).

### Make the synth actually listen

For the Phara-O to react to incoming USB MIDI, its MIDI receive must be on:

- **CC receive:** enable **MIDI Rx** — that's all the controls on this page need.
- **Tempo over clock (future):** will need **Clock Source = USB MIDI**
  (hold **FUNC + key 7** while powering on). Not implemented yet.
- Match the **MIDI channel** in the app to the synth's channel (default 1).

## What it controls

Data comes verbatim from the official MIDI implementation chart and lives in one
typed config, [`src/lib/params.ts`](src/lib/params.ts) — the single source of
truth. The UI panel is just a map over it.

- **14 continuous CC params** (0–127) — sliders with a big live value readout.
- **Stepped params** (Voice Mode CC 40, Scale CC 41) — named-option selectors.
  For bands we transmit the **middle** of each band to avoid the chart's
  overlapping Voice Mode boundaries (Unison Ring = 100, Poly Ring = 120).
- **Not controllable (shown disabled):** Resonance & Dry/Wet (no CC in the
  chart; NRPN numbers unknown — control on the hardware), and Tempo (MIDI clock,
  phase 2). We do **not** guess NRPN numbers.

## Snapshot librarian

The Phara-O has only 10 patch slots and forgets switch positions. A **snapshot**
captures the app-side value of every controllable parameter as a JSON **file**
(download / upload — no browser storage).

- **Save snapshot** — downloads `<name>.phara-o.json`.
- **Load snapshot** — reads a JSON file, updates the UI, and sends every value
  to the synth sequentially with a small gap (~8 ms) so the MIDI buffer isn't
  flooded.

## Project structure

```
src/
├── app.css                      global tokens/theme
├── lib/
│   ├── params.ts                PARAMS — single source of truth (typed)
│   ├── midi.svelte.ts           Web MIDI service (runes state, sendCC/sendBatch)
│   ├── paramState.svelte.ts     reactive parameter state; sends CC on change
│   ├── snapshot.ts              capture / download / parse / apply snapshots
│   └── components/
│       ├── MidiSetup.svelte
│       ├── ContinuousControl.svelte
│       ├── SteppedControl.svelte
│       ├── UnavailableControl.svelte
│       ├── SnapshotBar.svelte
│       └── HardwareNote.svelte
└── routes/
    ├── +layout.ts               ssr = false (Web MIDI is browser-only)
    ├── +layout.svelte
    └── +page.svelte             panel: maps over PARAMS by group
```

## Not in v1 (by design)

- No MIDI clock / tempo generation (phase 2).
- No reading state from the hardware (not possible).
- No `localStorage` / `sessionStorage`.
- No guessed NRPN numbers for Resonance / Dry-Wet.
