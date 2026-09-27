# Progress log

Short entries only: what was built, what was tuned, known issues, constants changed.

## Phase 0 — Project setup (done)
- Saved master prompt to `docs/MASTER_PROMPT.md`; created `CLAUDE.md`, folder skeleton, `.gitignore` (includes `reference/`).
- Vendored Matter.js 0.20.0 at `js/lib/matter.min.js` (offline).
- `index.html` + `css/style.css` + `js/config.js` + `js/game.js`: blank cream canvas, DPR-correct, resizes.
- Reference images copied to `reference/` (title, character select, gameplay).
- Known issues: none.

## Phase 1 — Physics sandbox (done)
Built: fixed-step loop (1/120, accumulator, alpha interpolation), input (2 keyboard schemes, gamepad w/ hot-plug, optional mouse, toggle-grab), player factory, vector-spring arms, grab system, surfaces (block/crate/rope), sandbox strip, placeholder renderer, camera, tuning panel + debug overlay (backtick), headless `tools/sim-test.js`.
Design decisions:
- Arm = vector spring: it wants `hand - head = aimed arm vector`. Free hand flies to target; a *pinned* hand can't move, so the same spring pulls the head (the heave; no scripted impulse). Force is capped (`ARM_FORCE_CAP` head-weights per arm). Stick neutral = weak relaxed spring on the hand only (no reaction on the head), so a hanging body is held by the hard limit, like a rope.
- Stick semantics: reach in a direction, grab, then point the stick *away* from the grip to pull yourself toward it. Swing pumping: stick against the swing direction.
- Hard arm limit `ARM_MAX_STRETCH*REACH`: post-step projection by inverse mass + removal of outward relative velocity (2 passes). Hand pinned to static = immovable; pinned to a dynamic body moves with it.
- Grab: tolerance ring (sensor circle, R+8px) via Collision.collides; snaps hand onto the surface; press buffer 0.09 s, contact coyote 0.09 s; release clears buffer (no instant re-grab).
- Same negative collision group per player (own head/hands never collide); other players' bodies are grabbable.
- Guards: speed clamps (head 2200, hand 2600 px/s), NaN/out-of-bounds/arm-broken check -> respawn at spawn with pop.
- Matter units: force = mass*accel(px/s^2)*1e-6; velocity px/s = dPos*1000/deltaTime. frictionAir is per 16.7 ms (0.01 is strong; head uses 0.003).
Verified headless (node tools/sim-test.js): rest is 0.000 px/step jitter; hang, hand-over-hand wall climb, rope swing, 2-player rope chain (P2 hangs from P1's hand), mutual head-grab thrash and 60 s two-player fuzz all stay finite (avg 0.03 ms/step, p99 0.15 ms); loop gives 1200 steps/10 s at 30/60/144/240 Hz; no-grab wall never pins; pit falls respawn.
Known / for Phase 2: climbing is slow (needs skilled hand-over-hand), fling strength and swing feel not yet tuned by hand; heavy crate can't be dragged by one arm (crate mass 7); Query allocation-free but Collision.collides allocates on overlap; hand snap on grab is a one-step position jump (<= 8-18 px).
Config values: see js/config.js (ARM_FREQ 13, ARM_DAMP 0.7, ARM_FORCE_CAP 1.6, HEAD_MASS 6, HAND_MASS 2, GRAVITY 1000, iterations 10/8/8).

## Phase 2 — Physics hardening and tuning gate (done, Opus 5.5)
Harness: `js/dev/stress.js` (16 scenarios with pass/fail thresholds), run headless with `node tools/sim-test.js`,
in-page with `index.html?stress=1` (table) or `?stress=<name>` (watch one live). `tools/energy-probe.js` splits a
scenario's energy change by step phase. All 16 pass: rest, hangEnergy, pumpSwing, fling, climb, ledgeHeave,
chain, mutual, regrab, corner, mover, heavyRope, tunnel, grabReliability, frameRate, lowFps.

Instability sources found and fixed:
- Energy injection: neutral-stick arm force had no reaction on the head (a player holding another pushed them for
  free). Now every arm force is equal/opposite.
- Grab snap/coyote yank (up to ~47 px in one step = 5600 px/s spike): pins now start at the current distance and
  reel in at GRAB_REEL 700 px/s. Contact = exact closest point on the surface (allocation-free), anchor sits one
  hand radius off the surface (no hand/ground fighting).
- Arm limit fought other constraints (post-step projection vs pins vs rope limit -> energy pumping in chains):
  arm limit is now a one-sided `maxOnly` constraint solved inside Matter's iterations (Constraint.solve patched in
  world.js); the old projection stays only as a safety net beyond LIMIT_SLOP 3 px.
- Ropes stretched under heavy loads: rope "long-range attachment" (segment i never further than its rope length
  from the anchor), inelastic.
- Matter friction is warm-started and applied per velocity iteration, so a sliding pressed contact becomes viscous
  (a head heaved up a wall crawled at ~45 px/s regardless of coefficient). Players now have Matter friction 0 and
  our own floor-only Coulomb friction (HEAD_GRIP 0.9 g, HAND_GRIP 2.5 g, uses mover velocity, mass-shared vs
  dynamic bodies). Walls are frictionless for players, so heaves are smooth; floors still stop you.
- Rolling head gripped walls via Matter's static branch: head inertia is now Infinity; face tilt is cosmetic.
- Tunneling margin: MAX_HAND_SPEED 2600 -> 2400 (< (24 px wall + hand diameter)/2 per step).
- Order bias in chains: all players' limits per pass; world step order documented in world.js.

