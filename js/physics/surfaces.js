// Builders for the world's solid things. Every static piece is at least 24 px thick
// (thin geometry tunnels), and each gets a `kind` that drawing and rules key off.
window.Dangle = window.Dangle || {};

(function () {
  const M = Matter;
  const reg = (W, b, kind, o) => Dangle.World.register(W, b, kind, o);

  // Static rectangle given by its top-left corner (or, with opts.angle, its centre-preserving
  // rotation in radians). kind: 'ground' | 'ice' (grabbable, slick for players) | 'helper'
  // (grabbable beam) | 'noGrab' (hands slide off) | 'trampoline' (bounces, not grabbable).
  function block(W, x, y, w, h, kind, opts) {
    kind = kind || 'ground';
    opts = opts || {};
    const noGrab = kind === 'noGrab';
    const b = M.Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
      isStatic: true,
      // Matter's "static" friction fully cancels slow sliding below a threshold that scales with
      // the pair's max frictionStatic; keep it low or heads stick-slip crawl up walls.
      friction: noGrab || kind === 'ice' ? 0.03 : 1,
      frictionStatic: noGrab || kind === 'ice' ? 0.03 : 0.2,
      restitution: 0,
    });
    if (opts.angle) M.Body.setAngle(b, opts.angle);
    reg(W, b, kind, { grabbable: !noGrab && kind !== 'trampoline', size: { w, h } });
    if (kind === 'ice') b.dg.slick = true;
    return b;
  }

  // Pushable, grabbable box. Its centre is at (x, y).
  function crate(W, x, y, size, mass) {
    const b = M.Bodies.rectangle(x, y, size, size, { friction: Dangle.config.CRATE_FRICTION, frictionStatic: 0.2, restitution: 0, frictionAir: 0.01 });
    M.Body.setMass(b, mass);
    return reg(W, b, 'crate', { size: { w: size, h: size } });
  }

  // Hanging rope from a fixed point. Segments are grabbable but collide with nothing,
  // so players pass through them and grab by touch. Returns the rope record.
  function rope(W, x, y, segments, spacing, segMass) {
    const bodies = [];
    for (let i = 0; i < segments; i++) {
      const b = M.Bodies.circle(x, y + spacing * (i + 0.5), 7, {
        collisionFilter: { category: 0x0008, mask: 0 },
        frictionAir: 0.02,
      });
      M.Body.setMass(b, segMass);
      reg(W, b, 'ropeSeg', { hidden: true });
      bodies.push(b);
    }
    const link = (a, b, pa, pb, len) => Dangle.World.addConstraint(W, M.Constraint.create({
      bodyA: a, bodyB: b, pointA: pa, pointB: pb, length: len, stiffness: 1, damping: 0.02,
    }));
    // Fixed top: bodyB omitted means a world-space point.
    Dangle.World.addConstraint(W, M.Constraint.create({
      bodyA: bodies[0], pointA: { x: 0, y: -spacing / 2 }, pointB: { x, y }, length: 0, stiffness: 1, damping: 0.02,
    }));
    for (let i = 0; i < segments - 1; i++) {
      link(bodies[i], bodies[i + 1], { x: 0, y: spacing / 2 }, { x: 0, y: -spacing / 2 }, 0);
    }
    const r = { anchor: { x, y }, bodies, spacing };
    (W.ropes = W.ropes || []).push(r);
    return r;
  }

  // Static block that glides back and forth by (dx, dy) with eased ends. Moved by us every
  // step with a matching velocity, so friction carries heads and pins carry hands.
  function mover(W, x, y, w, h, path) {
    const b = block(W, x, y, w, h, path.kind || 'ground');
    b.dg.mover = { vx: 0, vy: 0, bx: b.position.x, by: b.position.y, dx: path.dx || 0, dy: path.dy || 0, period: path.period || 4, phase: path.phase || 0 };
    b._px = b.position.x; b._py = b.position.y; b._pa = 0;
    W.dynamic.push(b);                // interpolated like a dynamic body
    (W.movers = W.movers || []).push(b);
    return b;
  }

  const v2 = { x: 0, y: 0 };
  function preStep(W) {
    if (!W.movers) return;
    const t = W.time + Dangle.config.STEP;
    for (const b of W.movers) {
      const m = b.dg.mover;
      const u = (1 - Math.cos(2 * Math.PI * (t / m.period + m.phase))) / 2;
      v2.x = m.bx + m.dx * u; v2.y = m.by + m.dy * u;
      m.vx = (v2.x - b.position.x) / Dangle.config.STEP;   // px/s, for head friction
      m.vy = (v2.y - b.position.y) / Dangle.config.STEP;
      M.Body.setPosition(b, v2, true);
    }
  }

  // Rope "long-range attachment": segment i can never be further from the anchor than the
  // rope length above it. Heavy loads can't stretch a rope, whatever the solver does.
  function postStep(W) {
    if (!W.ropes) return;
    const P = Dangle.Player;
    for (const r of W.ropes) {
      for (let i = 0; i < r.bodies.length; i++) {
        const b = r.bodies[i];
        const max = (i + 0.5) * r.spacing;
        const dx = b.position.x - r.anchor.x;
        const dy = b.position.y - r.anchor.y;
        const d = Math.hypot(dx, dy);
        if (d <= max) continue;
        const nx = dx / d;
        const ny = dy / d;
        v2.x = r.anchor.x + nx * max; v2.y = r.anchor.y + ny * max;
        M.Body.setPosition(b, v2);
        const vx = P.velX(b);
        const vy = P.velY(b);
        const out = vx * nx + vy * ny;
        if (out > 0) P.setVel(b, vx - out * nx, vy - out * ny);
      }
    }
  }

  Dangle.Surfaces = { block, crate, rope, mover, preStep, postStep };
})();
