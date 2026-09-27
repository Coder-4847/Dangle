// Grab system: pins a hand to whatever it touches while grab is held.
// Forgiveness (essential for feel): a press buffer, contact "coyote" memory, and a
// tolerance ring slightly bigger than the hand. New grips *reel* the hand onto the
// anchor over a few steps instead of snapping, so grabbing never kicks anything.
window.Dangle = window.Dangle || {};

(function () {
  const M = Matter;
  const cfg = () => Dangle.config;

  function newState() {
    return {
      pin: null,          // Matter constraint while gripping
      target: null,       // body currently gripped
      held: false,        // input (after toggle processing) on the previous step
      wantT: 0,           // press buffer countdown (s)
      coyoteT: 0,         // time left to still use the last contact (s)
      lastBody: null,     // last contact, remembered for coyote grabs...
      lastLX: 0, lastLY: 0, // ...as an anchor in that body's local (rotating) frame
      contact: null,      // body touched this step (debug / glow)
    };
  }

  function tolerance() {
    const c = cfg();
    return c.ASSIST ? c.GRAB_TOLERANCE_ASSIST : c.GRAB_TOLERANCE;
  }

  // Closest point on a convex body's surface to (px, py), allocation-free.
  // Fills out.x/y (surface point), out.nx/ny (outward normal) and out.dist (<0 = inside).
  const pt = { x: 0, y: 0 };
  function closest(b, px, py, out) {
    if (b.circleRadius) {
      const dx = px - b.position.x;
      const dy = py - b.position.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      out.nx = dx / d; out.ny = dy / d;
      out.x = b.position.x + out.nx * b.circleRadius;
      out.y = b.position.y + out.ny * b.circleRadius;
      out.dist = d - b.circleRadius;
      return out;
    }
    let best = Infinity;
    let inside = false;
    pt.x = px; pt.y = py;
    const parts = b.parts;
    for (let k = parts.length > 1 ? 1 : 0; k < parts.length; k++) {
      const v = parts[k].vertices;
      for (let j = 0; j < v.length; j++) {
        const a = v[j];
        const c = v[(j + 1) % v.length];
        const ex = c.x - a.x;
        const ey = c.y - a.y;
        let t = ((px - a.x) * ex + (py - a.y) * ey) / (ex * ex + ey * ey);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = a.x + ex * t;
        const qy = a.y + ey * t;
        const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
        if (d2 < best) { best = d2; out.x = qx; out.y = qy; }
      }
      if (!inside && M.Vertices.contains(v, pt)) inside = true;
    }
    const d = Math.sqrt(best);
    if (d > 1e-6) { out.nx = (px - out.x) / d; out.ny = (py - out.y) / d; }
    else { const cd = Math.hypot(px - b.position.x, py - b.position.y) || 1; out.nx = (px - b.position.x) / cd; out.ny = (py - b.position.y) / cd; }
    if (inside) { out.nx = -out.nx; out.ny = -out.ny; out.dist = -d; } else out.dist = d;
    return out;
  }

  // Nearest grabbable surface within reach of the hand, or null.
  const probe = { x: 0, y: 0, nx: 0, ny: 0, dist: 0 };
  const best = { body: null, x: 0, y: 0, nx: 0, ny: 0, dist: 0 };
  function findContact(W, p, hand) {
    const R = cfg().HAND_RADIUS + tolerance();
    const hx = hand.position.x;
    const hy = hand.position.y;
    best.body = null;
    best.dist = Infinity;
    const list = W.grabbables;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const own = b.dg.owner;
      if (own === p || (own && own.dead)) continue;          // never grab yourself or the dead
      const bb = b.bounds;
      if (bb.min.x > hx + R || bb.max.x < hx - R || bb.min.y > hy + R || bb.max.y < hy - R) continue;
      closest(b, hx, hy, probe);
      if (probe.dist < best.dist) {
        best.body = b; best.dist = probe.dist;
        best.x = probe.x; best.y = probe.y; best.nx = probe.nx; best.ny = probe.ny;
      }
    }
    return best.body && best.dist <= R ? best : null;
  }

  // Pin the hand so its centre sits at (ax, ay), which moves with `body`. The pin starts at
  // the current distance and reels in (see updateHand) so nothing is yanked.
  function pinTo(W, g, hand, body, ax, ay) {
    g.pin = M.Constraint.create({
      bodyA: hand, pointA: { x: 0, y: 0 },
      bodyB: body, pointB: { x: ax - body.position.x, y: ay - body.position.y },
      length: Math.hypot(hand.position.x - ax, hand.position.y - ay),
      stiffness: cfg().PIN_STIFFNESS,
      damping: 0,
    });
    g.target = body;
    g.lastBody = null;
    Dangle.World.addConstraint(W, g.pin);
    if (W.level) W.level.events.push({ type: 'grab' });
  }

  function release(W, g) {
    if (!g.pin) return;
    M.Composite.remove(W.mworld, g.pin);
    g.pin = null;
    g.target = null;
    g.wantT = 0;       // a release must not instantly re-grab through the press buffer
    g.coyoteT = 0;
    g.lastBody = null;
    if (W.level) W.level.events.push({ type: 'release' });
  }

  function updateHand(W, p, i, dt) {
    const c = cfg();
    const g = p.grab[i];
    const hand = p.hands[i];
    const held = p.input.grab[i];

    if (g.pin) {
      if (!held) release(W, g);
      else if (g.pin.length > 0) g.pin.length = Math.max(0, g.pin.length - c.GRAB_REEL * dt);
      g.held = held;
      g.contact = g.target;
      return;
    }

    // Press buffer: holding keeps it topped up, releasing lets it drain (a quick tap still counts).
    if (held) g.wantT = c.GRAB_BUFFER; else g.wantT = Math.max(0, g.wantT - dt);
    g.held = held;
    g.coyoteT = Math.max(0, g.coyoteT - dt);

    const hit = findContact(W, p, hand);
    g.contact = hit ? hit.body : null;
    if (hit) {
      // Anchor = where the hand centre sits when just touching the surface.
      const ax = hit.x + hit.nx * c.HAND_RADIUS;
      const ay = hit.y + hit.ny * c.HAND_RADIUS;
      if (g.wantT > 0) { pinTo(W, g, hand, hit.body, ax, ay); return; }
      // Remember it in the body's rotating frame, so a press a moment later still lands.
      const b = hit.body;
      const cs = Math.cos(-b.angle);
      const sn = Math.sin(-b.angle);
      const dx = ax - b.position.x;
      const dy = ay - b.position.y;
      g.lastBody = b;
      g.lastLX = cs * dx - sn * dy;
      g.lastLY = sn * dx + cs * dy;
      g.coyoteT = c.GRAB_COYOTE;
    } else if (g.wantT > 0 && g.coyoteT > 0 && g.lastBody) {
      const b = g.lastBody;
      const cs = Math.cos(b.angle);
      const sn = Math.sin(b.angle);
      const ax = b.position.x + cs * g.lastLX - sn * g.lastLY;
      const ay = b.position.y + sn * g.lastLX + cs * g.lastLY;
      if (Math.hypot(ax - hand.position.x, ay - hand.position.y) <= (c.HAND_RADIUS + tolerance()) * 2.5) {
        pinTo(W, g, hand, b, ax, ay);
      }
    }
  }

  function update(W, p, dt) {
    updateHand(W, p, 0, dt);
    updateHand(W, p, 1, dt);
  }

  function releaseAll(W, p) {
    release(W, p.grab[0]);
    release(W, p.grab[1]);
  }

  // Drop every pin (from any player) that is holding one of these bodies, e.g. before a respawn.
  function releaseTargeting(W, bodies) {
    for (const q of W.players) {
      for (const g of q.grab) {
        if (g.pin && bodies.indexOf(g.target) !== -1) release(W, g);
      }
    }
  }

  function describe(g) {
    if (g.pin) return 'pinned:' + g.target.dg.kind;
    if (g.wantT > 0) return g.contact ? 'contact' : 'wanting';
    return g.contact ? 'touching' : 'free';
  }

  Dangle.Grab = { newState, update, releaseAll, releaseTargeting, describe, tolerance, closest };
})();