Control-model changes (found by the climb/pump/fling scenarios):
- Gripping arm: slack rope at neutral stick; aimed = short strong muscle (PINNED_REACH 0.45 x REACH), low damping
  (PINNED_DAMP 0.25). Short is what makes climbing possible (the free hand can reach higher than the grip).
- Reaching arm: weaker than gripping (FREE_ARM_CAP 0.45 head weights) so a blocked reach never undoes a hold and
  two free arms can't lift the head (no hand-walking/hop exploit); aimed free arms carry their hand's weight
  (internal force, head takes the load) so reaches land where aimed.
- ARM_SPREAD 0.3 -> 0.1: with 17 deg spread one hand could never reach a wall while the other held.
- HAND_MASS 2 -> 1 (faster reaches, still stable: omega*dt ~0.27).
- Technique that works: climb = keep stick up, alternate grabs (~3.2 s up a 360 px wall). Pump = stick between
  "against the motion" and "toward the grip" (horizontal in ~0.9 s for a perfect bot, full loops). Heave over a
  lip = stick down-away (0.5 s). Fling: ~600 px/s release, ~370 px flight dropping 366 px.

Final tuned config (changed from Phase 1): ARM_FORCE_CAP 1.6->1.9, FREE_ARM_CAP 0.45 (new), RELAX_CAP 0.3 (new),
PINNED_REACH 0.45 (new), PINNED_DAMP 0.25 (new), ARM_SPREAD 0.1, HAND_MASS 1, HEAD_GRIP 0.9 / HAND_GRIP 2.5 /
SLICK_GRIP_SCALE 0.08 (new; HEAD_FRICTION*, HAND_FRICTION, HEAD_UPRIGHT, HEAD_ANG_DAMP removed), HEAD_AIR_DRAG 0.003,
TILT_PER_SPEED 0.0006 / TILT_MAX 0.35 (cosmetic), GRAB_REEL 700, MAX_HAND_SPEED 2400, LIMIT_PASSES 2, LIMIT_SLOP 3,
CRATE_FRICTION 0.06, block frictionStatic 0.2. Unchanged: STEP 1/120, iterations 10/8/8, REACH 130, HEAD_MASS 6,
ARM_FREQ 13, ARM_DAMP 0.7, GRAVITY 1000, grab tolerance/buffer/coyote 8 px / 0.09 s / 0.09 s.
Why 1.9: 1.6 can't hold head + dangling hand + reaching push with any margin (climb stalls); 2.2+ swings to
horizontal in 0.7 s (weightless). 1.9 = one arm lifts you, swings take a couple of pumps.

Matter.js decision: KEEP. Its problems (friction model, equality-only constraints) are fixed with small, local
additions (own friction, one-sided constraint patch); cost is ~0.03 ms/step for 2 players. A custom solver would
cost far more tokens for no measurable gain.

Sandbox additions: moving platform over the landing block. Stress scripts double as documentation of technique.
Known issues / for later phases: grab contact search is O(grabbables) per hand per step (fine now; Phase 3 may add
a broadphase if levels get large). frameRate: 30 Hz deviates up to ~11-24 px on a pumped swing (one frame of
input latency, expected). Feel is verified by scripted bots only; needs the user's hands-on playtest.

## Phase 3 — Level engine (done, Sonnet 5)
Built: levels are data. `segments.js` (library) -> `builder.js` (plain-JSON spec, no Matter/DOM, deterministic) ->
`levels.js` (registry + compile, checkpoint auto-placement every 5R of safe progress) -> `loader.js` (spec -> world,
unload, census) -> `physics/hazards.js` (per-step rules). Camera rewritten (`core/camera.js`). Throwaway levels in
`test-levels.js`: test-h (horizontal), test-v (vertical), test-all (every mechanic). Old sandbox stays as level `sandbox`.
- Segments: start, ledge, gap(aid none|rope|ropes|mover|chain(co-op only)), step/wall, crateStep, iceSlope,
  beamRun (spikes + overhead beam), noGrabClimb, trampolineStep, windRise, tide, goal; up-levels: startUp, zigzag,
  windShaft, goalUp. Kinds: ground, ice (slick, grabbable), helper (striped beam), noGrab, trampoline; movers, ropes,
  crates, hazards (spikes/lava/water/invisible pit), wind zones, rising tides.
- Death/respawn: dying removes the player's bodies + arm constraints from the world (nothing can touch/pin/pull
  them), timer RESPAWN_DELAY_SOLO 0.9 s / COOP 1.5 s, revive at last checkpoint or beside a grounded partner who
  is >= 1R ahead of it. Tides reset when someone is revived. Complete = all players alive and inside the goal.
- Camera: follow + slow lookahead along the travel axis, level bounds clamp, co-op fit with zoom cap CAM_MAX_W/H and
  edge arrows (HUD) beyond it, intro hold on goal then glide back (any input skips after 0.5 s).
- Fixes found on the way: WORLD_LIMIT (6000) killed players in long levels -> per-level limits; trampolines must
  launch the hands too or the head is dragged back (apex 215 -> ~400 px); wind gaps can't be crossed horizontally, so
  the 'wind' gap aid was replaced by `windRise` (updraft beside a wall).
