# Phara-O Mini — Web MIDI Editor · Librarian · Sequencer

A browser app to control the **Behringer Phara-O Mini** synthesizer over the
**Web MIDI API**. No backend, no Electron. The synth has no display, so the
whole point of this app is to **show you the numeric value** of every parameter
as you change it — and, beyond editing, to **play, record and sequence** the
synth from the computer.

It has two interchangeable faces: a **Synth view** (a one-screen faceplate with
knobs, the default) and a **Parametric view** (labelled sliders with big numeric
readouts). Same state underneath — a toggle in the header switches them.

> **Status: beta (0.6.x).** Two UIs (synth-style + parametric), snapshot
> librarian (Init / **Mutate** / factory patches, native file dialogs), a
> monophonic step sequencer with step/live recording and **swing**, an
> **arpeggiator**, note sources (on-screen keyboard + MIDI input with hot-plug
> detection), and **Scale-footage transpose**. More is planned — see
> [ROADMAP.md](ROADMAP.md).

## Design premise (read this)

The app is **one-way to the synth: app → synth**. The hardware has no encoders
and no SysEx state dump, so the app **cannot read the physical knob positions**.
For every parameter it controls, the app is authoritative: you set a value in the
UI, the UI displays it and sends it as a MIDI CC (or a MIDI note, for the
sequencer). If a physical knob and the app value drift apart, that's expected —
not a bug.

MIDI **input** exists only as a *note source*: an external keyboard plays
*through the app* to the synth (and can record into the sequencer or drive the
arpeggiator). That is a
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
ALSA "Midi Through" port is filtered out. Once connected, the setup lives in a
**popover under the MIDI button** (synth view) and the header shows **Out / In
status LEDs**. Plugging in a MIDI keyboard later pops a one-click *"use as MIDI
in?"* toast — an input is never selected silently.

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

## Two UIs (synth ⇄ parametric)

A toggle in the header switches between two complete views of the same state
(session-only; the app stores nothing in the browser):

- **Synth** *(default)* — a single-screen "faceplate": knobs laid out roughly
  like the hardware panel (VCO · VCF · Mode on top; LFO · EG · Delay below —
  Scale folded into VCO), a compact patch bar and MIDI drawer in the header, a
  control strip for the sequencer/arp, and the keyboard closing the page.
  Knobs take a vertical drag (Shift = fine), the mouse wheel, or arrow keys, and
  still show the numeric value underneath. It deliberately does **not** copy the
  hardware's appearance — only the coarse control placement.
- **Parametric** — the original labelled sliders + big numeric readouts, stacked
  section by section. Best when you want to read/type exact values.

## What it controls

Parameter data comes from the official MIDI implementation chart and lives in one
typed config, [`src/lib/params.ts`](src/lib/params.ts) — the single source of
truth. Both UIs are just a map over it.

- **13 continuous CC params** (0–127) — sliders / knobs with a live value readout.
- **Stepped params** (Voice Mode CC 40, Scale CC 41) — named-option selectors
  (segmented in parametric, detented knobs in synth). For bands we transmit the
  **middle** of each band to avoid the chart's overlapping Voice Mode boundaries
  (Unison Ring = 100, Poly Ring = 120).
- **Not MIDI-controllable (shown disabled):** Volume, Resonance and Dry/Wet —
  they are absent from the CC chart and there is no NRPN for them either, so they
  must be set on the hardware. We do **not** guess MIDI numbers.

### Scale (footage) transpose

On the hardware, **Scale** shifts the register of the synth's *own* touch
keyboard — but MIDI notes carry absolute pitch, so on their own they'd ignore
it. The app emulates the footage: every outgoing note is transposed one octave
per Scale step, with **8' as the reference** (no shift), so the on-screen
keyboard, MIDI input, arp and sequencer all follow Scale the way the hardware
keys do. CC 41 is still sent as well, keeping the synth's own keys in the same
register. Note-offs always release the pitch that actually sounded, so changing
Scale mid-note never leaves a note hanging.

