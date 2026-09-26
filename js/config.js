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

  // --- Camera (sandbox-level; Phase 3 extends) ---
  CAM_MIN_W: 1000,          // world units always visible horizontally
  CAM_MIN_H: 640,
  CAM_MARGIN: 260,
  CAM_SMOOTH: 5,            // 1/s follow speed
};