Automated checks (`node tools/check-all.js`, all green): physics stress (16), linter selftest (10 known-bad levels
rejected), linter (3 levels), gap-bots, level-smoke (each level x 1P/2P: settle, checkpoint, hazard death + timed
respawn, fall death, completion needs everyone, trampoline/wind/tide/mover behave, unload leaves 0 bodies, 20 rapid
restarts: ~3-8 ms each, no slowdown, heap flat), camera (13 checks).
Lint limits (config.LINT, REACH units): plain gap 0.9 (bot crosses 0.9, not 1.0), rope gap 2.0 (bot crosses 1.7-2.2,
not 2.4), rope-row spacing 1.25, wall 4.5, ledge stack rise 1.1 with tip gap 0.2-0.6, trampoline rise 3, wind rise
4.5, tide flood time >= 1.2 x crossing time at 110 px/s.
Design lessons: ledges must not overlap sideways (an overhang can't be mantled from below: the head ends up under
it) -> zigzag ledges are 1.8R wide with 0.4R between tips, 1.0R apart vertically; the two hands are not equivalent
near an edge (spread), players will use whichever reaches.
NOT verified by bots (needs your hands): zigzag beyond the first ledge, iceSlope, crateStep, trampolineStep,
noGrabClimb, beamRun traversal, windRise, mover timing. Their lint limits are provisional (Phase 6/7 playtest).
Known / for later: draw-level is placeholder (no pre-rendered static layer yet: Phase 4); merge seams between
adjacent ground blocks show as lines; HUD is minimal (Phase 5); events queue (death/checkpoint/bounce/complete) is
drained by game.js and unused until Phase 4 particles / Phase 10 audio; solo/co-op respawn delays are config values.

## Phase 4 — Art style and characters (done, Opus 5.5 by user choice)
Built (all original art, reference images used for mood only):
- `render/crayon.js`: seeded outline wobble (rounded corners, smooth two-sine perimeter noise), one 256 px
  seamless grain texture (speckles + short crayon streaks) applied with 'source-atop', soft doubled outlines,
  sprite helper.
- `render/level-layer.js`: static geometry + spikes + scenery pre-rendered into world-space tiles (384 world units,
  res = dpr*1.1 clamped 1..2, 2 px overlap against seams), lazy with a budget of 6 tiles/frame, prefetch ring,
  LRU memory cap 72 MB, first frame after a build renders all visible tiles. Missing tiles are drawn as vectors
  with the same world-anchored grain (no pop). Blocks: outline pass (wobbly) then fill pass (exact polygon), so
  touching blocks merge seamlessly; theme surface band (grass/snow/shine), stripes on no-grab (dark) and helper
  (yellow/black), trampoline marks. Moving platforms and crates are cached sprites. Far layer: pale hills /
  peaks / dunes / clouds with 35% parallax.
- `levels/themes.js`: all 10 campaign palettes (ground, edge, top band, ice, far, hazard, water, accent, post,
  scenery set). Lantern Caves has `dark: true` (half-res veil with soft light around players, lanterns, flags, goal).
- `render/scenery.js`: 22 sparse accent kinds (tufts, flowers, bamboo, crystals, lanterns, cacti, pines, columns,
  gears, clouds, embers, bunting...), deterministic, kept away from spawns/flags/goal; "back" items pale and
  behind geometry so they never read as grabbable.
- Characters (`core/characters.js` data, `render/characters.js` sprites): Pip (sprout), Moss (beanie), Bluebell
  (bow), Sunny (propeller cap), Rosie (daisies), Plum (headband). Gloves always blue (L) / red (R), open mitten or
  fist, grip glow. Panel has P1/P2 character pickers; `Level.load(spec, n, chars)`.
- `render/draw-player.js`: tapered quadratic arms that sag when slack and thin when stretched; head sprite with
  landing squash spring, velocity stretch, cosmetic tilt, respawn pop; live face: eyes track aim / gripping hand /
  partner / motion, blinking; expressions idle, grab, strain, fall, win, pop.
- `render/particles.js`: pooled (600) dust on landing, sparkle + ring on checkpoints/respawns, puff on death,
  confetti on completion, bounce puffs; subtle screen shake on hard landings/deaths (config SCREEN_SHAKE).
- Dev: `?theme=<id>` / panel theme picker previews any level in any theme; `tools/serve.py` no-cache server.
Verified: all checks green (physics untouched); every tile of test-all renders in all 10 themes with no errors;
physics is bit-identical with and without rendering/effects between steps (art cannot affect physics); CPU render
cost ~0.4 ms/frame worst case (caves, zoomed out, 300 particles), tiles 25-70 MB.
Known: GPU frame time could not be measured in the hidden preview pane (readback stalls there): check the fps in
the debug overlay on your machine. HUD/title lettering are Phase 5. Faces are drawn, not sprite-cached (cheap).

## Phase 5 — Menus, modes, saves, HUD (done, Sonnet 5)
Flow (keyboard, gamepad and mouse all verified end to end): title -> main (Solo, Co-op, How to play, Settings) ->
character select (P1, then P2 in co-op; P2 can't take P1's character) -> campaigns (10 cards: lock, pips, clean-run
stars) -> levels (locks, check, best time, star, "new") -> play -> level complete (time, best/new best/first clear,
no-fall star, Next / Retry / Levels; last level of a campaign says Next campaign) -> next level. Pause (Esc/P/pad Start,
also automatic when the window loses focus): Resume, Restart, Settings, Levels, Title. Hold R (0.7 s, ring HUD)
restarts; dev: a tap.
- Everything is drawn on the canvas in 1280x720 virtual space, letterboxed: crayon panels (cached wobbly sprites),
  hand-lettered text (`ui/type.js`: original font stack, grain, seeded wobble, cached sprites), theme backdrop with
  drifting clouds and scenery, the DANGLE lettering hanging from a rope with two characters swinging.
