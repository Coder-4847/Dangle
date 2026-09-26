# Dangle

2D physics co-op platformer (browser, Canvas 2D, Matter.js). A blobby head with two stretchy arms: grab, swing, heave, fling. Inspired by the *formula* of Heave Ho; **no reuse** of its name, art, audio or characters.
Modes: Solo + local Co-op (2 players). 10 campaigns per mode: campaigns 1-5 = 5 levels, 6-10 = 10 levels (75/mode, 150 total). Fully offline static site, no build step.

Full spec: `docs/MASTER_PROMPT.md` (read only the section for the current phase; grep/offset, never the whole file).
Progress log: `PROGRESS.md`. Reference art (mood only, gitignored): `reference/`.

## Folder map
```
index.html  css/style.css
js/lib/matter.min.js      vendored physics (offline)
js/config.js              ALL tuning constants (Dangle.config)
js/core/    loop input camera characters(data: 6 characters, glove colours) (later: audio storage)
js/physics/ world player grab surfaces hazards(rules: death/respawn, tides, goal, wind, trampolines)
js/levels/  builder segments levels(registry+compile) themes loader(load/unload) test-levels sandbox
js/render/  crayon(wobble, grain, sprites) level-layer(pre-rendered static tiles, far layer) scenery characters(head/glove sprites)
            draw-world(movers, crates, ropes) draw-level(flags, liquids, darkness) draw-player particles(Fx + shake)
js/ui/      tuning debug hud (later: menus)
js/dev/     stress (physics stress scenarios) stress-ui (?stress=1 table, ?stress=<name> live)
js/game.js                entry point
tools/sim-test.js         headless stress run: node tools/sim-test.js [scenario]  (must stay all-PASS)
tools/energy-probe.js     which part of the step adds/removes energy in a scenario
tools/check-all.js        runs ALL checks below; must stay green (run before every commit)
tools/lint-levels.js      level linter (--selftest guards the linter)   tools/level-smoke.js  load/finish/respawn/unload/20 restarts
tools/gap-bots.js         scripted players prove the lint gap limits    tools/camera-test.js  camera maths
tools/serve.py            no-cache dev server (preview uses it; plain http.server caches stale JS)
```

## Conventions
- Vanilla JS, classic `<script>` tags in order, one global namespace `Dangle` (NO ES modules: must work by double-clicking index.html).
- Files small (~400 lines max), clear names, short comments explaining *why*. No frameworks, no npm runtime deps.
- Tunable numbers only in `js/config.js`. Level distances relative to `config.REACH`.
- Deterministic levels: seeded PRNG only. No per-frame allocations in hot loops. localStorage always in try/catch.
- Dev flags: `?dev=1` (unlock all, debug overlay, `L` next level, `R` restart), backtick toggles debug overlay.

## Physics rules (Phase 2, see PROGRESS.md for why)
- Matter friction is OFF for players (warm-started = viscous). Heads/hands use `Player.floorFriction` (floors only).
- Head body never rotates (infinite inertia); face tilt is cosmetic (`p.tilt`).
- Arm length limit = one-sided `maxOnly` constraint inside Matter's solver (patched in world.js).
- Every arm force has an equal/opposite reaction on the head. Never add one-sided forces to players.
- Art is read-only: render code never writes physics state (cosmetic state lives in render-side WeakMaps).
- Levels are data: segments (js/levels/segments.js) -> spec (plain JSON) -> loader -> world. New segment = add fn + lint rule + smoke coverage. Distances in REACH units.
- Editing files with python on this machine: always `io.open(..., encoding='utf-8')` (default is cp1252).

## Quality bar
Physics feel is the product: reliable grabs, weighty but predictable swings, no jitter/NaN/tunneling. Fixed timestep (1/120) + accumulator + render interpolation, identical at 60/120/144 Hz. Stable 60 fps, zero console errors, clean level load/unload, crisp on high-DPI, correct on resize, auto-pause on blur. Restrained flat visuals.

## Working protocol
- Start of phase: read CLAUDE.md + PROGRESS.md + only the current phase section. Check the model matches the phase tag; if not, stop and tell the user: "This phase needs <model>. Please run /model, switch, and say 'Start Phase N' again."
- End of phase: verify Definition of Done, update PROGRESS.md, local commit `Phase N: <name>`, print the PHASE COMPLETE block (format in MASTER_PROMPT section 3), then STOP and wait. Never start the next phase unprompted. Fix reported bugs within the current phase.
- NEVER push to GitHub before Phase 11 and explicit user confirmation.
- Token discipline: short messages, targeted edits, no re-reading files just written, stay in scope, verify with small scripts / debug overlay.

## Phases (model)
0 Setup (Sonnet 5) · 1 Physics sandbox (Sonnet 5) · 2 Physics hardening (**Opus 5.5**) · 3 Level engine (Sonnet 5) · 4 Art + characters (**Opus 5.5**, user override) · 5 Menus/saves/HUD · 6 Solo camp. 1-5 · 7 Solo camp. 6-10 · 8 Co-op + camp. 1-5 (**Opus 5.5**, user override) · 9 Co-op camp. 6-10 · 10 Audio/juice/QA (5,6,7,9,10: Sonnet 5) · gate: user confirms · 11 Final refine + GitHub (**Opus 5.5**)
