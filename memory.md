# Dangle: project memory (handoff for a fresh session)

Read this first, then `CLAUDE.md` (rules + folder map), then `PROGRESS.md` (long log of every phase and every
tuned number), then only the section of `docs/MASTER_PROMPT.md` for the phase you are starting.
Written at the end of Phase 7 (updated from the Phase 5 version). Nothing has been pushed anywhere (no remote exists
yet); `git log --oneline` shows the phase commits (Phase 7 is the newest). Working directory: `C:\Programming\Visual Studio Code\Dangle` (Windows 11).

---------------------------------------------------------------------------------------------------------------

## 1. What this project is

**Dangle**: a 2D physics co-op platformer for the browser, inspired by the *formula* of Heave Ho (blobby head, two
stretchy arms, grab / swing / heave / fling). Solo mode (1 player) and local co-op (2 players, one screen).
10 campaigns per mode: campaigns 1-5 have 5 levels, 6-10 have 10 levels (75 per mode, 150 total). Static site: plain
HTML/CSS/JS, **no build step, no npm runtime deps, no servers, works offline**, must also work by double-clicking
`index.html` (so classic `<script>` tags in order, one global namespace `Dangle`, NO ES modules). Physics: vendored
Matter.js 0.20.0 (`js/lib/matter.min.js`). Rendering: Canvas 2D.

**Originality rule**: inspiration only. Never reuse Heave Ho's name, logo, lettering, character names/designs, music,
or assets. All art/names/sounds are original. `reference/` holds 3 third-party reference images (title, character
select, gameplay) used for *mood only*; it is in `.gitignore` and must never be committed unless the user says so.

## 2. The user's working protocol (must be followed)

The master prompt is `docs/MASTER_PROMPT.md` (saved unchanged). The user re-uploads it in each new chat. Key rules:
- Phases 0-11 in order. **Start of phase**: read CLAUDE.md + PROGRESS.md + only that phase's section. **End of
  phase**: verify Definition of Done, update PROGRESS.md, local git commit `Phase N: <name>`, print the
  `PHASE N COMPLETE` block (PLAYTEST / KNOWN ISSUES / NEXT / MODEL TO USE / THEN SAY), then **stop and wait**. Never
  start the next phase unprompted. If the user reports bugs, fix them inside the current phase first.
- **Never push to GitHub before Phase 11 and explicit user confirmation.** Phase 11 must ask for repo name/URL and
  public/private. Do not commit `reference/`.
- Models: phases are tagged Sonnet 5 or Opus 5.5. **User override (recorded in CLAUDE.md)**: Phases 4, 8 and 11 run
  on Opus 5.5; Phase 2 was Opus; all others Sonnet 5 (5, 6, 7, 9, 10). If the model does not match the tag (other
  than these overrides), stop and tell the user: "This phase needs <model>. Please run /model, switch, and say
  'Start Phase N' again."
- Token discipline: short messages, targeted edits, don't re-read files just written, stay in phase scope, verify
  with small scripts / the debug overlay. Keep tunables in `js/config.js`.
- Final message of each phase is a fixed block, then wait. The user then switches model if needed and says
  "Start Phase N".
- There is a **USER CONFIRMATION GATE** after Phase 10: the user plays the whole game and must explicitly say it
  works before Phase 11.
- Style requests: keep chat replies concise and honest. Report failures faithfully (say what is unverified).

## 3. Phase status

| Phase | Name | Model | Status |
|---|---|---|---|
| 0 | Project setup | Sonnet 5 | done (`2df7b3d`) |
| 1 | Physics sandbox | Sonnet 5 | done (`b5f37bb`) |
| 2 | Physics hardening + tuning gate | Opus 5.5 | done (`de0a3ab`) |
| 3 | Level engine | Sonnet 5 | done (`e1a9c6c`) |
| 4 | Art style + characters | Opus 5.5 (override) | done (`a838af1`) |
| 5 | Menus, modes, saves, HUD | Sonnet 5 | done (`f9d781d`) |
| 6 | Solo campaigns 1-5 (25 levels) | Sonnet 5 | done (`Phase 6: Solo campaigns 1-5`) |
| 7 | Solo campaigns 6-10 (50 levels) | Sonnet 5 | done (`Phase 7: Solo campaigns 6-10`) |
| 8 | **Co-op mode + co-op campaigns 1-5 (25)** | Opus 5.5 (override) | **NEXT** |
| 9 | Co-op campaigns 6-10 (50) | Sonnet 5 | todo |
| 10 | Audio, juice, full QA (+ draft README) | Sonnet 5 | todo |
| gate | user plays and confirms | n/a | todo |
| 11 | Final refine + GitHub | Opus 5.5 | todo |

