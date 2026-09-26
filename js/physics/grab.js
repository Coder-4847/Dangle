// Grab system: pins a hand to whatever it touches while grab is held.
// Forgiveness (essential for feel): a press buffer, contact "coyote" memory, and a
// tolerance ring slightly bigger than the hand.
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
      lastBody: null,     // last contact, remembered for coyote grabs
      lastX: 0, lastY: 0, // that contact's anchor, relative to lastBody
      contact: null,      // body touched this step (debug / glow)
      sensor: null,       // tolerance-ring body used for overlap tests (never added to the world)
      sensorR: 0,
    };
  }

  function tolerance() {
    const c = cfg();
    return c.ASSIST ? c.GRAB_TOLERANCE_ASSIST : c.GRAB_TOLERANCE;
  }

  // Deepest grabbable overlap of the hand's tolerance ring. Returns {body, depth, nx, ny} or null.
  const best = { body: null, depth: 0, nx: 0, ny: 0 };
  function findContact(W, p, hand, g) {
    const tol = tolerance();
    const r = cfg().HAND_RADIUS + tol;
    if (!g.sensor || g.sensorR !== r) {
      g.sensor = M.Bodies.circle(0, 0, r);
      g.sensorR = r;
    }
    const sensor = g.sensor;
    M.Body.setPosition(sensor, hand.position);
    best.body = null;
    best.depth = 0;
    const list = W.grabbables;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b === hand || (b.dg.owner === p)) continue;         // never grab yourself
      if (!M.Bounds.overlaps(b.bounds, sensor.bounds)) continue;
      const col = M.Collision.collides(b, sensor);
      if (col && col.depth > best.depth) {
        best.body = b;
        best.depth = col.depth;
        best.nx = col.normal.x;
        best.ny = col.normal.y;
      }
    }
    if (!best.body) return null;
    // Collision normals aren't consistently oriented; point it from the hand toward the surface.
    const tx = best.body.position.x - hand.position.x;
    const ty = best.body.position.y - hand.position.y;
    if (best.nx * tx + best.ny * ty < 0) { best.nx = -best.nx; best.ny = -best.ny; }
    return best;
  }

  function pinTo(W, g, hand, body, ax, ay) {
    g.pin = M.Constraint.create({
      bodyA: hand, pointA: { x: 0, y: 0 },
      bodyB: body, pointB: { x: ax - body.position.x, y: ay - body.position.y },
      length: 0,
      stiffness: cfg().PIN_STIFFNESS,
      damping: 0,
    });
    g.target = body;
    Dangle.World.addConstraint(W, g.pin);
  }

  function release(W, g) {
    if (!g.pin) return;
    M.Composite.remove(W.mworld, g.pin);
    g.pin = null;
    g.target = null;
    g.wantT = 0;       // a release must not instantly re-grab through the press buffer
    g.coyoteT = 0;
    g.lastBody = null;
  }

  function updateHand(W, p, i, dt) {
    const c = cfg();
    const g = p.grab[i];
    const hand = p.hands[i];
    const held = p.input.grab[i];

    if (g.pin) {
      if (!held) release(W, g);
      g.held = held;
      g.contact = g.target;
      return;
    }

    // Press buffer: holding keeps it topped up, releasing lets it drain (a quick tap still counts).
    if (held) g.wantT = c.GRAB_BUFFER; else g.wantT = Math.max(0, g.wantT - dt);
    g.held = held;
    g.coyoteT = Math.max(0, g.coyoteT - dt);

    const hit = findContact(W, p, hand, g);
    g.contact = hit ? hit.body : null;
    let anchorBody = null;
    let ax = 0;
    let ay = 0;

    if (hit) {
      // Snap onto the surface: the ring reaches (tol - depth) px past the hand's own edge.
      const gap = Math.max(0, tolerance() - hit.depth);
      ax = hand.position.x + hit.nx * gap;
      ay = hand.position.y + hit.ny * gap;
      anchorBody = hit.body;
      // Remember it in the target's frame so a moment later it still works.
      g.lastBody = hit.body;
      g.lastX = ax - hit.body.position.x;
      g.lastY = ay - hit.body.position.y;
      g.coyoteT = c.GRAB_COYOTE;
    } else if (g.wantT > 0 && g.coyoteT > 0 && g.lastBody) {
      const wx = g.lastBody.position.x + g.lastX;
      const wy = g.lastBody.position.y + g.lastY;
      if (Math.hypot(wx - hand.position.x, wy - hand.position.y) <= (c.HAND_RADIUS + tolerance()) * 2.5) {
        anchorBody = g.lastBody; ax = wx; ay = wy;
      }
    }

    if (anchorBody && g.wantT > 0) pinTo(W, g, hand, anchorBody, ax, ay);
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

  Dangle.Grab = { newState, update, releaseAll, releaseTargeting, describe, tolerance };
})();
