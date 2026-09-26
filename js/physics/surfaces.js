// Builders for the world's solid things. Every static piece is at least 24 px thick
// (thin geometry tunnels), and each gets a `kind` that drawing and rules key off.
window.Dangle = window.Dangle || {};

(function () {
  const M = Matter;
  const reg = (W, b, kind, o) => Dangle.World.register(W, b, kind, o);

  // Static rectangle given by its top-left corner. kind: 'ground' (grabbable) | 'noGrab'.
  function block(W, x, y, w, h, kind) {
    kind = kind || 'ground';
    const noGrab = kind === 'noGrab';
    const b = M.Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
      isStatic: true,
      friction: noGrab ? 0.03 : 1,
      frictionStatic: noGrab ? 0.03 : 1,
      restitution: 0,
    });
    return reg(W, b, kind, { grabbable: !noGrab, size: { w, h } });
  }

  // Pushable, grabbable box. Its centre is at (x, y).
  function crate(W, x, y, size, mass) {
    const b = M.Bodies.rectangle(x, y, size, size, { friction: 0.5, frictionStatic: 0.7, restitution: 0, frictionAir: 0.01 });
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
    const r = { anchor: { x, y }, bodies };
    (W.ropes = W.ropes || []).push(r);
    return r;
  }

  Dangle.Surfaces = { block, crate, rope };
})();