To start the next chat: upload the master prompt, link the folder, and say: *"Read memory.md, CLAUDE.md and
PROGRESS.md, then Start Phase 8."* (Phase 8 runs on Opus 5.5.) (switch to the right model first).

## 4. Environment gotchas (Windows, this machine)

- Shell tools: Bash (Git Bash) and PowerShell both exist. Node v24, Python 3.13, git 2.55.
- **Python file editing**: default encoding is cp1252. Always `io.open(path, encoding='utf-8', newline='\n')` for
  read AND write, or you corrupt non-ASCII (a `°` was once written as a raw 0xB0 byte). After bulk edits run:
  `for f in $(git ls-files -mo --exclude-standard); do iconv -f utf-8 -t utf-8 "$f" >/dev/null 2>&1 || echo BAD $f; done`.
  In JS strings prefer `\u00b0` escapes over literal non-ASCII.
- **Bash heredocs with `'` inside** can break the command ("unexpected EOF"): use the Write tool for JS files that
  contain quotes; use `python - <<'EOF'` only for small edits (assert the old string exists, then replace once).
- Git prints "LF will be replaced by CRLF" warnings: harmless. Commit messages end with the
  `Co-Authored-By: <current model> <noreply@anthropic.com>` line the harness specifies for the current model.
- **Preview / browser pane** (`mcp__Claude_Browser__*`, server via `.claude/launch.json` = `python tools/serve.py 8000`):
  - Use `http://127.0.0.1:8000/` (not `localhost`); `tools/serve.py` sends `Cache-Control: no-store` (plain
    `http.server` let the browser keep stale JS, causing phantom bugs).
  - The pane is usually hidden: `requestAnimationFrame` barely runs, screenshots lag **one action behind**, and long
    or GPU-readback scripts hang the pane (`getImageData` loops timed out and forced a preview restart). Drive frames
    manually with `Dangle.debug.tick(1/60)` (wraps `loop.advance`), then `Dangle.debug.render(0.5, 1/60)`; take the
    screenshot twice if it looks stale. Dispatch a `focus` event first (blur pauses the game).
  - `resize_window` to e.g. 1200x700 for a stable layout, and reset with `preset: "desktop"` afterwards. Resize
    emulation does not always fire `resize`: dispatch `new Event('resize')`.
  - Synthetic keys: dispatch `keydown`, tick 2+ frames, then `keyup` (helper pattern `__press(code)`); a key
    pressed and released in the same JS tick only counts as an *edge* (menus handle this, gameplay uses a latch).
  - Fake gamepad for tests: override `navigator.getGamepads` and dispatch `gamepadconnected`.
  - The user's DualSense controller is sometimes connected; real pad input can appear in the browser.
  - Stale console messages may persist across navigations; judge only new ones.
- `Dangle.debug` (from game.js): `world`, `layer`, `loop`, `state`, `goToLevel(id)`, `setTheme(id)`, `render`, `tick(dt)`.

## 5. Architecture (all under `js/`, loaded in order by `index.html`)

Global namespace `Dangle`. Flow: `config.js` -> `core/*` -> `physics/*` -> `levels/*` -> `render/*` -> `ui/*` ->
`dev/*` -> `game.js`. Read `CLAUDE.md` for the exact folder map. Key modules:

**core**: `loop.js` (`createStepper`: fixed 1/120 s accumulator, max 5 steps/frame, dt clamp 0.1; `start()` returns
`{advance, setPaused, isPaused, stop}`), `input.js` (gameplay aim/grab per player + menu actions + device
assignment, see section 8), `camera.js` (follow + slow lookahead, level-bounds clamp, co-op fit with zoom cap,
off-screen arrows, goal intro pan), `characters.js` (6 characters data, glove colours), `storage.js` (settings,
progress, unlock rules; localStorage in try/catch with in-memory fallback), `config.js` is one level up.

