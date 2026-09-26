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
