// All tunable numbers live here. Physics values are starting points (see docs/MASTER_PROMPT.md 5.2-5.3).
// Units: pixels, seconds, masses in Matter units. Accelerations are px/s^2.
window.Dangle = window.Dangle || {};

Dangle.config = {
  BG_COLOR: '#fdf0dc',

  // --- Loop / solver ---
  STEP: 1 / 120,            // fixed physics timestep (s)
  MAX_STEPS_PER_FRAME: 5,   // spiral-of-death guard
  MAX_FRAME_DT: 0.1,        // clamp huge frame gaps (tab switch, breakpoints)
  POS_ITERATIONS: 10,
  VEL_ITERATIONS: 8,
  CONSTRAINT_ITERATIONS: 8, // chains of players/ropes need this to stay stiff
  LIMIT_PASSES: 2,          // passes of the post-step arm safety net
  LIMIT_SLOP: 3,            // px of arm over-stretch the solver may leave before the safety net acts

  // --- World ---
  GRAVITY: 1000,            // px/s^2
  KILL_Y: 1500,             // falling past this respawns the player
  WORLD_LIMIT: 6000,        // |x| or |y| beyond this = out of bounds

  // --- Player body (level distances should be expressed relative to REACH) ---
  HEAD_RADIUS: 24,
  HAND_RADIUS: 11,
  REACH: 130,               // full-stick arm length
  HEAD_MASS: 6,
  HAND_MASS: 1,             // light hands reach fast; spring stays stable (omega*dt ~0.27)
  HEAD_GRIP: 0.9,           // head friction on floors, in g (walls are frictionless for players)
  HAND_GRIP: 2.5,           // hand friction on floors, in g: pushing on the floor doesn't skate
  SLICK_GRIP_SCALE: 0.08,   // ice / slick surfaces keep this fraction of the grip
  HEAD_AIR_DRAG: 0.003,
  HAND_AIR_DRAG: 0.03,
  TILT_PER_SPEED: 0.0006,   // cosmetic face lean (rad per px/s of sideways speed)
  TILT_MAX: 0.35,

  // --- Arms (vector spring between head and hand) ---
  ARM_FREQ: 13,             // rad/s stiffness of the aim spring
  ARM_DAMP: 0.7,            // damping ratio
  ARM_FORCE_CAP: 1.9,       // max pull of a gripping arm, in head weights (one arm lifts you)
  FREE_ARM_CAP: 0.45,       // max push of a reaching arm (head weights). Two can't lift the head
                            // (no hand-walking/hopping), and a blocked reach never undoes a hold
  RELAX_CAP: 0.3,           // free arm pull at neutral stick, in head weights
  PINNED_REACH: 0.45,       // gripping arm's aimed length (x REACH): short = real pull-ups
  PINNED_DAMP: 0.25,        // damping ratio of a gripping arm (low keeps swings alive)
  ARM_SPREAD: 0.1,          // radians the hands fan apart around the aim (big = one hand can't reach walls)
  ARM_RELAX: 0.12,          // stiffness multiplier when the stick is neutral (arms dangle)
  ARM_RELAX_X: 34,          // relaxed hand offset from the head (px)
  ARM_RELAX_Y: 30,
  ARM_MAX_STRETCH: 1.25,    // hard limit, as a multiple of REACH
  AIM_DEADZONE: 0.18,

  // --- Grab ---
  GRAB_TOLERANCE: 8,        // px beyond the hand radius that still counts as touching
  GRAB_TOLERANCE_ASSIST: 18,
  GRAB_BUFFER: 0.09,        // s: pressing just before contact still grabs
  GRAB_COYOTE: 0.09,        // s: contact that was just lost still grabs
  PIN_STIFFNESS: 1,
  GRAB_REEL: 700,           // px/s a fresh grip reels the hand onto its anchor (no snap)
  TOGGLE_GRAB: false,       // tap to grab, tap to release
  ASSIST: false,            // bigger grab tolerance

  CRATE_FRICTION: 0.06,     // Matter friction (per-iteration, warm-started: strong). 0.06 = draggable

  // --- Safety clamps (px/s) ---
  MAX_HEAD_SPEED: 2200,
  MAX_HAND_SPEED: 2400,     // < (24px wall + hand diameter)/2 per step: can't tunnel

  // --- Levels (Phase 3) ---
  RESPAWN_DELAY_SOLO: 0.9,  // s between a death and coming back at the last checkpoint
  RESPAWN_DELAY_COOP: 1.5,
  TRAMPOLINE_LAUNCH: 900,   // px/s upward on a fresh bounce (apex ~3.1 REACH)
  TRAMPOLINE_KEEP: 0.9,     // fraction of landing speed kept when it is faster than the launch
  WIND_LIFT: 1.15,          // default wind column lift, in g (net 0.15 g: a gentle float)
  KILL_DEPTH: 700,          // px below the lowest floor where falling players respawn
  CHECKPOINT_SPACING: 5,    // REACH units of safe progress between auto checkpoints
  PARTNER_SPAWN_LEAD: 1,
  HEAVY_CRATE_SPEED: 80,    // px/s a two-player heavy crate slides while both push (co-op, physics/devices.js)
  COOP_LIFT_SPEED: 110,     // px/s a counterweight lift rises while its handle is held    // REACH units a partner must be ahead of the checkpoint to respawn beside them

  // Level linter limits (tools/lint-levels.js). Distances are in REACH units. Each aid's limit is the widest span a
  // scripted player crosses (tools/gap-bots.js, tools/segment-bots.js), kept a little inside what the bots managed
  // (`segment-bots.js --probe` shows the margin). Real people are the final check: PROVISIONAL until playtested.
  LINT: {
    GAP_PLAIN_MAX: 0.9,     // plain pit: reach across, grab, mantle (tools/gap-bots.js: 0.9 works, 1.0 does not)
    GAP_ROPE_MAX: 2.0,      // one pendulum rope over the pit (gap-bots.js crosses 1.7-2.2 with a simple release)
    GAP_ROPES_STEP_MAX: 1.1,    // spacing between two ropes (tools/segment-bots.js crosses 0.9-1.1R, not 1.2R)
    GAP_ROPES3_STEP_MAX: 1.0,   // spacing in a row of three or more (bots cross 0.9-1.0R, not 1.1R)
    GAP_MOVER_MAX: 8,       // moving bridge (timing, not reach, is the limit)
    GAP_COOP_MAX: 2.0,      // chain bridge: one hangs off the lip, the other climbs over (co-op bot crosses 2.0R)
    CHAIN_MIN: 1.9,         // ...and no narrower: a solo lip swing crosses 1.6R often, 2.0R in 1 of 80 timings
    COOP_PLATE_MIN: 3,      // a plate or handle is this far from what it opens: one player can't do both
    COOP_WALL_MIN: 1.6,     // a no-grab wall that needs the partner (a lone player's hand reaches 1.18R up it)
    COOP_CRATE_RUN_MIN: 1.8,   // a heavy crate starts this far from its wall (its top can't reach the lip)
    GAP_BEAM_MAX: 5.25,     // longest overhead beam (beamRun 4R + overhang = 5.2R crossed by the bots)
    GAP_BEAM_SPAN_MAX: 3.5, // pit crossed by hanging from a helper beam (bots cross 1.2-3.5R)
    WIND_RISE_MAX: 3.5,     // height a wind column carries you (bots climb 2.5-3.5R with it, not 4.5R)
    SLOPE_MAX: 1.0,         // ice slope rise over its 3R run (bots climb 0.6-1.0R)
    LIFT_H_MAX: 6,          // height a moving lift carries you (timing, not strength, is the limit)
    TRAMP_RISE_MAX: 3.2,      // height a trampoline bounce clears (apex is ~3.1)
    WALL_SOLO_MAX: 3.5,     // hand-over-hand climbable wall height (segment bots: 3.5R yes, 4R no)
    STEP_UP_MAX: 1.1,       // vertical spacing between stacked ledges (tip to tip, diagonal reach)
    LEDGE_TIP_GAP_MAX: 0.6, // sideways distance between stacked ledge tips
    LEN_MIN: 12, LEN_MAX: 140,  // total level length
    MIN_THICK: 24,          // thinner solids can be tunnelled
    TIDE_SPEED: 85,         // px/s a solo player covers along a tide stretch (planning figure; the bot crawls ~90)
    TIDE_CLIMB_BASE: 2.5,   // s to climb a wall at the end of a tide stretch: this + PER_R x its height in REACH
    TIDE_CLIMB_PER_R: 2.2,
    BOUNCE_H_MAX: 3.2,      // wall above a springboard pad that a bounce clears (apex ~3.1R; bots manage up to 4.6R)
    BOUNCE_DROP: [0.8, 1.4],   // how far the pad may be below the ledge you drop from
  },

  // --- Look ---
  SCREEN_SHAKE: true,       // subtle shake on big impacts (a Settings toggle in Phase 5)

  // --- Camera ---
  CAM_MIN_W: 1000,          // world units always visible horizontally
  CAM_MIN_H: 640,
  CAM_MAX_W: 2000,          // co-op zoom-out limit; beyond it an arrow points at the player
  CAM_MAX_H: 1250,
  CAM_MARGIN: 260,
  CAM_SMOOTH: 5,            // 1/s follow speed
  CAM_LOOKAHEAD: 170,       // px the view leads the players' motion
  CAM_LOOK_SMOOTH: 2.2,     // 1/s lookahead response (slow so it doesn't jitter)
  CAM_INTRO_HOLD: 0.7,      // s the intro rests on the goal
  CAM_INTRO_PAN: 1.8,       // s the intro takes to glide back to the players
};
