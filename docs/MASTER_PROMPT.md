# DANGLE — Master Prompt for Claude Code

> **How to use:** put this file in an empty project folder, open Claude Code there, select **Sonnet 5** (`/model`), and say:
> **"Read DANGLE_MASTER_PROMPT.md and start Phase 0."**
> Upload the Heave Ho reference images into the project folder (`/reference/`) before Phase 4.

---

## 1. Project brief

You are building **Dangle**, a 2D physics co-op platformer for the browser, inspired by the *formula* of Heave Ho: a blobby head with two stretchy arms, where you grab surfaces and swing, heave and fling yourself (and your friend) to the goal.

- **Two modes, both fully local, no servers, no online features, works offline:**
  1. **Solo**: 1 player.
  2. **Co-op**: 2 players on one screen (shared keyboard and/or gamepads).
- **Each mode has 10 campaigns.** Campaigns 1–5 have **5 levels each**. Campaigns 6–10 have **10 levels each**. That is **75 levels per mode, 150 total**.
- Solo levels must be solvable by one player. Co-op levels must *require* two players cooperating.
- Delivered as a static site (plain HTML/CSS/JS, no build step) that can be deployed to GitHub Pages.

**Originality rule:** take inspiration from the formula and the attached reference images only. Do NOT reuse Heave Ho's name, logo, lettering, character names or designs, music, or any ripped assets. All art, names, and sounds in Dangle are original.

---

## 2. Quality bar (applies to every phase)

Everything must feel **refined and smooth**. The physics must be **on point**. Concretely:

- **Physics feel is the product.** Grabbing must be reliable (never "I clearly touched it and it didn't grab"). Swinging must feel weighty but predictable: when the player dies it should feel like their fault, not the engine's.
- **No jitter, no explosions, no tunneling, no NaN.** Constraints never vibrate or fling players randomly. Guard against bad states (out-of-bounds, NaN, extreme velocity) and recover gracefully.
- **Frame-rate independent.** Fixed physics timestep with an accumulator and render interpolation. Identical feel at 60, 120 and 144 Hz.
- **Stable 60 fps** on a modest laptop. Pre-render static level geometry to an offscreen canvas; no per-frame allocations in hot loops.
- **Zero console errors.** Levels load and unload cleanly (no leaked bodies, listeners or timers).
- **Polish everywhere:** smooth camera, eased UI transitions, no visual pops, crisp rendering on high-DPI screens, correct on window resize, auto-pause when the tab loses focus.
- **Restrained, clean visuals** (see section 7): flat colors, limited palette, minimal UI, nothing cluttered.
- **Simple, readable code:** small files (aim under ~400 lines each), clear names, short comments explaining *why*. No frameworks. Easy for a beginner to follow.

---

## 3. Working protocol (follow exactly)

**Models.** Each phase below is tagged **MODEL: Sonnet 5** or **MODEL: Opus 5.5**. Opus 5.5 is used only in Phase 2 (physics hardening) and Phase 11 (final refine and GitHub). Everything else is Sonnet 5.

**At the START of every phase:**
1. Read `CLAUDE.md` and `PROGRESS.md`, then read **only the section for the current phase** in `docs/MASTER_PROMPT.md` (use grep or offset; do not re-read the whole file).
2. Check which model you are running. If it does not match the phase's tag, **stop** and tell the user: *"This phase needs <model>. Please run /model, switch, and say 'Start Phase N' again."* Do nothing else.

**At the END of every phase**, after verifying the phase's Definition of Done:
1. Update `PROGRESS.md` (what was built, what was tuned, known issues, exact constants that changed).
2. Make a **local git commit** (`Phase N: <name>`). **Never push to GitHub before Phase 11 and the user's explicit confirmation.**
3. Print this block and then **stop and wait**:

```
============================================================
PHASE <N> COMPLETE: <name>
PLAYTEST: <3-5 specific things for the user to try>
KNOWN ISSUES: <short list or "none">
NEXT: Phase <N+1>: <name>
MODEL TO USE: <Sonnet 5 | Opus 5.5>   (switch with /model if needed)
THEN SAY: "Start Phase <N+1>"   (optional: /clear first, progress is saved in PROGRESS.md)
============================================================
```

4. Do **not** start the next phase until the user says so. If the user reports bugs or feel problems, fix them within the current phase first.

