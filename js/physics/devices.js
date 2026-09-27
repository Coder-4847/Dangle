// Co-op devices: rule-driven things that need two players (Phase 8). Deterministic on purpose: the physics of two
// players heaving on each other is chaotic, so what makes a device need a partner is a rule you can read:
//   plates   pressed while a living player's head (or a crate) is inside the zone.
//   handles  grab bars (static 'handle' blocks); pulled while a living player has a hand pinned to one.
//   driven   platforms (gates, lifts) that glide from their rest pose (u = 0) to their open pose (u = 1) while any
//            of their plates is pressed or any of their handles is held, and back when released. They never move
//            into a player: a closing gate or a sinking lift waits until the way is clear (no crushing, no jitter).
//   heavy    crates too heavy for one: they slide along their track only while two different players grip them and
//            both push the stick the same way.
// State lives on the Matter bodies (dg.device / dg.heavy) and in W.level.devices / plates / heavies (see loader.js).
window.Dangle = window.Dangle || {};

(function () {
  const M = Matter;
  const cfg = () => Dangle.config;
  const inRect = (px, py, x, y, w, h) => px >= x && px <= x + w && py >= y && py <= y + h;
  const smooth = (u) => u * u * (3 - 2 * u);
  const v2 = { x: 0, y: 0 };

  function pressed(W, plate) {
    for (const p of W.players) {
      if (!p.dead && inRect(p.head.position.x, p.head.position.y, plate.x, plate.y, plate.w, plate.h)) return true;
    }
    for (const c of W.level.crates) if (inRect(c.position.x, c.position.y, plate.x, plate.y, plate.w, plate.h)) return true;
    return false;
  }

  function held(W, body) {
    for (const p of W.players) {
      if (p.dead) continue;
      if ((p.grab[0].pin && p.grab[0].target === body) || (p.grab[1].pin && p.grab[1].target === body)) return true;
    }
    return false;
  }

  // Would moving a platform to (x, y) (centre) push into a living player's head that is ahead of it: below it when it
  // sinks, in front of it when it slides? Rising is never blocked (it carries riders up). Hands are light and get
  // nudged aside harmlessly (and a gripping hand always touches its platform), so only heads count.
  function blocked(W, b, x, y) {
    const hw = b.dg.size.w / 2 + 1, hh = b.dg.size.h / 2 + 1;
    const mx = x - b.position.x, my = y - b.position.y;
    const r = cfg().HEAD_RADIUS;
    for (const p of W.players) {
      if (p.dead) continue;
      const q = p.head.position;
      const dx = Math.max(Math.abs(q.x - x) - hw, 0);
      const dy = Math.max(Math.abs(q.y - y) - hh, 0);
      if (dx * dx + dy * dy >= r * r) continue;
      if ((my > 0 && q.y - y > hh * 0.5) || (mx !== 0 && (q.x - x) * Math.sign(mx) > hw * 0.5)) return true;
    }
    return false;
  }

  // Move a kinematic static body to (x, y) with a matching velocity (so friction carries heads and pins carry hands).
  function place(b, x, y, dt) {
    const m = b.dg.mover;
    m.vx = (x - b.position.x) / dt;
    m.vy = (y - b.position.y) / dt;
    v2.x = x; v2.y = y;
    M.Body.setPosition(b, v2, true);
  }

  function preStep(W) {
    const L = W.level;
    if (!L || (!L.devices.length && !L.heavies.length)) return;
    const dt = cfg().STEP;
    for (const pl of L.plates) pl.on = pressed(W, pl);
    for (const d of L.devices) {
      const b = d.body;
      let on = false;
      for (const i of d.plates) if (L.plates[i].on) on = true;
      for (const h of d.handles) if (held(W, h)) on = true;
      d.on = on;
      const target = on ? 1 : 0;
      const u = d.u;
      if (u !== target) {
        const step = dt / d.time;
        const nu = target > u ? Math.min(target, u + step) : Math.max(target, u - step);
        const e = smooth(nu);
        const x = d.bx + d.dx * e, y = d.by + d.dy * e;
        // Never push into someone: the gate or lift waits until the way is clear.
        if (!blocked(W, b, x, y)) { place(b, x, y, dt); d.u = nu; continue; }
      }
      b.dg.mover.vx = 0; b.dg.mover.vy = 0;
    }
    for (const h of L.heavies) {
      const b = h.body;
      let n = 0, dir = 0, agree = true;
      for (const p of W.players) {
        if (p.dead || !((p.grab[0].pin && p.grab[0].target === b) || (p.grab[1].pin && p.grab[1].target === b))) continue;
        const s = Math.abs(p.input.aimX) > 0.3 ? Math.sign(p.input.aimX) : 0;
        if (!s || (dir && s !== dir)) agree = false;
        dir = dir || s;
        n++;
      }
      h.movers = n;
      let vx = 0;
      if (n >= 2 && agree) vx = dir * cfg().HEAVY_CRATE_SPEED;
      let x = Math.max(h.x0, Math.min(h.x1, b.position.x + vx * dt));
      if (x !== b.position.x && blocked(W, b, x, b.position.y)) x = b.position.x;
      place(b, x, b.position.y, dt);
    }
  }

  Dangle.Devices = { preStep, pressed, held };
})();
