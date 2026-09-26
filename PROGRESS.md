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
