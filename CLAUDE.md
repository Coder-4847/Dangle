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
js/core/    loop input camera (later: audio storage)
js/physics/ world player grab surfaces (later: hazards)
js/levels/  sandbox (later: segments themes campaigns loader)
js/render/  draw-world draw-player (later: crayon particles)
js/ui/      tuning debug (later: menus hud)
js/game.js                entry point
tools/sim-test.js         headless physics checks: node tools/sim-test.js [scenario]
tools/lint-levels.js      node level linter (Phase 3)
docs/  reference/
```

## Conventions
- Vanilla JS, classic `<script>` tags in order, one global namespace `Dangle` (NO ES modules: must work by double-clicking index.html).
- Files small (~400 lines max), clear names, short comments explaining *why*. No frameworks, no npm runtime deps.
- Tunable numbers only in `js/config.js`. Level distances relative to `config.REACH`.
- Deterministic levels: seeded PRNG only. No per-frame allocations in hot loops. localStorage always in try/catch.
- Dev flags: `?dev=1` (unlock all, debug overlay, `L` next level, `R` restart), backtick toggles debug overlay.

## Quality bar
Physics feel is the product: reliable grabs, weighty but predictable swings, no jitter/NaN/tunneling. Fixed timestep (1/120) + accumulator + render interpolation, identical at 60/120/144 Hz. Stable 60 fps, zero console errors, clean level load/unload, crisp on high-DPI, correct on resize, auto-pause on blur. Restrained flat visuals.

## Working protocol
- Start of phase: read CLAUDE.md + PROGRESS.md + only the current phase section. Check the model matches the phase tag; if not, stop and tell the user: "This phase needs <model>. Please run /model, switch, and say 'Start Phase N' again."
- End of phase: verify Definition of Done, update PROGRESS.md, local commit `Phase N: <name>`, print the PHASE COMPLETE block (format in MASTER_PROMPT section 3), then STOP and wait. Never start the next phase unprompted. Fix reported bugs within the current phase.
- NEVER push to GitHub before Phase 11 and explicit user confirmation.
- Token discipline: short messages, targeted edits, no re-reading files just written, stay in scope, verify with small scripts / debug overlay.

## Phases
| # | Name | Model |
|---|---|---|
| 0 | Project setup | Sonnet 5 |
| 1 | Physics sandbox | Sonnet 5 |
| 2 | Physics hardening and tuning gate | Opus 5.5 |
| 3 | Level engine | Sonnet 5 |
| 4 | Art style and characters | Sonnet 5 |
| 5 | Menus, modes, saves, HUD | Sonnet 5 |
| 6 | Solo campaigns 1-5 (25 levels) | Sonnet 5 |
| 7 | Solo campaigns 6-10 (50 levels) | Sonnet 5 |
| 8 | Co-op mode + campaigns 1-5 (25) | Sonnet 5 |
| 9 | Co-op campaigns 6-10 (50) | Sonnet 5 |
| 10 | Audio, juice, full QA | Sonnet 5 |
| gate | User confirms the game works | - |
| 11 | Final refine + GitHub | Opus 5.5 |