- Transitions: 0.34 s slide+fade between screens (input locked for the first half, so nothing double-fires), 0.24 s
  cream wipe on every menu<->game swap (world is built while covered: no pops).
- Input (`core/input.js`): menu actions up/down/left/right/confirm/back/pause with key-repeat, from either keyboard
  scheme, gamepad d-pad/stick/A/B/Start, and mouse hover/click; a key tapped between two polls still counts.
  Device assignment: per player keyboard (auto/WASD+arrows/IJKL/off) and gamepad (auto/1-4/off).
- Settings (saved in localStorage `dangle.v1.settings`, sanitised on load): volume (stored; audio arrives in
  Phase 10), tap-to-grab, grab assist, reduce shake, mouse aim, controls (reference diagrams with live key
  highlight + assignment), erase progress (confirm). Progress in `dangle.v1.progress`: done/best/clean per level id
  per mode. If localStorage is blocked everything works in memory and the title says progress can't be saved.
- Unlocks (`core/storage.js`): levels in order, campaign opens when the previous is fully done, modes independent,
  `?dev=1` unlocks all + overlay/panel + L (next level) + tap-R restart.
- How to play: a real playground level (`howto`: step, pit, wall, flag) with a strip of three animated cards
  (Aim / Grab / Pull), keyboard keycaps that light as you press, and a pad hint. No text walls.
- HUD (`ui/hud.js`): clock, level title during the camera intro, off-screen arrows, co-op player tags above heads,
  hold-R ring, pause button (click).
- `levels/campaigns.js`: the campaign table (5x5 + 5x10 levels = 75 per mode) and ids like `solo-3-2`. Every id
  without an authored definition gets a generated PLACEHOLDER built from the campaign's signature mechanics
  (deterministic; Frozen Peaks has vertical climbs), so all 150 slots are playable and lint/smoke-clean today.
  Phases 6-9 replace them by registering real definitions under the same ids.
Verified: `node tools/check-all.js` green; lint covers all 153 levels; smoke `--all` (153 levels x 1P/2P: settle,
checkpoint, hazard/fall death + respawn, finish, unload, 20 restarts) passes in ~55 s; progress-test (34 checks:
unlock chain, best time/clean medal, refresh persistence, corrupt saves, blocked storage); in-browser: keyboard-only
and pad-only runs title->finish->next level, mouse-only co-op setup, refresh keeps progress, pause/blur/hold-R,
settings apply, controls reassignment, dev unlock, portrait/landscape letterbox, no console errors.
Known: placeholder levels are for flow/testing only (not tuned, several solvability aids unverified); volume slider
has no effect until Phase 10; the preview pane's screenshots lag one action behind, so frames were forced with
`Dangle.debug.tick(dt)`.

## Phase 6 — Solo campaigns 1-5, 25 levels (done, Sonnet 5)
Built: `js/levels/solo-campaigns.js` registers `solo-1-1` .. `solo-5-5` (5 levels each) with real definitions; they
replace the placeholders of the same ids. Levels are 18-60 R long (18-29 R meadow, 22-46 bamboo, 23-56 caves, 24-52
salt, 22-60 frozen); the bot's estimate of the time an obstacle-by-obstacle run takes is 35-170 s (a person will be
slower). Each campaign teaches one idea in level 1, combines it in 2-4, and ends on a longer signature level (5).
- 1 Sunny Meadow: small steps, drops, valleys, plain gaps 0.5-0.9R, first wall, first rope (1-4), crate step + helper
  beam gap (1-5). 2 Bamboo Grove: single ropes 1.7-2.0R, rope rows (2 x 1.0-1.1R, 3 x 1.0R), spike floors, beam gaps.
  3 Lantern Caves (dark): short ledges, beam runs over spikes 2.5-4R, ropes, walls. 4 Salt Flats: long spans (3-rope
  rows, 3.5R beam gaps), wind rises 2.5-3.5R, crate steps. 5 Frozen Peaks: ice slopes (3R run, rise 0.6-1.0R) + slick
  shelf, walls up to 3.4R, ropes, beam gaps; big multi-drop finish.
- New: `gap` aid `'beam'` = a striped helper beam over the pit (span <= 3.5R), the "helper beams on tough spots" of the
  spec; `beamRun`'s beam now runs 0.9R past the spikes (a hanging head sits ~50 px behind the hand: the old 0.3R left
  the head over the spikes at the end). `Levels.all()` no longer lists registered levels twice; compiled specs record
  `segments[i].y0/y1` (floor height around each segment; used by the bots). `type.js` skips 0-size sprites (a hidden
  pane threw an error). Placeholder generator aligned with the new limits (rope spacing, wind 2.5-3.5R, slope <= 1R).
- New limits (config.LINT): rope spacing 1.1R for two ropes, 1.0R for three or more; wall 3.5R; wind rise 3.5R;
  ice slope rise <= 1.0R (new SLOPE_MAX); beam gap span 3.5R (new GAP_BEAM_SPAN_MAX); longest beam 5.25R.
  All are bot-verified with a margin (`node tools/segment-bots.js --probe` shows the bot also crosses wall 4R, wind
  4.5R, rope rows 2 x 1.2R and 3 x 1.1R).
- Not used because a bot could not do them: zigzag ledges up a shaft (the head always ends up under the overhang, so
  no 'up' levels in campaign 5: its climbs are tall walls and slopes), `trampolineStep` (a hand can't grip the pad,
  the head barely reaches it), `noGrabClimb`, `mover` gaps, tides (campaigns 6+).
