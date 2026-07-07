# Roadmap

Planned enhancements, ordered from quick wins to the most complex. Grounded in
the current architecture: one-way CC control (app → synth, app is authoritative),
file-based librarian (no browser storage), transport with a look-ahead scheduler,
note-source bridge for external MIDI keyboards.

## Phase 1 — quick wins

### 1.1 MIDI setup UX
- Replace the synth-view MIDI drawer with a **popover** anchored to the MIDI
  button (native popover API): closes on outside click / Esc, no longer pushes
  the faceplate down. Keep the current auto-open panel while not connected
  (first-run onboarding stays).
- **Two status LEDs** in the header: OUT (synth port) and IN (keyboard), port
  names in tooltips.
- **Hot-plug hint**: `onstatechange` already fires on new devices — when a new
  *input* port appears, show a one-click toast “MIDI keyboard detected — use as
  input?” (we still never auto-select an input silently; notes must not start
  flowing without consent).

### 1.2 Native save dialog
- Use `showSaveFilePicker({ suggestedName, id: 'patches' | 'patterns' })` in
  `files.ts` instead of the forced download. The `id` option makes Chrome
  remember the last directory per file kind **without any storage on our side**
  (keeps the no-browser-storage principle). Feature-detect, fall back to the
  current download.

### 1.3 Init button
- Promote the Init factory patch to a dedicated **Init** button in both
  librarian UIs; remove it from the Factory dropdown. Single source of truth:
  export the patch object as `INIT_PATCH` from `factoryPatches.ts` and have the
  button apply it via `applySnapshotWithReport`.

### 1.4 Sequencer swing
- The arp has swing, the sequencer doesn't — port the same delayed-every-2nd-step
  logic over.

## Phase 2 — small features

### 2.1 Mutate button
- **Mutate** = small random offsets (±amount) around the current patch, with
  audibility guardrails (clamp so cutoff/env-mod and sustain/decay can’t all
  land at silence). Implement as `mutatePatch(base, amount)` so a full
  **Randomize** later is just the same function with `amount = full` — decision
  deferred, Mutate ships first.

### 2.2 Mod wheel (CC 1)
- Re-enable CC 1 as a **performance control**, not a patch parameter: vertical
  wheel next to the on-screen keyboard, NOT saved in snapshots (answers the
  open question that got it commented out in `params.ts`).
- Forward incoming CC 1 from the selected MIDI input (the note bridge currently
  drops all non-note messages), so a hardware mod wheel works through the app.

### 2.3 Patch sharing via URL
- Encode a snapshot into the URL hash (`#p=…`, base64 of the JSON, tens of
  bytes); on load, offer “Load shared patch”. Zero storage, zero backend.

### 2.4 PWA
- Web manifest + service worker (`@vite-pwa/sveltekit`): installable as a
  desktop app, works offline. Chosen over a packaged .exe for now — Tauri’s
  Linux webview (WebKitGTK) lacks Web MIDI and Electron is heavyweight; a PWA
  in Chrome gives the desktop-app feel with full Web MIDI. Revisit packaging
  only if a real binary is ever needed (Electron would be the safe choice).

## Phase 3 — medium features

### 3.1 Sequencer: chords, ties, parameter locks (format v2)
- **Chords per step**: `note: number` → `notes: number[]`; step recording
  accumulates simultaneously held keys. Uses the synth’s paraphony.
- **Ties**: a note sustained across steps (matters for the envelope).
- **Parameter locks**: per-step CC automation lanes (Elektron style) — e.g.
  VCF Cutoff stepped per pattern step. The app is both the sequencer and the
  only CC sender, so it’s uniquely placed for this. Needs a “reset lane” rule:
  after locked steps play, re-send the panel value so the one-way state doesn’t
  drift from the UI.
- Bump `.seq` to version 2; the loader already tolerates missing fields.

### 3.2 A/B compare + undo history
- The app owns the full state, so history is cheap. A/B toggle for ear
  comparison while sound-designing — something the memory-less hardware can’t do.

### 3.3 Pitch bend wheel
- **Blocked on hardware verification**: pitch bend is not a CC (status 0xE0,
  14-bit) and is absent from the CC chart `params.ts` is built from. First test
  whether the Phara-O responds to bend at all; if yes: spring-loaded wheel next
  to the mod wheel, `sendPitchBend()` in the MIDI service, plus input
  passthrough. If not, drop the feature.

### 3.4 Bank export/import
- One `.bank` file containing N patches — backup and sharing of a whole
  collection.

## Phase 4 — larger features

### 4.1 MIDI learn / CC bridge
- External controllers currently bypass the app’s authoritative state. Bridge
  them like the note input: receive CC on the selected input, update the UI
  state, forward to the synth. “MIDI learn” pairing: click a UI knob, move a
  hardware knob, bound.

### 4.2 Folder-based patch librarian
- `showDirectoryPicker` once → in-app list of all `.snp` files in the folder,
  one-click load, save into it. Persisting the folder handle across sessions
  requires IndexedDB (a deliberate, minimal exception to the no-storage rule —
  a pointer to a folder, not patch data).

### 4.3 External clock sync (slave mode)
- Follow incoming MIDI clock + Start/Stop on the input port so the sequencer
  and arp lock to a DAW/groovebox. The transport is currently master-only.

### 4.4 Patch morph
- Crossfade slider between two snapshots: continuous params interpolate and
  stream as CC, stepped params switch at the midpoint.

## Decided / rejected

- **Multi-track sequencer**: reframed — true multi-track (multiple channels)
  targets multiple instruments; this app drives one synth. Chords + parameter
  locks (3.1) capture the actual value.
- **Randomize button**: deferred in favour of Mutate (2.1); full randomize too
  often lands on silence. The shared `amount` design keeps the door open.
- **Init as a factory patch**: replaced by the Init button (1.3).
