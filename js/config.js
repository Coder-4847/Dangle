// All tunable numbers live here. Physics values are starting points (see docs/MASTER_PROMPT.md 5.2-5.3).
window.Dangle = window.Dangle || {};

Dangle.config = {
  BG_COLOR: '#fdf0dc',

  // Fixed physics timestep (seconds) and frame-delta safety limits.
  STEP: 1 / 120,
  MAX_STEPS_PER_FRAME: 5,

  // Player (px). Level distances should be expressed relative to REACH.
  HEAD_RADIUS: 24,
  HAND_RADIUS: 11,
  REACH: 130,
};