Verification (all in `node tools/check-all.js`, all green):
- `tools/bots.js` scripted one-player policies (generators): crawl, walls/steps, drops, plain gap, rope rows (searched
  release points), beam hang, ice slope, crate + wall. `tools/segment-bots.js`: each obstacle at its limits (28 cases).
  `tools/level-bot.js`: every obstacle of every authored solo level, with that level's exact options, from a standing
  start (25 levels, 225 obstacles); ropes are proven by an isolated search bot per rope layout.
- lint (154 levels, selftest 14 known-bad), smoke (registered + first/last of each campaign), gap bots, camera, saves.
Findings worth knowing: flat ground is a crawl (grip ahead, pull, swap hands) of about 90 px/s for the bot (61 before it
compensated the 0.1 rad hand fan: the free LEFT hand aims 0.1 rad above the stick, the right one below); the planning
figure for tides (LINT.TIDE_SPEED 110) is optimistic, use <= 90 in Phase 7. Rope swings are chaotic: a bot policy that
crosses a gap from one start fails from a slightly different one (different absolute x is enough), so bot proof of
ropes = existence of a crossing from the standard stance, not a guarantee for every player; the pump policy of the bot
barely builds amplitude (found by luck + search), a person will do better or worse. Low steps (0.5-0.9R): hands go up
the face to just above the lip, then over onto the top, then heave (mantle when a grip is within 22 px of the lip).
Known / needs your hands: rope timing and how hard ropes are for a human (the levels lean on them in campaign 2 and as
gaps everywhere), beam hanging over spikes (clearance ~20 px under the beam), ice slope feel, crate steps (about 5 s),
overall length of the signature levels (56-60 R). Zigzag/up levels are still unproven for Phase 7 or later.

## Phase 7 — Solo campaigns 6-10, 50 levels (done, Sonnet 5)
Built: `js/levels/solo-campaigns-2.js` registers `solo-6-1` .. `solo-10-10` (10 levels each). All 75 authored solo levels
now exist; only the 75 co-op slots are still placeholders. Levels are 17-103 R long with 4-22 obstacles (bot estimate
21-190 s), chained with little ground between (short landings, tight routes); levels 5 and 10 of each campaign are the
mid-boss and the finale. `solo-campaigns.js` now exports its shorthands as `Levels.dsl` for the second file.
- 6 Tidal Ruins: tides you outrun on flat ground, then tides you climb out of (tide + wall), between ropes, beam gaps,
  crates. 7 Clockwork Works: sliding bridges (3-8R), lifts (2.5-6R), with ropes, beams, crates. 8 Sky Islands:
  springboards (drop onto a pad, get thrown up a wall of 1.6-3.2R), wind rises, ropes with short landings, big drops.
  9 Ember Depths: lava-floored pits, lava tides, wind rises beside NO-GRAB wall faces, ice slopes, 0.9R landings.
  10 The Big Dangle: all of it (the finale is 103R, 22 obstacles).
- New segments/options (all bot-proven, lint rules added): `tide{len,h,kind}` (h > 0 ends the stretch with a wall to climb
  before the water reaches you; water speed planned at 1.35x the crossing time from `Dangle.tideCross`), `lift{h,period}`
  (a platform up a shaft beside a wall, up to 6R, with 0.5R standing room before it), `bounce{drop,h}` (walk off the
  ledge onto a springboard at the foot of a wall; replaces the unplayable `trampolineStep`), `windRise{nograb:true}`
  (no-grab face panel: only the wind lifts you, the lip stays grabbable), `gap aid:'mover'` widened to 1.8R platform.
  Movers/lifts rest at each end (`dwell`, share of the cycle; `REST_S` = 1.8 s to step on and off) and glide slowly enough
  for the rider (`platformTiming`: peak acceleration <= 0.7 x head grip; the level's period is only a minimum, so
  a lift of 4R has a period of 8 s, 6R 10 s+). Lint rejects a platform accelerating > 0.8 x head grip.
  `crateStep` crate is now mass 14 (a climbing hand dragged the light one off the wall). Checkpoint flags sit on short
  landings (`gap` markSafe adjusts for land < 1.2R).
- Limits (config.LINT): TIDE_SPEED 85 (was 110; bot crawls ~90), TIDE_CLIMB_BASE/PER_R 2.5/2.2 s (wall at the end of a
  tide), BOUNCE_H_MAX 3.2 (bot manages 4.6), BOUNCE_DROP 0.8..1.4, LIFT_H_MAX 6, TRAMP_RISE_MAX 3.2.
- Tools: `bots.js` got tide, mover, lift, bounce and float (wind + no-grab) policies; `segment-bots.js` is 45 cases
  (was 28); `level-bot.js` covers all 75 authored solo levels; `check-all.js` label is 'level bot (authored solo)'.
  Bot fixes worth knowing: start a climb from a clean grip (`letGo`), mantle when a grip is within 22 px of the lip,
  keep grips for crate climbs (`keepGrip`), board a moving bridge from 25 px away and start crawling forward on it
  early (the head slides to the rear), stance for drops/bounces 70 px before the edge (a short landing is 0.9R).
- Not used (bot could not do them): zigzag 'up' levels, `noGrabClimb`/stair stubs (heads get trapped under stubs),
  bounce with a no-grab wall (the head falls back onto the ledge), a plain gap or crates directly after an ice shelf
  (slippery approach: levels put a ledge between).