**physics**: `world.js` (Matter engine wrapper, `step(W)` order, interpolation `pose()`, `teleport()`, patches
`Matter.Constraint.solve` for one-sided `maxOnly` constraints), `player.js` (head + 2 hands, arm vector-spring,
`floorFriction`, arm safety net, `die/revive/respawn`), `grab.js` (pins, buffer, coyote, reel-in), `surfaces.js`
(block kinds, crate, rope, `mover`, rope long-range attachment), `hazards.js` (per-step level rules: hazards,
tides, checkpoints, goal, wind, trampolines, respawn timers/partner respawn).

**levels**: `builder.js` (plain-JSON spec builder), `segments.js` (segment library), `levels.js` (registry +
`compile` + `spec(id)` cache + `find`/`all`), `themes.js` (10 palettes), `campaigns.js` (campaign table + id scheme +
**placeholder level generator**), `loader.js` (`Level.load(spec, players, chars)`, `unload`, `census`),
`test-levels.js` (`test-h`, `test-v`, `test-all`, hidden `howto`), `sandbox.js` (Phase 1 strip, level id `sandbox`).

**render**: `crayon.js`, `level-layer.js` (pre-rendered tiles), `scenery.js`, `characters.js`, `draw-world.js`,
`draw-level.js`, `draw-player.js` (also puppets for menus), `particles.js` (`Dangle.Fx`).

**ui**: `type.js`, `widgets.js`, `scene.js`, `menus.js`, `screens.js`, `screens-play.js`, `hud.js`, `tuning.js` and
`debug.js` (dev panel/overlay).

**game.js**: session orchestrator (phases menu/play/pause/complete, wipes, result saving, dev keys, boot params).

Runtime coordinate conventions: y grows downward, level floor baseline y = 0, all level distances are in **REACH
units** (`config.REACH` = 130 px) so retuning arms never silently breaks solvability.

## 6. Physics: the design and the hard-won rules (Phases 1-2)

Player = heavy head (r 24, mass 6) + two light hands (r 11, mass 1). Each arm is a **vector spring**: it wants
`hand - head = aimed arm vector`. A free hand flies to its target; a gripping (pinned) hand cannot move, so the same
spring pulls the head: that is the heave, no scripted impulse. **Stick semantics**: reach in a direction, grab, then
point the stick *away* from the grip to pull yourself toward it. Swing pumping: stick between "against the swing
direction" and "toward the grip". Mantle over a lip: stick down-away.

Rules that must not be broken (each fixed a real bug):
1. Every arm force has an equal and opposite reaction on the head (a one-sided force let players push each other for
   free / created energy).
2. **Matter friction is OFF for players** (warm-started per velocity iteration = viscous drag; a head heaved up a wall
   crawled at ~45 px/s). Heads/hands use `Player.floorFriction` (floors only; walls frictionless for players):
   `HEAD_GRIP` 0.9 g, `HAND_GRIP` 2.5 g, `SLICK_GRIP_SCALE` 0.08 on ice, uses mover velocity, mass-shared against
   dynamic bodies. Static block `frictionStatic` is 0.2 (low); crate Matter friction 0.06.
3. The head body never rotates (`setInertia(Infinity)`); face tilt is cosmetic (`p.tilt`).
4. Arm length limit is a one-sided `maxOnly` Matter constraint inside the solver (so it resolves together with
   pins/rope links), plus a post-step projection safety net (`LIMIT_SLOP` 3 px). Rope segments never stretch
   (long-range attachment). A hand pinned to a static body or rope segment is immovable in the projection.
5. Grabs: closest-point contact (allocation-free), tolerance ring `GRAB_TOLERANCE` 8 px (`ASSIST` 18), press buffer
   0.09 s, contact coyote 0.09 s, new pins **reel in** at 700 px/s (no snap), release clears the buffer.
6. Reaching (free) arms are weaker than gripping ones: `FREE_ARM_CAP` 0.45 head weights vs `ARM_FORCE_CAP` 1.9, so a
   blocked reach never undoes a hold and two free arms can't lift the head (no hand-hopping). Free aimed arms carry
   their own hand weight. `ARM_SPREAD` 0.1 rad (bigger spread stops one hand reaching a wall).
7. Arm force, gravity units: acceleration px/s^2; Matter force = mass * accel * 1e-6; velocity px/s = dPos*1000/
   deltaTime; `frictionAir` is per 16.7 ms (0.01 is strong; head uses 0.003).