**Token discipline (important):**
- Keep messages short: state what you are doing, do it, report the result. No long recaps.
- Never print whole files back. Use targeted edits. Do not re-read files you just wrote.
- Keep all tunable numbers in `js/config.js` so tuning is one small edit.
- Build levels from **reusable segments and helpers** (section 5.5), not by hand-writing raw geometry for every level.
- Stay strictly in scope for the current phase. No speculative extras.
- Prefer verifying with small scripts and the in-game debug overlay over long manual explanations.

**Dev conveniences (build these early, keep them working):**
- URL flag `?dev=1`: unlocks all campaigns and levels, shows the debug overlay, enables `L` = jump to next level, `R` = restart level.
- Debug overlay toggled with the backtick key: FPS, physics step time, body and constraint counts, per-player grab state.

---

## 4. Tech and architecture

- **Vanilla JS + HTML5 Canvas 2D.** No build step, no bundler, no npm runtime dependencies.
- **Physics: Matter.js**, vendored locally at `js/lib/matter.min.js` (download it once during Phase 0 so the game runs fully offline). *Only if Phase 2 (Opus) proves Matter.js inadequate* may it be replaced by a small custom solver, and it must justify that in `PROGRESS.md`.
- Use **classic `<script>` tags loaded in order** and one global namespace (`Dangle`), NOT ES modules, so the game also works by double-clicking `index.html` (modules fail on `file://`).
- Persistence via `localStorage` (settings, unlocked campaigns, best times), wrapped in try/catch.
- Audio via **Web Audio API, fully synthesized** (no audio files). Needs a user gesture to start.

**Suggested layout** (adjust if there is a good reason, keep it flat and simple):

```
index.html
css/style.css
js/lib/matter.min.js
js/config.js              all tuning constants
js/core/    loop.js input.js audio.js storage.js camera.js
js/physics/ world.js player.js grab.js surfaces.js hazards.js
js/levels/  segments.js themes.js solo-campaigns.js coop-campaigns.js loader.js
js/render/  crayon.js draw-player.js draw-level.js particles.js
js/ui/      menus.js hud.js
js/game.js
tools/lint-levels.js      (run with node)
docs/MASTER_PROMPT.md  CLAUDE.md  PROGRESS.md  README.md
reference/                (user's reference images)
```

---

## 5. Game design spec

### 5.1 Core research summary (what makes the original work)
- Each character is just a **head with two stretchy arms**. One stick aims **both arms in the same direction**; two buttons/triggers make the **left and right hand grab** independently. Nothing else.
- You grab terrain, ropes, objects, and **other players**, so friends can chain together to bridge gaps or fling each other.
- The physics is intentionally a bit floppy, but **consistent**, which is what makes failures feel funny instead of unfair.
- Levels are short physics puzzles with **checkpoints**, themed gimmicks (vines, dark caves lit only nearby, ice, water) and **no text tutorials**: the level design teaches.
- Hazards and gimmicks are introduced one at a time, then combined.
- Striped or marked helper beams appear to make hard sections easier.

### 5.2 Player
- **Head:** circle (start ~24 px radius), fairly heavy, small angular damping so the face tilts naturally but recovers.
- **Hands:** two small light circles (start ~11 px), **left = blue glove, right = red glove** (color-coded, always visible, and they glow slightly while gripping).
- **Arms:** each hand is tied to the head by a soft spring with a **maximum reach** (start ~120–140 px). Arms are drawn as tapered, slightly curved stretchy limbs that thin out when stretched.
- **Aim:** the stick vector sets a target point around the head; hands are driven toward it (with a slight left/right spread so they do not overlap). Neutral stick = arms relax.
- **Grab:** while a grab button is held, if the hand is touching (or within a small tolerance of) a grabbable surface, pin it with a constraint at the contact point. Release removes the constraint and **preserves momentum**.
- **Grab forgiveness (essential for feel):** input buffer (~80–100 ms: pressing just before contact still grabs) and coyote grace (~80–100 ms: releasing just after leaving contact still counts). Tolerance radius slightly bigger than the hand.
- **Heave:** with a hand pinned, pulling the stick away builds tension in the arm spring; releasing flings the head. This should come from the spring physics naturally, not from a scripted impulse.
- **Grabbing other players** (hands, head) uses the same system on dynamic bodies. It must be stable: no exploding, no infinite-energy loops.
- Head can rest on ground, roll a little, and be pushed around. Friction tuned so standing still does not slide on flat ground.
- **Options:** *Toggle-grab* (tap to grab, tap to release) as an alternative to hold-to-grab; *Assist* (bigger grab tolerance).