Verification: `node tools/check-all.js` green (lint 154 levels + selftest, segment bots 45, level bot 75 levels, smoke incl.
`--all` 153 levels, gap bots, stress, camera, saves); all 50 new levels load in the browser with no console errors.
Known / needs your hands: Rope timing again (used in every campaign), how tight the 0.9R landings and 3-rope rows feel,
boarding moving bridges and lifts (about 1.8 s to step on), the length of the finales (72-103R), tides in 6-10 (bot
estimates are lower bounds: a person crawls slower and thinks), lava tide visuals.

## Phase 8 — Co-op mode + co-op campaigns 1-5, 25 levels (done, Opus 5.5)
Built: `js/levels/coop-campaigns.js` registers `coop-1-1` .. `coop-5-5` (22-84 R, 3-17 obstacles; bot estimate 43-206 s).
Every co-op level has 2+ obstacles one player can't pass alone (lint), mixed with the campaign's solo obstacles:
1 Meadow teaches plates/gates, the heavy crate and the lift; 2 Bamboo chains of friends + ropes; 3 Caves gates and lifts
in the dark with beams; 4 Salt heavy crates, wind, long spans; 5 Frozen lifts up icy walls. Level 5 of each is longer.
Co-op mechanics (new `js/physics/devices.js` + `js/levels/segments-coop.js`, rule-driven on purpose: two players heaving on
each other is chaotic, so what makes a device need a partner is a rule you can read):
- Hold-open gate (`gate{dist,h}`): a no-grab portcullis lifts into its tower while a head is on a plate 3R+ away; a second
  plate beyond lets the partner through. Closing never crushes: a platform never moves down/sideways into a head.
- Counterweight lift (`leverLift{h}`): hang on a grab handle (a rope from a pulley, drawn behind) and the partner's
  platform rises up a no-grab wall (110 px/s); a handle on top, 3R from the edge, brings the first one up. The platform
  rests flush in a slot (a 32 px step is taller than a head can roll over).
- Two-player heavy crate (`heavyCrate{h,run}`): slides (80 px/s) only while two different players grip it and push the
  stick the same way, along its track to a no-grab wall (1.7-1.9R); climb it, then the wall. Distinct look (dark wood,
  iron bands, two handholds).
- Chain bridge (`gap aid:'chain'`, 1.9-2.0R pit): one hangs off the lip leaning out, the other grabs their head, climbs
  over and reaches the far lip; the one left behind drops and comes back beside the partner.
- Dropped: boost throws (a partner as a ladder got the climber's hand only to 1.46R, a lone player standing reaches 1.18R:
  not worth a mechanic, no reliable heave) and pulley-rope counterweights (replaced by the lift above).
Why these numbers (bots: tools/coop-bots.js, tools/coop-solo-swing.js): a lone player's hand reaches 1.18R up a no-grab
wall (so co-op walls >= 1.6R); a lone player swinging off the lip crosses 1.6R in 11/80 release timings, 2.0R in 1/80,
2.1R+ in 0/80 (so chain gaps are 1.9-2.0R, over spikes/lava); the two-player chain crosses 1.9-2.0R in ~13-18 s.
Also fixed a real bug: respawning beside a partner never worked on flat ground (the free-spot probe, radius 26 at head
height, always touched the floor): now tested 6 px higher; `level-smoke.js` checks it for every level with 2 players.
Other: device drawing (behind the ground: `DrawWorld.devices`), plates in `draw-level.js` (light up when pressed),
handles as striped bars, `test-coop` level (every device; `?level=test-coop&players=2`), the placeholder generator gives
co-op slots 6-10 a gate + one more co-op obstacle, config (HEAVY_CRATE_SPEED 80, COOP_LIFT_SPEED 110; LINT GAP_COOP_MAX
3.4 -> 2.0, CHAIN_MIN 1.9, COOP_PLATE_MIN 3, COOP_WALL_MIN 1.6, COOP_CRATE_RUN_MIN 1.8).
Verification (all in `node tools/check-all.js`, green): lint 155 levels (+ 6 new known-bad co-op cases: gate in a solo
level, plate too close, one co-op obstacle only, chain soloable, crate too close, co-op gap in solo), co-op bots (13
two-player crossings + 3 one-player-can't rule checks), level bot over all 101 authored levels (co-op obstacles with two
bots, the rest with one), smoke `--all` (devices open/close on their plates, a heavy crate won't move for one, partner
respawn). All 25 co-op levels load in the browser with 2 players and no console errors.
Soft-locks: gates have plates on both sides, lifts have handles at both ends, crates can't leave their track, and a player
left behind (or who falls) comes back beside a partner who is grounded 1R+ past the checkpoint; both falling = both back
at the checkpoint. Hold R restarts in any case.
Known / needs your hands: the chain bridge is physics (the bots search 32 climber timings/aims, and it only became
reliable once the anchor leans out firmly; people will find their own rhythm, but it may feel fiddly); gate/lift waits
are ~1-2 s; gate towers are tall (the camera shows them only up close); the co-op pace on one keyboard.