## Tempo & clock (no play button)

There is **one app-wide tempo** (20–300 BPM, a card in the Global row) and **no
user-facing clock control** — just like the hardware, whose clock has no stop
button either. The clock runs for exactly as long as a note generator (the
sequencer or the arp) is playing; each of those has its own Play/On button in
its panel. While something plays, a **look-ahead scheduler** emits MIDI
Start/Stop + 24-PPQN clock so the synth (in USB-clock mode) can slave its tempo
to the computer. The same scheduler times the sequencer's and the arp's notes,
so their timing doesn't depend on JS timer precision.

The sequencer and the arpeggiator are **mutually exclusive** (both write notes
for one voice): turning one on stops the other.

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

- Its own **▶ Play / ■ Stop** in the panel; playing always starts from step 1.
- 16 steps, adjustable pattern length, rate 1/8 · 1/16 · 1/32, **swing**
  (same shuffle feel as the arp's; stored in `.seq` files).
- Per step: note, velocity and gate length. Velocity is a real **enhancement** —
  the synth's own touch keyboard isn't velocity-sensitive.
- Live playhead; save/load patterns as `.seq` files. The grid is always editable
  by mouse — Record only gates what you *play*.
- **Recording from a note source** (keyboard or MIDI input), armed with the
  **Record** button:
  - **Step** — play a note to fill the cursor step and advance; `←`/`→` (or the
    arrow keys) move the cursor without erasing; click a pad to place the cursor.
    No running clock needed.
  - **Live** — with the sequencer playing, played notes quantize to the nearest
    step and how long you hold a note sets its gate.

Polyphony and per-step parameter locks are planned.

## Arpeggiator

A classic arp over the **held notes** (on-screen keyboard or MIDI input): turn
it **On**, hold a chord, and it plays the notes one at a time in tempo —
starting immediately, no play button. While it's on, held keys are *owned* by
the arp (they don't also sound directly, so nothing doubles).

- **Modes:** Up · Down · Up/Down · Down/Up · As played · Random.
- **Rate** 1/4 · 1/8 · 1/8T · 1/16 · 1/32, octave range 1–4, **gate** length.
- **Latch** — keeps playing after you release; a fresh press replaces the set.
- **Swing**, and **velocity modes**: as played / fixed / accent on the beat.

## Librarian & factory patches

The Phara-O has only 10 patch slots and forgets switch positions, so an app-side
library is effectively unlimited. Patches are **files** (download / upload — no
browser storage). The librarian sits right under the Global row — pick a patch
first, then tweak the parameters below.

- **Save / Load patch** — JSON files with a `.snp` extension, through the
  browser's **native file dialogs** (File System Access API). Save and Load
  share one remembered directory per file kind — no browser storage on our
  side; plain download/upload is the fallback outside Chromium.
- **Init** button — a neutral one-click starting point (poly, filter open, full
  sustain, no effects). Since the app is one-way, this is also the quickest way
  to put the synth into a **known state** that matches the UI.
- **Mutate** button — nudges every continuous param by a small random offset
  (with guardrails so the patch never goes silent). Repeated presses compound
  into a random walk through sound space — a sound-design spark.
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
│   ├── midi.svelte.ts           Web MIDI service (CC, notes, clock, in + out; Scale transpose)
│   ├── paramState.svelte.ts     reactive parameter state; sends CC on change
│   ├── uiMode.svelte.ts         which face is showing: synth | parametric
│   ├── transport.svelte.ts      MIDI clock + look-ahead tick scheduler (internal)
│   ├── noteGenerator.svelte.ts  which generator plays: off | sequencer | arp
│   ├── noteSource.svelte.ts     held-notes layer (keyboard + MIDI in → synth)
│   ├── sequencer.svelte.ts      monophonic step sequencer + step/live recording
│   ├── arp.svelte.ts            arpeggiator (modes, octaves, latch, swing)
│   ├── snapshot.ts              capture / save / parse / apply patches
│   ├── factoryPatches.ts        INIT_PATCH + 10 built-in starter patches
│   ├── mutate.ts                Mutate — random param nudges with guardrails
│   ├── files.ts                 shared file plumbing (native pickers + fallback)
│   └── components/
│       ├── SynthView.svelte             faceplate view (knobs + strip + keys)
│       ├── Knob.svelte                  rotary knob (drag / wheel / keys)
│       ├── MidiSetup.svelte
│       ├── ContinuousControl.svelte     parametric slider
│       ├── SteppedControl.svelte
│       ├── UnavailableControl.svelte
│       ├── TempoControl.svelte          app-wide tempo card (Global row)
│       ├── Keyboard.svelte              on-screen piano (mouse + QWERTY)
│       ├── NoteSourceControl.svelte     note sources panel (thru + panic)
│       ├── SequencerControl.svelte
│       ├── ArpControl.svelte
│       ├── SnapshotBar.svelte
│       ├── MidiInputToast.svelte        hot-plugged-keyboard offer (both views)
│       └── HardwareNote.svelte  (currently unused; earmarked for a Help section)
└── routes/
    ├── +layout.ts               ssr = false (Web MIDI is browser-only)
    ├── +layout.svelte
    └── +page.svelte             synth view, or parametric: globals → librarian → params → seq → arp → keys
```

## By design / not (yet) supported

- **No reading state from the hardware** — not possible (one-way).
- **No `localStorage` / `sessionStorage`** — patches and patterns are files.
- **No guessed NRPN/SysEx numbers** — if it isn't documented, we don't send it.
- The Behringer manual PDF is **not** included in this repo (it's copyrighted).

## Roadmap

The full, phased plan lives in [ROADMAP.md](ROADMAP.md). Highlights:

- **Phase 2:** Mutate follow-ups, **mod wheel** (CC 1) as a performance control,
  patch sharing via URL, **PWA** (installable / offline).
- **Phase 3:** sequencer v2 — **chords per step, ties, parameter locks**
  (per-step CC automation lanes); A/B compare + undo; pitch bend (pending
  hardware verification).
- **Phase 4:** MIDI learn / CC bridge for external controllers, folder-based
  patch librarian, external clock sync, patch morph.
- Longer-standing ideas: reconcile the keyboard's **octave shift** with the
  Scale transpose display; live **clock-source switching over SysEx** (once the
  SynthTribe message is captured).

### Done since 0.5.x

- **MIDI setup UX** — anchored popover (light-dismiss), Out/In status LEDs,
  one-click toast when a MIDI keyboard is hot-plugged.
- **Native file dialogs** — Save *and* Load share one remembered directory per
  file kind (patches / patterns).
- **Init** and **Mutate** buttons in both librarian UIs (Init left the factory
  bank and became a button).
- **Sequencer swing**, stored in `.seq` files.
- Readability polish: lighter faint text (hardware-only params deliberately
  stay dim), arp strip sliders show values, flash messages no longer reflow
  the faceplate.

### Done since 0.4.x

- **Synth view** — a one-screen knob faceplate, default UI, with a header toggle
  to the parametric view.
- **Scale-footage transpose** — the app keyboard, MIDI input, arp and sequencer
  now follow the Scale switch like the hardware keys (8' reference).

### Done since 0.3.x

- **Arpeggiator** (modes, rate, octaves, gate, latch, swing, velocity/accent).
- **Transport redesign** — no global play button; tempo is a Global-row card and
  the sequencer/arp each start themselves (mutually exclusive, like one voice).
- **Init factory patch** + the librarian moved up, keyboard now closes the page.

### Done since 0.2.x

- On-screen keyboard + MIDI input note sources (play the synth / bridge an
  external controller).
- Step and live **recording** into the sequencer.

## License

[MIT](LICENSE) © 2026 Vlastimil Červený.

This project is not affiliated with or endorsed by Behringer / Music Tribe.
"Phara-O Mini" is a trademark of its respective owner.
