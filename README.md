# Phara-O Mini — Web MIDI Editor · Librarian · Sequencer

A browser app to control the **Behringer Phara-O Mini** synthesizer over the
**Web MIDI API**. No backend, no Electron. The synth has no display, so the
whole point of this app is to **show you the numeric value** of every parameter
as you change it — and, beyond editing, to **play, record and sequence** the
synth from the computer.

> **Status: beta (0.3.x).** Core editor, snapshot librarian, MIDI-clock
> transport, a monophonic step sequencer, note sources (on-screen keyboard +
> MIDI input) and step/live recording are working. More is planned — see
> [Roadmap](#roadmap).

## Design premise (read this)

The app is **one-way to the synth: app → synth**. The hardware has no encoders
and no SysEx state dump, so the app **cannot read the physical knob positions**.
For every parameter it controls, the app is authoritative: you set a value in the
UI, the UI displays it and sends it as a MIDI CC (or a MIDI note, for the
sequencer). If a physical knob and the app value drift apart, that's expected —
not a bug.

MIDI **input** exists only as a *note source*: an external keyboard plays
*through the app* to the synth (and can record into the sequencer). That is a
controller feeding the app — still not reading the synth's own state. A keyboard
wired **directly** into the synth bypasses the app entirely (by design).

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
The output port whose name contains `PHARA-O` is auto-selected (marked ★); the
ALSA "Midi Through" port is filtered out.

### Make the synth actually listen

Set these on the hardware (most are power-on options — hold the key while
powering up; see the manual):

- **MIDI Rx = ON** (FUNC + key 13) — required for the synth to receive CC **and**
  the sequencer's notes.
- Match the **MIDI channel** in the app to the synth's channel (default 1).
- **Optional — slave the synth's tempo:** Clock Source = USB MIDI (FUNC + key 7)
  **and** 24 ppqn (FUNC + key 11). Only needed if you want the synth's *own*
  sequencer/arp/tempo-delay to follow the app's clock. The app's step sequencer
  does **not** need this — it sends notes itself.

## What it controls

Parameter data comes from the official MIDI implementation chart and lives in one
typed config, [`src/lib/params.ts`](src/lib/params.ts) — the single source of
truth. The UI panel is just a map over it.

- **13 continuous CC params** (0–127) — sliders with a big live value readout.
- **Stepped params** (Voice Mode CC 40, Scale CC 41) — named-option selectors.
  For bands we transmit the **middle** of each band to avoid the chart's
  overlapping Voice Mode boundaries (Unison Ring = 100, Poly Ring = 120).
- **Not MIDI-controllable (shown disabled):** Volume, Resonance and Dry/Wet —
  they are absent from the CC chart and there is no NRPN for them either, so they
  must be set on the hardware. We do **not** guess MIDI numbers.

## Transport (MIDI clock master)

A **look-ahead scheduler** emits MIDI Start/Stop + 24-PPQN clock so the synth (in
USB-clock mode) can slave its tempo to the computer. Tempo 20–300 BPM. The same
scheduler drives the step sequencer, so future arp/sequencer features attach to
it as clock consumers rather than spinning their own timers.

## Note sources (keyboard + MIDI input)

The app can also be **played** as an instrument, acting as a software MIDI
bridge (`note source → app → synth`). Two sources feed the same layer:

- **On-screen keyboard** — two octaves, mouse (click / glissando) or **QWERTY**
  computer keys (`A`–`L` / `W`–`P` rows, `z`/`x` shift octave), with an octave
  shift and a velocity slider (the synth *does* respond to velocity).
- **MIDI input** — pick an input port in MIDI Setup; an external keyboard plays
  straight through to the synth and lights up the on-screen keys. Output is
  always forced onto the app's selected synth channel.

A **Panic** button sends All Notes Off if anything hangs.

## Step sequencer

A **monophonic** step sequencer that plays the synth by sending MIDI notes timed
off the transport clock — so it works **regardless of the synth's clock source**
(it only needs MIDI Rx = ON).

- 16 steps, adjustable pattern length, rate 1/8 · 1/16 · 1/32.
- Per step: note, velocity and gate length. Velocity is a real **enhancement** —
  the synth's own touch keyboard isn't velocity-sensitive.
- Live playhead; "Send notes" enable; save/load patterns as `.seq` files.
- **Recording from a note source** (keyboard or MIDI input), armed with the
  **Record** button:
  - **Step** — play a note to fill the cursor step and advance; `←`/`→` (or the
    arrow keys) move the cursor without erasing; click a pad to place the cursor.
    No running clock needed.
  - **Live** — with the transport playing, played notes quantize to the nearest
    step and how long you hold a note sets its gate.

Polyphony and per-step parameter locks are planned.

## Librarian & factory patches

The Phara-O has only 10 patch slots and forgets switch positions, so an app-side
library is effectively unlimited. Patches are **files** (download / upload — no
browser storage).

- **Save / Load patch** — JSON files with a `.snp` extension.
- **10 factory patches** built in (Classic Bass, Sub Bass, Saw Lead, Soft Pad,
  Pluck Keys, Brass Stab, Fifth Lead, Octave Stack, Ring Bell, LFO Sweep) — one
  click applies them (Resonance/Dry-Wet excepted, as those have no CC).

Loading a patch sends every value to the synth sequentially with a small gap
(~8 ms) so the MIDI buffer isn't flooded. Patch (`.snp`) and pattern (`.seq`)
files are distinguished by an internal `format` field, with a friendly error if
you load one where the other belongs.

## Project structure

```
src/
├── app.css                      global tokens/theme
├── lib/
│   ├── params.ts                PARAMS — single source of truth (typed)
│   ├── midi.svelte.ts           Web MIDI service (CC, notes, clock, in + out)
│   ├── paramState.svelte.ts     reactive parameter state; sends CC on change
│   ├── transport.svelte.ts      MIDI clock master + look-ahead tick scheduler
│   ├── noteSource.svelte.ts     held-notes layer (keyboard + MIDI in → synth)
│   ├── sequencer.svelte.ts      monophonic step sequencer + step/live recording
│   ├── snapshot.ts              capture / download / parse / apply patches
│   ├── factoryPatches.ts        10 built-in starter patches
│   └── components/
│       ├── MidiSetup.svelte
│       ├── ContinuousControl.svelte
│       ├── SteppedControl.svelte
│       ├── UnavailableControl.svelte
│       ├── TransportControl.svelte
│       ├── Keyboard.svelte              on-screen piano (mouse + QWERTY)
│       ├── NoteSourceControl.svelte     note sources panel (thru + panic)
│       ├── SequencerControl.svelte
│       ├── SnapshotBar.svelte
│       └── HardwareNote.svelte  (currently unused; earmarked for a Help section)
└── routes/
    ├── +layout.ts               ssr = false (Web MIDI is browser-only)
    ├── +layout.svelte
    └── +page.svelte             the panel + transport + sequencer + librarian
```

## By design / not (yet) supported

- **No reading state from the hardware** — not possible (one-way).
- **No `localStorage` / `sessionStorage`** — patches and patterns are files.
- **No guessed NRPN/SysEx numbers** — if it isn't documented, we don't send it.
- The Behringer manual PDF is **not** included in this repo (it's copyrighted).

## Roadmap

- **In-app arpeggiator** — consumes the held notes from the note sources, synced
  to the transport clock (next up).
- Alternative **"Synth UI"** (graphical, knob-style) with a toggle to the current
  parametric view.
- **Polyphonic** steps, **parameter locks**, swing, accents, pattern chaining.
- Live **clock-source switching over SysEx** (once the SynthTribe message is
  captured), to avoid the hardware's power-on reboot.

### Done since 0.2.x

- On-screen keyboard + MIDI input note sources (play the synth / bridge an
  external controller).
- Step and live **recording** into the sequencer.

## License

[MIT](LICENSE) © 2026 Vlastimil Červený.

This project is not affiliated with or endorsed by Behringer / Music Tribe.
"Phara-O Mini" is a trademark of its respective owner.
