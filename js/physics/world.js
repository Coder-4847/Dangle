// Physics world: Matter engine + fixed-step driver + interpolation bookkeeping.
// Pure logic (no DOM) so tools/sim-test.js can run it under node.
window.Dangle = window.Dangle || {};

(function () {
  const M = Matter;
  const cfg = () => Dangle.config;

  // Matter measures velocity in px per (1000/60) ms; these convert to/from px/s.
  const PER_SEC = 1000 / M.Common._baseDelta;
  // Force = mass * accel(px/s^2) * 1e-6, because Matter integrates in milliseconds.
  const FORCE_K = 1e-6;

  function create() {
    const engine = M.Engine.create({ enableSleeping: false });
    const W = {
      engine,
      mworld: engine.world,
      dynamic: [],      // bodies drawn with interpolation
      drawables: [],    // everything drawn (static + dynamic)
      grabbables: [],   // bodies a hand may grab
      players: [],
      time: 0,
      stepMs: 0,        // last physics step cost (debug overlay)
    };
    applyConfig(W);
    return W;
  }

  // Re-read config (called after the tuning panel changes something).
  function applyConfig(W) {
    const c = cfg();
    const e = W.engine;
    e.gravity.x = 0;
    e.gravity.y = 1;
    e.gravity.scale = c.GRAVITY * FORCE_K;
    e.positionIterations = c.POS_ITERATIONS;
    e.velocityIterations = c.VEL_ITERATIONS;
    e.constraintIterations = c.CONSTRAINT_ITERATIONS;
    for (const p of W.players) Dangle.Player.applyConfig(p);
  }

  // kind: string used for drawing and rules. opts.grabbable defaults to true.
  function register(W, body, kind, opts) {
    opts = opts || {};
    body.dg = { kind, grabbable: opts.grabbable !== false, owner: opts.owner || null, size: opts.size || null };
    M.Composite.add(W.mworld, body);
    if (!opts.hidden) W.drawables.push(body);
    if (!body.isStatic) {
      W.dynamic.push(body);
      body._px = body.position.x; body._py = body.position.y; body._pa = body.angle;
    }
    if (body.dg.grabbable) W.grabbables.push(body);
    return body;
  }

  function addConstraint(W, constraint) {
    M.Composite.add(W.mworld, constraint);
    return constraint;
  }

  function addPlayer(W, player) {
    W.players.push(player);
    return player;
  }

  // One fixed physics step. Order matters: decide grabs, apply arm forces, integrate, then clamp.
  function step(W) {
    const c = cfg();
    const t0 = performance.now();
    for (let i = 0; i < W.dynamic.length; i++) {
      const b = W.dynamic[i];
      b._px = b.position.x; b._py = b.position.y; b._pa = b.angle;
    }
    for (const p of W.players) {
      Dangle.Grab.update(W, p, c.STEP);
      Dangle.Player.preStep(W, p, c.STEP);
    }
    M.Engine.update(W.engine, c.STEP * 1000);
    for (const p of W.players) Dangle.Player.postStep(W, p, c.STEP);
    W.time += c.STEP;
    W.stepMs = performance.now() - t0;
  }

  // Interpolated pose of a body between the last two physics steps.
  function pose(b, alpha, out) {
    out.x = b._px + (b.position.x - b._px) * alpha;
    out.y = b._py + (b.position.y - b._py) * alpha;
    out.a = b._pa + (b.angle - b._pa) * alpha;
    return out;
  }

  // Teleport without leaving an interpolation smear.
  function teleport(b, x, y) {
    M.Body.setPosition(b, { x, y });
    b._px = x; b._py = y; b._pa = b.angle;
    M.Body.setVelocity(b, { x: 0, y: 0 });
    M.Body.setAngularVelocity(b, 0);
  }

  Dangle.World = { create, applyConfig, register, addConstraint, addPlayer, step, pose, teleport, PER_SEC, FORCE_K };
})();