8. Speed clamps: head 2200, hand 2400 px/s (below tunnelling threshold with 24 px min wall thickness).
9. Dead players are **removed from the world** (bodies + arm constraints), so nothing can grab them; revive
   re-adds them. Out-of-bounds uses per-level `W.limits` / `W.killY`, not the sandbox constant.
10. Trampolines must launch the head **and hands** together (else hands drag the head back).

Final tuned values (see `js/config.js`, do not retune without a reason): STEP 1/120, iterations 10/8/8, GRAVITY
1000, REACH 130, HEAD_MASS 6, HAND_MASS 1, ARM_FREQ 13, ARM_DAMP 0.7, ARM_FORCE_CAP 1.9, FREE_ARM_CAP 0.45,
RELAX_CAP 0.3, PINNED_REACH 0.45, PINNED_DAMP 0.25, ARM_RELAX 0.12, ARM_MAX_STRETCH 1.25, AIM_DEADZONE 0.18,
GRAB_REEL 700, TRAMPOLINE_LAUNCH 900, WIND_LIFT 1.15 g, RESPAWN_DELAY_SOLO 0.9 / COOP 1.5.
**Matter.js stays** (its friction/constraint weaknesses are patched locally; ~0.03 ms/step for 2 players).

## 7. Level engine (Phase 3)

Pipeline: `segments.js` -> `builder.js` (spec = plain JSON: blocks, movers, ropes, crates, hazards, trampolines,
winds, risers/tides, checkpoints, gaps, rises, tides, beams, spawns, goal, bounds, killY) -> `levels.js` (`compile`,
auto-checkpoint every `CHECKPOINT_SPACING` 5R of safe progress) -> `loader.js` -> `hazards.js` runs rules per step.

A level definition: `{ id, name, theme, direction: 'right'|'up', coop, difficulty, seed, segments: [[name, opts],...] }`.
Register real levels with `Dangle.Levels.register(def)`; a registered def **overrides the placeholder** with the same
id (see section 9). Ids for campaign levels: `solo-3-2` / `coop-10-10`.

Segments (right-going): `start{len}`, `ledge{len}`, `gap{w, aid: none|rope|ropes(n,spacing)|beam|mover(period: a minimum)|chain
(co-op only), floor: spikes|lava|water, land}` (adds an invisible `pit` kill zone), `step{h,len}` (h<0 = drop),
`wall{h,len}`, `crateStep{h}`, `iceSlope{len,rise,shelf}`, `beamRun{len}` (spikes + overhead helper beam),
`noGrabClimb{h}` (unproven), `trampolineStep{h}` (unplayable: use `bounce`), `windRise{h,nograb}`,
`tide{len,h,speed,kind}` (h = wall to climb at its end), `lift{h,period}`, `bounce{drop,h}`, `goal{len}`.
Up-going: `startUp{width}`, `zigzag{n,dy,ledge}`, `windShaft{h}`, `goalUp`. Block kinds: ground, ice (grabbable,
slick), helper (grabbable striped beam), noGrab, trampoline (not grabbable). A segment must end with `b.markSafe()`
if a checkpoint may follow; every segment records lint metadata (`b.gap`, `b.rise`, `spec.tides`, `spec.beams`).