## Phase 9 — Co-op campaigns 6-10, 50 levels (done, Sonnet 5)
Built: `js/levels/coop-campaigns-2.js` registers `coop-6-1` .. `coop-10-10` (21-131 R, 3-25 obstacles; bot estimate
38-296 s). Every one of the 150 campaign level ids (solo 1-10 + co-op 1-10) is now an authored definition; the
placeholder generator in `campaigns.js` is unreferenced for real play (kept for Phase 11 to remove, since a registered
def always wins over `find`'s stub fallback). Co-op mechanics are unchanged from Phase 8 (gate, leverLift, heavyCrate,
chain gap); this phase combines them with the Phase 7 solo mechanics (tide, mover, wind rise, bounce, no-grab shafts)
and pushes their own ranges further, all bot-verified first (`tools/coop-bots.js`, quick extra checks before
authoring): lever lift up to 5.5R (the platform carries you all the way up, no wall climb at the top, so height alone
never adds difficulty the way a climbable wall does), gate plate distance up to 6R, heavy crate wall up to 2.2R
(2.5R fails: the crate-then-wall climb runs out); levels stay a margin under each. Chain gaps stay 1.9-2.0R, now over
spikes, lava or water (the fall is the same hazard death regardless of floor).
- 6 Tidal Ruins: tides bracket gates, lifts and chains (rising water as backdrop tension, not a new synchronised
  mechanic: a tide never has to be "held off" by a gate, that would need a new device). 7 Clockwork Works: sliding
  bridges and lifts next to the co-op devices, often back to back. 8 Sky Islands: springboards and wind woven with
  chains and gates, big drops. 9 Ember Depths: lava tides, lava-floored chains, no-grab wind shafts (`nog`). 10 The
  Big Dangle: all of it; 10-10 is the biggest level yet (131R, 25 obstacles, both bots estimate ~5 minutes).
- `coop-campaigns.js` now also exports `Levels.dslCoop` (`gate/lever/heavy/chain`) alongside solo's `Levels.dsl`, so
  the second co-op file only needs to import both.
- One lint gap found and fixed while authoring: the first level of each new campaign only had one co-op obstacle
  (its intro gate/chain) - the "2+ co-op obstacles" rule (Phase 8) caught all four immediately; each got a second,
  gentle one (a small chain, heavy crate, or gate) rather than loosening the rule.
Verification (`node tools/check-all.js`, green): lint 155 defs (unchanged known-bad set: no new rules needed, Phase 8's
already cover chain/gate/lift/crate limits and the "2+ obstacles" count), level bot over all 151 authored levels (150
campaign + test-coop; co-op obstacles run through two bots, everything else through one, as in Phases 6-8), smoke
`--all` on all 150 campaign levels (clean unload, partner respawn, device open/close, one-player-can't-move-a-crate).
All 50 new levels load in the browser with 2 players and no console errors.
Known / needs your hands: same caveats as Phases 6-8 (nobody has played any of this by hand yet); 10-10 in particular
is long enough that its pace on one keyboard is worth checking; lever lifts above ~4R make for a long ride with
nothing to do but wait, worth a feel check.

## Phase 10 — Audio, juice, and full QA (done, Sonnet 5)
Built: `js/core/audio.js`, a self-contained synthesized Web Audio module (`Dangle.Audio`), no audio files. Oscillator
and filtered-noise one-shots with short gain envelopes: grab thump, release whoosh, a rate-limited stretch creak
(only while a grip is held past `AUDIO_CREAK_STRETCH` = 0.88, at most every `AUDIO_CREAK_COOLDOWN` = 1.3 s per
player), a landing thud scaled by impact, a hazard/death crunch, a soft revive chime, a trampoline bounce "boing", a
two-note checkpoint chime, a four-note goal jingle, and three UI sounds (move/confirm/back). The AudioContext is
created only after a real user gesture (pointerdown/keydown/touchstart, once) per browser autoplay rules, and is
suspended/resumed with tab blur/focus (`js/game.js`) so nothing plays or queues up while the tab is hidden. Volume
(already in Settings since Phase 5) now actually does something via `Dangle.Audio.setVolume`.
- Wiring: `physics/grab.js` now pushes `grab`/`release` events (guarded by `W.level`, so headless tools and the
  sandbox are unaffected) onto the same `W.level.events` queue Fx already drains; `js/game.js` calls
  `Dangle.Audio.consume(W)` right alongside `Fx.consume(W)`, same frame, so a checkpoint's sparkle and its chime (for
  example) are always in sync. Landing and the creak are triggered from `render/draw-player.js`, which already
  computes the impact and stretch values for the matching visual (squash, dust). UI sounds hook two places only:
  `ui/menus.js`'s `moveSel` (a tick only when the selection actually changes) and `Menu.update` (confirm/back/click),
  so no screen file needed touching.
- "Juice pass": squash-and-stretch, camera easing, respawn pop and confetti were already tuned in Phase 4 and found
  in good shape; this phase's juice work was mostly making the new audio land on the same frame as those existing
  visual beats, rather than retuning visuals that weren't broken.
- Full QA (this phase's other half): `node tools/level-smoke.js --all` clean on all 150 levels (unchanged from
  Phase 9). Physics/render cost measured live in the browser on the two heaviest levels: solo-10-10 (131R, single
  player) steps at ~0.16-0.2 ms and renders at ~0.10 ms per frame (113 fps observed); coop-10-10 (2 players) is
  lighter still. A 10-simulated-minute continuous session and a 60x rapid-restart loop on coop-10-10 both show flat
  heap and stable body/constraint counts (Node, `--expose-gc`): no leak. Resize, blur/focus, and localStorage-disabled
  all exercised live in the browser with no console errors; refreshing mid-level cleanly restarts that same level
  (the game was never designed to resume mid-level across a refresh, only campaign progress persists).
- **Bug found and fixed**: gamepad hot-plug testing (a synthetic `gamepadconnected`/`gamepaddisconnected` without a
  `.gamepad` payload) crashed `core/input.js` (`Cannot read properties of undefined (reading 'index')`). Real browsers
  always attach `.gamepad` to these events, so this was never reachable from genuine hardware, but the guard
  (`if (e.gamepad) ...`) is one line and removes even a theoretical crash; verified fixed with a correctly-shaped
  synthetic event afterward, and with a real hot-plug/unplug next to the user's DualSense if you get the chance.