### 5.3 Physics engineering requirements
- Fixed timestep (start 1/120 s) with accumulator, max 5 steps per frame, and render interpolation. Clamp huge frame deltas.
- Enough solver iterations to keep chained players stable (start position iterations 8–10, velocity iterations 6–8; tune).
- Hard clamps on velocity and constraint stretch. Thick collision geometry (min ~24 px) and substeps to prevent tunneling.
- NaN/out-of-bounds guard: respawn the player at the last checkpoint with a small pop animation.
- **Live tuning panel** in the sandbox and debug mode: sliders for reach, spring stiffness, damping, head mass, hand mass, gravity, grab tolerance, friction, air drag. Include a "copy values as config" button so tuned numbers can be pasted into `config.js`.
- All numbers above are **starting points to be tuned by feel**, not final.

### 5.4 Surfaces and hazards
| Type | Behavior |
|---|---|
| Grabbable (default) | Hands stick when grab is held |
| Slick / ice | Can be grabbed, but low friction for the head |
| No-grab (dark stripe pattern) | Hands slide off; used for walls you must swing past |
| Hazard (spikes / lava / deep water) | Respawn at last checkpoint after a short delay |
| Moving platform | Kinematic, on a path; carries grabbed hands correctly |
| Rope / vine / pendulum | Grab and swing; segmented, stable |
| Trampoline / balloon | Bounce or lift |
| Wind column | Applies gentle force in a zone |
| Crate / ball | Pushable and grabbable dynamic objects |
| Rising water/lava | Timed pressure in some campaigns |
| Checkpoint flag | Sets respawn point; small flourish on activation |
| Goal (checkered flag zone) | Level complete when all players are inside |

### 5.5 Level system (token-efficient by design)
- Levels are **data**, built from **segments**: reusable, parameterized chunks (`ledge`, `gapJump`, `pendulumRow`, `verticalClimb`, `iceSlope`, `windLift`, `movingBridge`, `crateStack`, `risingTide`, ...). A level is a list of segments plus theme, direction (`right` or `up`) and difficulty scalar. Segments auto-place checkpoints between them.
- All distances are defined relative to `config.REACH`, so retuning physics does not silently break level solvability.
- Deterministic: any randomness uses a seeded PRNG. No runtime randomness in geometry.
- **`tools/lint-levels.js`** (run with `node`): checks every level has spawn, goal and checkpoints; every solo gap ≤ solo max (a fraction of reach-based swing distance); co-op-only gaps are flagged and only appear in co-op levels; nothing overlaps the spawn; level lengths are within bounds. Run it at the end of every level phase.
- Teach without text: each early level introduces one idea safely (a small failure is harmless), then later levels combine ideas.