**Lint limits** (`config.LINT`, REACH units, all bot-verified with a margin; see PROGRESS Phase 6): plain gap 0.9, rope
gap 2.0 (1.7-2.0 verified), rope rows: 2 ropes 1.1R apart, 3+ ropes 1.0R apart, 0.9R to the edges, helper-beam gap
span 3.5 (`gap aid:'beam'`), mover gap 8 (proven, Phase 7), co-op chain gap 3.4 (unverified), beam run/beam length 5.25,
wall 3.5, ledge stack rise 1.1 with tip gap 0.2-0.6 sideways (zigzag: UNPROVEN, see below), bounce wall 3.2 with a 0.8-1.4R
drop onto the pad (`trampoline` rise 3.2), lift 6, wind rise 3.5 (also with `nograb`), ice slope rise 1.0 (3R run), level
length 12..140R, min thickness 24 px, tide flood time >= 1.2x crossing time (85 px/s crawl + 2.5 s + 2.2 s/R for a wall
at the end: `Dangle.tideCross`), platforms accelerate <= 0.8x head grip.
Design lessons: ledges must NOT overlap sideways (an overhang can't be mantled from below); the two hands are not
interchangeable near an edge; horizontal wind can't carry you across a gap (removed as a gap aid); flat ground is a
crawl (~90 px/s), so keep ledges short and let steps, drops, ropes and beams carry the interest.

**Proven by bots** (Phases 6-7): plain gaps, single ropes, rope rows, beam gaps, beam runs, walls/steps (0.5-3.5R), drops,
ice slope + shelf, wind rise (also beside a no-grab face), crate step, tides (flat, and with a wall to climb), sliding
bridges, lifts, springboard bounce. **NOT verified** (keep out of levels or add a bot first): zigzag ledges up a shaft
(bot ends under the overhang: no 'up' levels yet), trampolineStep (unplayable: use `bounce`), noGrabClimb, bounce with a
no-grab wall, chain gaps and every other co-op mechanic (two players; Phase 8).
Movers/lifts (`platformTiming` in segments.js): rest 1.8 s at each end, glide slowly enough to ride; a level's `period`
is only a minimum. Keep ice shelves away from gaps and crates (slippery approach). Author files: solo-campaigns.js (1-5),
solo-campaigns-2.js (6-10); shorthands are `Dangle.Levels.dsl`.

## 8. Input, menus, saves (Phase 5)

**Controls** (physical key codes): P1 = WASD or arrows to aim, Q = left glove, E = right glove. P2 = IJKL, U/O.
Gamepad: left stick aims, LB/LT = left grab, RB/RT = right grab. Mouse aim optional (P1). `Esc`/`P`/pad Start =
pause; hold `R` 0.7 s = restart (dev: tap). Settings has per-player device assignment (keyboard auto/WASD/IJKL/off,
pad auto/1-4/off), tap-to-grab, grab assist, reduce shake, mouse aim, volume (**stored only; audio is Phase 10**).
**Menu input**: `Input.menuActions(dt)` -> up/down/left/right/confirm/back/pause/any from keys (arrows/WASD/IJKL,
Enter/Space/E/O confirm, Esc/Backspace/Q/U back), gamepad (d-pad, stick, A confirm, B/Select back, Start pause), with
key repeat; plus mouse hover/click via `Input.takeClick/takeMoved`.
**Screens** (canvas, 1280x720 virtual, letterboxed): title, main, chars, campaigns, levels, settings, controls,
confirm, pause, complete; how-to-play is a real playground level (`howto`) with a HUD strip. `Menu` manager: slide+fade
transitions (input locked for the first half), history stack, `openPath`, overlays over the game (`over`). Game <->
menu swaps use a 0.24 s cream wipe. Losing window focus mid-level opens the pause menu.
**Saves**: `dangle.v1.settings`, `dangle.v1.progress` (per mode, per level id: `{done, best, clean}`); sanitised on
load; corrupt/blocked storage falls back to defaults/memory. Unlocks: levels in order; campaign N opens when N-1 is
fully done; modes independent; `?dev=1` unlocks everything.
URL params: `?dev=1`, `?level=<id>` (skip menus; test-h, test-v, test-all, sandbox, solo-2-3 ...), `?players=n`,
`?theme=<id>`, `?stress=1` / `?stress=<name>`.

## 9. Placeholder levels (important for Phases 6-9)

`js/levels/campaigns.js` generates a deterministic **placeholder** for every campaign id that has no registered
definition (`def.stub = true`), from the campaign's signature obstacle pool (POOLS 1-10, `OB` makers with difficulty
t in 0..1, height bookkeeping, Frozen Peaks alternates vertical levels). They pass lint and smoke, so menus, unlocks
and flow work today. **Phases 6-9 replace them** by calling `Dangle.Levels.register({...})` with the same ids
(recommended: new files `js/levels/solo-campaigns.js` / `coop-campaigns.js`, loaded before `test-levels.js`... the
registry lookup is `get(id)` first, then the stub, so order only matters for lint/tools loading; add the new files to
`index.html` and to the file lists in `tools/lint-levels.js` (already tries `levels/campaigns`), `tools/level-smoke.js`
and `tools/sim-test.js`/`gap-bots.js` if they need them). Level names: `Campaigns.levelName(c, n)` is used by the HUD
unless the def sets its own `name`.