- Wrote a draft `README.md` (what it is, controls, campaign table, project layout, dev checks, credits). Phase 11
  finalizes it (screenshots, license, "inspired by" note already there).
Verification: `node tools/check-all.js` green (unchanged suite; grab.js's new event pushes didn't affect any of the
151 authored-level bot runs or the smoke tests, which exercise grabbing constantly). Sound triggers were confirmed to
fire without throwing during real, gesture-driven browser play (grabs, deaths, menu navigation, settings), including
through resize/blur/focus/localStorage-disabled; the actual audio *balance* (are the levels right, is anything too
loud or too quiet) could not be judged by ear here and needs the user's playtest — `AUDIO_MASTER_TRIM` in config.js
and the individual sound gains in audio.js are the two places to retune.
Known / needs your hands: exact audio levels and character (this is the first time anyone, human or otherwise, will
actually hear it); whether the creak/grab sounds feel right during fast climbing (lots of grabs in quick succession);
gamepad hot-plug with real hardware; the game itself, end to end, per the confirmation gate below.

## Phase 10 — Audio, juice, and full QA (done, Sonnet 5)
Built: `js/core/audio.js`, a self-contained synthesized Web Audio module (`Dangle.Audio`), no audio files. Oscillator
and filtered-noise one-shots with short gain envelopes: grab thump, release whoosh, a rate-limited stretch creak
(only while a grip is held past `AUDIO_CREAK_STRETCH` = 0.88, at most every `AUDIO_CREAK_COOLDOWN` = 1.3 s per
player), a landing thud scaled by impact, a hazard/death crunch, a soft revive chime, a trampoline bounce "boing", a
two-note checkpoint chime, a four-note goal jingle, and three UI sounds (move/confirm/back). The AudioContext is
created only after a real user gesture (pointerdown/keydown/touchstart, once) per browser autoplay rules, and is
suspended/resumed with tab blur/focus (`js/game.js`) so nothing plays or queues up while the tab is hidden. Volume
(already in Settings since Phase 5) now actually does something via `Dangle.Audio.setVolume`.
- Wiring: `physics/grab.js` now pushes `grab`/`release` events (guarded by `W.level`, so headless tools and the
  sandbox are unaffected) onto the same `W.level.events` queue Fx already drains; `js/game.js` calls
  `Dangle.Audio.consume(W)` right alongside `Fx.consume(W)`, same frame, so a checkpoint's sparkle and its chime (for
  example) are always in sync. Landing and the creak are triggered from `render/draw-player.js`, which already
  computes the impact and stretch values for the matching visual (squash, dust). UI sounds hook two places only:
  `ui/menus.js`'s `moveSel` (a tick only when the selection actually changes) and `Menu.update` (confirm/back/click),
  so no screen file needed touching.
- "Juice pass": squash-and-stretch, camera easing, respawn pop and confetti were already tuned in Phase 4 and found
  in good shape; this phase's juice work was mostly making the new audio land on the same frame as those existing
  visual beats, rather than retuning visuals that weren't broken.
- Full QA (this phase's other half): `node tools/level-smoke.js --all` clean on all 150 levels (unchanged from
  Phase 9). Physics/render cost measured live in the browser on the two heaviest levels: solo-10-10 (131R, single
  player) steps at ~0.16-0.2 ms and renders at ~0.10 ms per frame (113 fps observed); coop-10-10 (2 players) is
  lighter still. A 10-simulated-minute continuous session and a 60x rapid-restart loop on coop-10-10 both show flat
  heap and stable body/constraint counts (Node, `--expose-gc`): no leak. Resize, blur/focus, and localStorage-disabled
  all exercised live in the browser with no console errors; refreshing mid-level cleanly restarts that same level
  (the game was never designed to resume mid-level across a refresh, only campaign progress persists).
- **Bug found and fixed**: gamepad hot-plug testing (a synthetic `gamepadconnected`/`gamepaddisconnected` without a
  `.gamepad` payload) crashed `core/input.js` (`Cannot read properties of undefined (reading 'index')`). Real browsers
  always attach `.gamepad` to these events, so this was never reachable from genuine hardware, but the guard
  (`if (e.gamepad) ...`) is one line and removes even a theoretical crash; verified fixed with a correctly-shaped
  synthetic event afterward, and with a real hot-plug/unplug next to the user's DualSense if you get the chance.
- Wrote a draft `README.md` (what it is, controls, campaign table, project layout, dev checks, credits). Phase 11
  finalizes it (screenshots, license, "inspired by" note already there).
Verification: `node tools/check-all.js` green (unchanged suite; grab.js's new event pushes didn't affect any of the
151 authored-level bot runs or the smoke tests, which exercise grabbing constantly). Sound triggers were confirmed to
fire without throwing during real, gesture-driven browser play (grabs, deaths, menu navigation, settings), including
through resize/blur/focus/localStorage-disabled; the actual audio *balance* (are the levels right, is anything too
loud or too quiet) could not be judged by ear here and needs the user's playtest — `AUDIO_MASTER_TRIM` in config.js
and the individual sound gains in audio.js are the two places to retune.
Known / needs your hands: exact audio levels and character (this is the first time anyone, human or otherwise, will
actually hear it); whether the creak/grab sounds feel right during fast climbing (lots of grabs in quick succession);
gamepad hot-plug with real hardware; the game itself, end to end, per the confirmation gate below.