### 5.6 Co-op specifics
- Both players must reach the goal. If one falls or dies, they **respawn after ~1.5 s** at the last checkpoint, or next to their partner if that is safer and the partner is grounded or gripping.
- Co-op-only mechanics: **chain bridges** (gap larger than one player's reach but crossable by chaining), **boost throws** (one anchors, one launches), **hold-open plates** (one holds a switch while the other passes), **two-grab heavy crates**, **counterweights** (one player anchors a rope so the other can climb).
- Camera keeps both players in frame (smooth zoom out to a clamped limit; if they separate further than the limit, gently prompt with an on-screen arrow rather than snapping).
- Two input schemes on one keyboard (see 5.7), plus gamepads.

### 5.7 Controls
- **Solo keyboard:** WASD or arrows = aim arms; `Q` = left hand grab, `E` = right hand grab. Optional mouse: pointer aims, left click / right click = left / right grab.
- **Co-op keyboard:** Player 1: `WASD` + `Q`/`E`. Player 2: `I J K L` + `U`/`O`. (Note in Settings that some keyboards limit simultaneous keys, and gamepads are recommended.)
- **Gamepad (Gamepad API):** left stick aims, left/right trigger or bumper = left/right grab. Hot-plug supported. Player 1 / Player 2 assigned in the order pads connect; co-op lets each player pick keyboard or pad.
- `Esc` or `P` = pause. `R` = restart level (with a short hold-to-confirm to avoid accidents).

---

## 6. Modes and campaign structure

Same structure for both modes. A single config array per mode defines campaigns, so reordering or renaming is trivial.

| # | Campaign | Levels | Theme and signature idea |
|---|---|---|---|
| 1 | Sunny Meadow | 5 | Learn to grab, swing, heave (safe drops) |
| 2 | Bamboo Grove | 5 | Vines, ropes, pendulums |
| 3 | Lantern Caves | 5 | Dark, light only around you; narrow swings |
| 4 | Salt Flats | 5 | Long gaps, wind columns, crates |
| 5 | Frozen Peaks | 5 | Ice, slick slopes, vertical climbs |
| 6 | Tidal Ruins | 10 | Rising water, timed sections |
| 7 | Clockwork Works | 10 | Moving platforms, gears, precise timing |
| 8 | Sky Islands | 10 | Trampolines, balloons, wind, big drops |
| 9 | Ember Depths | 10 | Lava, no-grab walls, tight routes |
| 10 | The Big Dangle | 10 | Finale: every mechanic combined |

- **Total:** 5×5 + 5×10 = **75 levels per mode** (150 overall). Co-op levels are separately designed around two-player mechanics, not copies of solo levels.
- Campaigns unlock in order (finishing a campaign unlocks the next). Levels within a campaign unlock in order. `?dev=1` unlocks everything.
- Store per level: completed flag and best time. Show a small medal or star for a clean, no-death run (optional, cheap).
- Difficulty ramps smoothly **inside** each campaign and across campaigns. Long campaigns (6–10) should feel like a step up, and each ends with a signature "boss-style" level.

---

## 7. Visual direction

Use the uploaded reference images as **mood, not assets**. Capture:
- **Warm cream background**, soft and flat.
- **Hand-drawn crayon feel:** slightly wobbly outlines, subtle grain texture, chunky rounded shapes. Achieve this cheaply with seeded path jitter and a pre-rendered grain layer, NOT expensive per-frame effects.
- **Bold, flat, limited palette** per campaign (4–5 colors plus the cream base). Restrained and cohesive, not busy or decorative. Sparse foliage/scenery accents only.
- **Characters:** blobby heads with expressive faces (eyes that look toward the nearest grabbable surface or partner; face changes on strain, fall, grab, win), chunky tapered arms, big color-coded gloves. Provide **at least 4 original character designs** (different colors and simple hats or features), selectable in the menu (co-op players pick separately).
- **UI:** minimal, no text walls. Chunky hand-drawn-style lettering for the "Dangle" title (original design, using a bundled or system font with a crayon treatment; no external font requests).
- Smooth camera, soft particles (dust on landing, sparkle on checkpoint, confetti on goal), gentle squash-and-stretch on the head. Subtle screen shake only for big impacts, and it can be disabled in Settings.

---

## 8. Phases

### PHASE 0 — Project setup
**MODEL: Sonnet 5**
- Save this file unchanged to `docs/MASTER_PROMPT.md`.
- Create `CLAUDE.md` (≤60 lines): project summary, folder map, coding conventions, the working protocol (section 3), the quality bar (section 2), and the phase table with model tags.
- Create `PROGRESS.md` (a running log, keep entries short).
- Create the folder structure, `.gitignore`, `git init`, download Matter.js into `js/lib/`.
- Create a minimal `index.html` that loads a blank canvas full-window with correct DPR scaling and a resize handler.
- **Done when:** the page opens by double-click with no console errors, canvas fills the window crisply, first commit exists.

### PHASE 1 — Physics sandbox (the heart of the game)
**MODEL: Sonnet 5**
- Build a **sandbox scene**: flat ground, a few platforms, a wall, a dangling rope, a crate, a no-grab wall. Up to **2 players** spawned from the same player factory.
- Implement: fixed-timestep loop with interpolation, input layer (keyboard schemes from 5.7 for both players, gamepad, optional mouse), player (head, hands, spring arms, max reach), grab system with buffer and coyote, release with momentum, grabbing other players, and simple stretchy-arm rendering with placeholder flat colors.
- Build the **live tuning panel** and debug overlay (section 5.3).
- Add velocity and stretch clamps, NaN guard and respawn.
- Do **not** work on menus, levels, or final art.
- **Done when:** one player can reliably climb, swing across gaps, and fling off a pinned hand; two players can grab each other and chain across a gap; no jitter at rest; feels the same at 60 and 144 Hz (test by throttling); zero console errors.

### PHASE 2 — Physics hardening and tuning gate
**MODEL: Opus 5.5** *(Use this. Every later phase builds on the physics, so getting it right here saves tokens overall. The user may skip it only if they judge the feel already excellent.)*
- Review `js/physics/*`, `core/loop.js` and `config.js` critically. Find and fix instability sources: constraint jitter, energy gain in chained players, grab failures, tunneling, solver ordering, bad mass ratios, interpolation glitches.
- Stress-test scenarios (write a small in-page test harness): both players chained and swinging, grabbing each other's heads/hands simultaneously, fast release-and-regrab, wedged against corners, on moving platforms, a long rope with a heavy crate, low-FPS spikes.
- Tune constants for a satisfying, weighty, forgiving feel. Document the final values and the reasoning in `PROGRESS.md`, and update the tuning panel defaults.
- Decide (and justify briefly) whether Matter.js stays. Default is to keep it.
- Refactor only what the physics needs. Keep code simple and commented.
- **Done when:** all stress tests stay stable, grabs feel reliable, and a reviewer would call the movement "smooth and predictable". Report the final tuned config.

### PHASE 3 — Level engine
**MODEL: Sonnet 5**
- Implement the level loader, the **segment library** (section 5.5) with theme hooks, direction support (`right`/`up`), checkpoints, goal zone, respawn flow, hazards (spikes, lava, water), moving platforms, ropes/pendulums, trampolines, wind zones, no-grab and slick surfaces, and crates.
- Implement the smooth **camera** (follow with lookahead, level bounds, co-op fit-both with clamped zoom, pan-to-goal intro).
- Implement level unload that fully cleans up bodies and listeners.
- Write `tools/lint-levels.js`.
- Build **3 throwaway test levels** (one horizontal, one vertical, one with every mechanic) to prove the system.
- **Done when:** the test levels load, finish, restart and unload cleanly, respawn works, lint passes, and 20 rapid restarts show no slowdown or leaks.

### PHASE 4 — Art style and characters
**MODEL: Sonnet 5**
- Look at `/reference/` images first.
- Implement the crayon renderer (jittered outlines, grain layer, flat fills), theme palettes for all 10 campaigns (defined in `themes.js`), pre-rendered static level layer.
- Draw the player properly: expressive faces (eyes track targets, strain/fall/win expressions), tapered stretchy arms, color-coded gloves with a grip glow, squash-and-stretch.
- Create **4+ original characters** and the selection data.
- Add particles (dust, sparkle, confetti) and clean scenery accents per theme (keep sparse).
- **Done when:** the test levels look cohesive and restrained in at least 3 different themes, hold 60 fps, and the art does not affect physics.

### PHASE 5 — Menus, modes, saves, HUD
**MODEL: Sonnet 5**
- Title screen, mode select (Solo / Co-op), campaign select (10 campaigns, lock states, progress), level select, character select (per player in co-op), settings (volume, toggle-grab, assist, reduced shake, controls reference, control-to-player assignment), pause menu, level-complete screen (time, best time, next/retry), how-to-play shown visually with a tiny interactive demo rather than text.
- Save progress and settings in `localStorage`. `?dev=1` unlock flag.
- Smooth, eased transitions between screens. Full keyboard and gamepad navigation of all menus.
- **Done when:** a player can go title → mode → campaign → level → finish → next level using only keyboard or only gamepad, progress persists after refresh, and nothing pops or flickers.

### PHASE 6 — Solo campaigns 1–5 (25 levels)
**MODEL: Sonnet 5**
- Author campaigns 1–5 in `solo-campaigns.js` using segments. **5 levels each.** Introduce mechanics gradually per section 6; every level is solvable by one player.
- Each campaign ends on a small signature level. Add a few helper beams (striped) on genuinely tough spots.
- Run `tools/lint-levels.js`. Play-test loads of every level via `?dev=1` (automated load/unload smoke test of all 25 is required).
- **Done when:** all 25 levels load, lint passes, difficulty ramps smoothly, and there are no dead-ends or unfair spawns.

### PHASE 7 — Solo campaigns 6–10 (50 levels)
**MODEL: Sonnet 5**
- Author campaigns 6–10, **10 levels each**, following section 6's themes and signature mechanics. Combine mechanics progressively; campaign 10 uses everything.
- Same lint and smoke-test requirements. Keep memory and load times flat across all 50.
- **Done when:** all 50 levels load and lint clean, difficulty is a step up from campaigns 1–5, and level 10-10 is a satisfying finale.

### PHASE 8 — Co-op mode and campaigns 1–5 (25 levels)
**MODEL: Sonnet 5**
- Finish co-op systems: two-player flow through menus, shared camera behavior, coordinated respawn, "both in goal" completion, per-player HUD tags (small colored markers), and the co-op-only mechanics from 5.6 (chain bridges, boost throws, hold-open plates, two-grab crates, counterweights).
- Author co-op campaigns 1–5, **5 levels each**, designed for two players (not solo levels with a second head added). Also confirm each level's basic path is still recoverable if one player lags behind.
- Lint and automated smoke test with two players.
- **Done when:** two people on one keyboard or two pads can finish all 25 levels comfortably, cooperation is truly required and fun, and no soft-locks exist (test: one player stuck, other player dies, both fall, etc.).

### PHASE 9 — Co-op campaigns 6–10 (50 levels)
**MODEL: Sonnet 5**
- Author co-op campaigns 6–10, **10 levels each**, ramping up teamwork complexity (longer chains, timed handoffs, split routes that rejoin, hazards that punish one player unless the other helps).
- Same lint, smoke test, and soft-lock checks. Final level 10-10 is a big team finale.
- **Done when:** all 50 co-op levels load and lint clean with no soft-locks, and the difficulty curve holds across the whole co-op mode.

### PHASE 10 — Audio, juice, and full QA
**MODEL: Sonnet 5**
- Synthesized Web Audio SFX and gentle ambience: grab thump, release whoosh, stretch creak (subtle), landing, hazard, checkpoint chime, goal jingle, UI clicks. Original, restrained, mutable, volume-controlled. No audio files.
- Juice pass: squash-and-stretch tuning, camera easing, respawn pop, confetti, transitions. Keep everything subtle.
- **Full QA:** run all 150 levels through the smoke test; profile for 60 fps on the heaviest levels; check memory over a long session; test window resize, tab blur/refocus, gamepad hot-plug, refresh mid-level, localStorage disabled; fix everything found.
- Write a draft `README.md` (what it is, controls, how to run offline, how to deploy).
- **Done when:** no console errors anywhere, stable performance, audio starts correctly after first interaction, and the user has a fully playable build to confirm.

### >>> USER CONFIRMATION GATE <<<
The user plays the game and confirms it works. **Do not proceed to Phase 11 until the user explicitly says the game works and asks to continue.**

### PHASE 11 — Final refine and GitHub
**MODEL: Opus 5.5**
- **Visual refinement:** critically review the whole look against `/reference/` and the "restrained and clean" goal. Improve typography, spacing, palette cohesion, character expressiveness, arm rendering, scenery balance, transitions, and menu polish. Reduce clutter where present.
- **Feel review:** one last physics and camera pass; only touch tuned values if a real problem is found, and document it.
- **Level review:** sample-check difficulty curves and unfair moments across both modes; adjust only where clearly needed.
- **Code cleanup:** remove dead code and debug leftovers (keep the `?dev=1` tools), consistent naming, short comments, confirm the offline double-click run still works.
- **Docs:** finalize `README.md` (screenshots optional, controls, modes, credits, "inspired by Heave Ho" note with no asset reuse), add a LICENSE if the user wants one.
- **GitHub:** ask the user for the repo name or URL (and whether public or private). Set up `git remote`, tidy commit history if helpful, add GitHub Pages deployment (static, from `main` root or `/docs` branch, whichever is simplest), and **push**. Never commit secrets or the `reference/` images unless the user says so (add `reference/` to `.gitignore` by default since they are third-party art).
- **Done when:** the repo is pushed, the live Pages URL loads and plays, and the final report lists what changed.

---

## 9. Final checklist (verify in Phases 10 and 11)

- [ ] Solo: 10 campaigns, 75 levels (5×5-level + 5×10-level campaigns)
- [ ] Co-op: 10 campaigns, 75 levels (5×5-level + 5×10-level campaigns), 2 players local
- [ ] Works offline, no servers, no online code
- [ ] Physics stable, grabs reliable, frame-rate independent
- [ ] Keyboard (solo + co-op split) and gamepad fully supported
- [ ] Saves and unlocks persist; `?dev=1` works
- [ ] Clean, restrained, cohesive visuals; original art and names
- [ ] Zero console errors; 60 fps
- [ ] README done; pushed to GitHub only after user confirmation