Campaign table: 1 Sunny Meadow (5, meadow: learn grab/swing/heave, safe drops), 2 Bamboo Grove (5, bamboo: vines,
ropes, pendulums), 3 Lantern Caves (5, caves: dark, narrow swings), 4 Salt Flats (5, salt: long gaps, wind, crates),
5 Frozen Peaks (5, frozen: ice, slick slopes, vertical climbs), 6 Tidal Ruins (10, tidal: rising water, timed),
7 Clockwork Works (10, clock: moving platforms), 8 Sky Islands (10, sky: trampolines, wind, big drops),
9 Ember Depths (10, ember: lava, no-grab walls), 10 The Big Dangle (10, finale: everything). Each ends with a
signature "boss-style" level. Difficulty ramps inside each campaign and across campaigns; campaigns 6-10 are a step up.
Solo levels must be solvable by one player; co-op levels must *require* two (chain bridges, boost throws, hold-open
plates, two-grab crates, counterweights; co-op-only mechanics are Phase 8).

**Phase 6 status**: `js/levels/solo-campaigns.js` holds the real `solo-1-1`..`solo-5-5` (short helper functions
`start/goal/ledge/gap/rope/ropes/beamGap/up/down/wall/beamRun/ice/windRise/crate` build the segment lists). Solo
campaigns 6-10 and all co-op ids are still generated placeholders. Add new files after `campaigns.js` in `index.html`
and in the file lists of tools/lint-levels.js, level-smoke.js and level-bot.js (bots.js loads its own list).

## 10. Art (Phase 4)

Flat cream base `#fdf0dc`, crayon look: seeded wobbly outlines (`Crayon.wobble`), one 256 px seamless grain texture,
darker same-hue outlines (never black), chunky rounded shapes. Static level art is pre-rendered into world-space tiles
(384 units, LRU cap 72 MB, 6 tiles/frame budget, vector fallback with identical grain so nothing pops); outlines drawn
first then exact-polygon fills so touching blocks merge. Themes (10 palettes in `themes.js`, Lantern Caves is `dark`:
half-res veil with light around players/lanterns/flags/goal). 22 scenery kinds, sparse, deterministic. Characters: Pip
(sprout), Moss (beanie), Bluebell (bow), Sunny (propeller), Rosie (daisies), Plum (headband); gloves always left =
blue, right = red. Faces are live (eyes track aim/grip/partner/motion; grab, strain, fall, win, pop expressions;
blinking); squash-and-stretch and landing dust; pooled particles (600) + subtle screen shake (`SCREEN_SHAKE`).
**Art is read-only w.r.t. physics** (verified bit-identical positions with/without rendering).

## 11. Automated checks (run `node tools/check-all.js` before every commit; it must print "everything passes")

`tools/sim-test.js` (16 physics stress scenarios in `js/dev/stress.js`; also `index.html?stress=1`),
`tools/lint-levels.js` (+ `--selftest`, lints all 154 defs), `tools/gap-bots.js`, `tools/segment-bots.js` (45 obstacle
cases; `--probe` runs cases beyond the limits), `tools/level-bot.js` (every obstacle of every authored solo level: 75),
`tools/progress-test.js` (34 checks),
`tools/level-smoke.js` (sample: registered + first/last level of each campaign in both modes; `--all` = all 153 in
~55 s: settle, checkpoint, hazard/fall death + timed respawn, completion needs everyone, trampoline/wind/tide/mover
mechanics, unload leaves 0 bodies, 20 rapid restarts no slowdown/heap growth), `tools/camera-test.js` (13 checks),
`tools/energy-probe.js` (dev: which step phase adds energy). Physics changes must keep all stress tests green; new
segments need a lint rule + smoke coverage; new mechanics deserve a policy in `tools/bots.js` + a case in `segment-bots.js` (and a branch in `level-bot.js`).

**Bot lessons (tools/bots.js)**: policies are generators (`yield` once per step, return true/false; `run` drives them).
The two hands fan +-0.1 rad around the stick (left up, right down): aim so the FREE hand goes where you want. Crawling
holds the head ~57 px behind the gripping hand, so approaches to walls/edges stop early; to reach an edge, grip near it
and push the stick BACK with a ramped magnitude (too strong overshoots across the pit). Mantle when a grip is within
~22 px of the lip. Rope swings are chaotic (a start 1 px or a different absolute x changes the outcome), so ropes are
proven by a search over release points from a canonical stance (`placeAt` = checkpoint-respawn stance), never as one
continuous run. `level-bot.js` does the same for every obstacle, so it proves 'each obstacle is crossable with this
level's exact options', not a single continuous playthrough. Debug with `TRACE=1 EVERY=30 node tools/level-bot.js <id>`.

