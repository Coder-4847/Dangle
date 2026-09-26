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

  // --- World ---
  GRAVITY: 1000,            // px/s^2
  KILL_Y: 1500,             // falling past this respawns the player
  WORLD_LIMIT: 6000,        // |x| or |y| beyond this = out of bounds

  // --- Player body (level distances should be expressed relative to REACH) ---
  HEAD_RADIUS: 24,
  HAND_RADIUS: 11,
  REACH: 130,               // full-stick arm length
  HEAD_MASS: 6,
  HAND_MASS: 2,             // hands can't be too light or the arm spring gets stiff-unstable
  HEAD_FRICTION: 0.9,
  HEAD_FRICTION_STATIC: 1.4,
  HAND_FRICTION: 1.0,
  HEAD_AIR_DRAG: 0.003,
  HAND_AIR_DRAG: 0.03,
  HEAD_UPRIGHT: 40,         // rad/s^2 per rad: torque that keeps the face tilted only a little
  HEAD_ANG_DAMP: 6,         // 1/s angular damping so the head doesn't spin forever

  // --- Arms (vector spring between head and hand) ---
  ARM_FREQ: 13,             // rad/s stiffness of the aim spring
  ARM_DAMP: 0.7,            // damping ratio
  ARM_FORCE_CAP: 1.6,       // max pull per arm, in head weights
  ARM_SPREAD: 0.3,          // radians the two hands fan apart around the aim direction
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
  TOGGLE_GRAB: false,       // tap to grab, tap to release
  ASSIST: false,            // bigger grab tolerance

  // --- Safety clamps (px/s) ---
  MAX_HEAD_SPEED: 2200,
  MAX_HAND_SPEED: 2600,

  // --- Camera (sandbox-level; Phase 3 extends) ---
  CAM_MIN_W: 1000,          // world units always visible horizontally
  CAM_MIN_H: 640,
  CAM_MARGIN: 260,
  CAM_SMOOTH: 5,            // 1/s follow speed
};