## 12. Guidance for Phase 8 (Co-op mode + co-op campaigns 1-5, 25 levels) and beyond

- Phase 8 runs on Opus 5.5 (user override). What exists: shared camera (fit both, zoom cap, off-screen arrows), coordinated
  respawn (partner respawn needs a grounded partner >= 1R ahead), "both in goal" completion, per-player HUD tags, the
  co-op menu flow and per-player device assignment. Lint rejects co-op-only gaps in solo levels and requires `coop: true`
  for chain gaps. Level ids `coop-1-1`..`coop-5-5` are placeholders (the placeholder generator uses the solo pools).
- Needed: the co-op-only mechanics (chain bridges `gap aid:'chain'` limit 3.4R, boost throws, hold-open plates, two-grab
  heavy crates, counterweights), authored co-op levels (`js/levels/coop-campaigns.js`, register with `coop: true`) that
  REQUIRE two players (not solo levels with a second head), no soft-locks (one stuck, other dies, both fall), and lint +
  smoke with two players. Each new mechanic needs a two-player bot in `tools/bots.js` style (policies are generators over
  one player: for two players run two generators in the same loop) and a lint rule + known-bad selftest case. Levels may
  reuse everything proven for solo (segments + `Levels.dsl`), but the solo-only limits then apply per player.
- Reuse the recipe: lint + a level bot for the authored co-op levels (extend level-bot.js; a co-op obstacle is proven from a
  standing start with both players, like solo) + `level-smoke.js --all` + check-all.
- The user has NOT yet hands-on playtested Phases 1-7: feel and level difficulty were tuned with scripted bots. Expect
  feedback; main lever is `ARM_FORCE_CAP` (1.9) in the dev panel (`?dev=1`, backtick). Ropes are the least bot-proven part.
- Phase 9: co-op 6-10 (50 levels): longer chains, timed handoffs, split routes that rejoin.
- Phase 10: audio is Web Audio, fully synthesized, needs a user gesture; `Dangle.Audio.setVolume` is already called
  by `applySettings` if present; level events (`death`, `revive`, `checkpoint`, `bounce`, `complete`) are drained
  every frame in `game.js` (`Fx.consume`) and are the hook for sounds. Write a draft README.md. Full QA list in the
  master prompt (all 150 levels smoke, 60 fps on heaviest levels, long-session memory, resize, blur/refocus,
  gamepad hot-plug, refresh mid-level, localStorage disabled).
- Phase 11 (Opus): visual/feel/level review, code cleanup (keep `?dev=1` tools), finalise README, ask the user for
  repo name/URL + public/private, add GitHub Pages deploy, push only then. `reference/` stays ignored.

## 13. Known issues and honest caveats (as of Phase 7)

- Hands-on feel is unverified by a human. GPU frame time was never measured (hidden preview pane): the user should
  check the fps in the debug overlay (`~` key; always available) at 1P, 2P zoomed out and in Lantern Caves.
- All 75 solo levels are authored (Phases 6-7); the 75 co-op slots are generated placeholders (untuned, flow/testing
  only). Real levels come in Phases 8-9. Level HUD title is `Campaign Name N` (no per-level names).
- Volume setting has no effect until Phase 10. HUD text is functional, not final.
- `render` code draws per frame with ~0.4 ms CPU worst case measured; tile cache up to 72 MB.
- Adjacent ground blocks merge visually (outline pass then fill pass); rotated ice slabs leave a small void underneath.
- The dev-only panel (`js/ui/tuning.js`) exposes many physics sliders and "Copy config"; it only exists with `?dev=1`.

## 14. Quick reference commands

```bash
node tools/check-all.js                 # everything (must be green)
node tools/sim-test.js [scenario]       # physics stress tests (names: rest hangEnergy pumpSwing fling climb ledgeHeave chain mutual regrab corner mover heavyRope tunnel grabReliability frameRate lowFps)
node tools/lint-levels.js [id]          # lint all (or one) level definitions; --selftest
node tools/level-smoke.js [id|--all]    # load/finish/respawn/unload/restart checks
python tools/serve.py 8000              # no-cache dev server -> http://127.0.0.1:8000/  (?dev=1 for dev tools)
git log --oneline                       # phase commits
```
