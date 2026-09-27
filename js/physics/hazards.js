// Level rules that run every physics step: hazards, rising tides, checkpoints, the goal,
// wind columns, trampolines and the death/respawn flow. State lives in W.level (see loader.js).
window.Dangle = window.Dangle || {};

(function () {
  const M = Matter;
  const cfg = () => Dangle.config;
  const P = () => Dangle.Player;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function circleRect(cx, cy, r, x, y, w, h) {
    const dx = cx - clamp(cx, x, x + w);
    const dy = cy - clamp(cy, y, y + h);
    return dx * dx + dy * dy < r * r;
  }
  function inRect(px, py, x, y, w, h) { return px >= x && px <= x + w && py >= y && py <= y + h; }

  // Current water/lava surface of a rising tide (px, y grows downward).
  function tideTop(L, r) {
    if (r.t0 === null) return r.startY;
    return Math.max(r.endY, r.startY - r.speed * (L.t - r.t0));
  }

  // Apply wind before the engine step. Force is mass-proportional (an acceleration), so a whole
  // player, or a crate, is lifted uniformly and the arms feel no extra tension.
  function preStep(W) {
    const L = W.level;
    if (!L.winds.length) return;
    const k = Dangle.World.FORCE_K;
    for (const z of L.winds) {
      for (const p of W.players) {
        if (p.dead) continue;
        for (const b of p.bodies) {
          if (inRect(b.position.x, b.position.y, z.x, z.y, z.w, z.h)) {
            b.force.x += b.mass * z.ax * k;
            b.force.y += b.mass * z.ay * k;
          }
        }
      }
      for (const b of L.crates) {
        if (inRect(b.position.x, b.position.y, z.x, z.y, z.w, z.h)) {
          b.force.x += b.mass * z.ax * k;
          b.force.y += b.mass * z.ay * k;
        }
      }
    }
  }

  // Is the player standing on (or resting against the top of) something solid?
  function grounded(W, q) {
    const list = W.engine.pairs.list;
    for (let i = 0; i < list.length; i++) {
      const pr = list[i];
      if (!pr.isActive) continue;
      if (pr.bodyA !== q.head && pr.bodyB !== q.head) continue;
      const other = pr.bodyA === q.head ? pr.bodyB : pr.bodyA;
      if (!other.isStatic) continue;
      let ny = pr.collision.normal.y;
      if (ny * (q.head.position.y - other.position.y) < 0) ny = -ny;   // toward the head
      if (ny < -0.6) return true;                                       // surface faces up
    }
    return false;
  }

  const probe = M.Bodies.circle(0, 0, 26);
  function spotFree(W, x, y) {
    M.Body.setPosition(probe, { x, y });
    for (const b of W.drawables) {
      if (!b.isStatic || !M.Bounds.overlaps(b.bounds, probe.bounds)) continue;
      if (M.Collision.collides(b, probe)) return false;
    }
    return true;
  }

  function progress(L, x, y) { return L.spec.direction === 'up' ? -y : x; }

  // Where a dead player comes back: beside a grounded partner who is well ahead of the
  // checkpoint (and the spot is free), otherwise at the checkpoint.
  function respawnPoint(W, p) {
    const L = W.level;
    const c = cfg();
    const cp = L.checkpoint >= 0 ? L.spec.checkpoints[L.checkpoint].spawns[p.index % 2] : L.spec.spawns[p.index % 2];
    const need = progress(L, cp.x, cp.y) + c.PARTNER_SPAWN_LEAD * c.REACH;
    for (const q of W.players) {
      if (q === p || q.dead) continue;
      const h = q.head.position;
      if (progress(L, h.x, h.y) < need || !grounded(W, q)) continue;
      const off = 2 * c.HEAD_RADIUS + 12;
      // Test (and use) a spot a little above the partner's head height: a head resting on the floor is exactly one
      // radius above it, so a probe at the same height (radius 26 > 24) would always touch the floor.
      for (const dx of [off, -off]) {
        if (spotFree(W, h.x + dx, h.y - 6)) return { x: h.x + dx, y: h.y - 6, partner: true };
      }
    }
    return { x: cp.x, y: cp.y, partner: false };
  }

  function postStep(W, dt) {
    const L = W.level;
    const c = cfg();
    L.t += dt;
    let anyInput = false;
    let inGoal = 0;
    let alive = 0;

    for (const p of W.players) {
      if (p.dead) {
        p.deadT -= dt;
        if (p.deadT <= 0) {
          const at = respawnPoint(W, p);
          P().revive(W, p, at.x, at.y);
          for (const r of L.risers) r.t0 = null;      // the tide drains while someone is being brought back
        }
        continue;
      }
      if (Math.abs(p.input.aimX) + Math.abs(p.input.aimY) > 0.2 || p.input.grab[0] || p.input.grab[1]) anyInput = true;
      const hx = p.head.position.x;
      const hy = p.head.position.y;
      const hr = c.HEAD_RADIUS * 0.85;

      let cause = null;
      for (const h of L.hazards) {
        const hit = h.type === 'water' ? inRect(hx, hy, h.x, h.y, h.w, h.h) : circleRect(hx, hy, hr, h.x, h.y, h.w, h.h);
        if (hit) { cause = h.type; break; }
      }
      if (!cause) {
        for (const r of L.risers) {
          if (r.t0 === null && hx > r.trigger0 && hx < r.trigger1) r.t0 = L.t;
          if (hx > r.x0 && hx < r.x1 && hy > tideTop(L, r)) { cause = r.type; break; }
        }
      }
      if (cause) { P().die(W, p, cause); continue; }
      alive++;

      for (let i = L.checkpoint + 1; i < L.spec.checkpoints.length; i++) {
        const cp = L.spec.checkpoints[i];
        if (inRect(hx, hy, cp.x - cp.w / 2, cp.y - cp.h, cp.w, cp.h)) {
          L.checkpoint = i;
          L.events.push({ type: 'checkpoint', index: i, x: cp.x, y: cp.y });
        }
      }
      const g = L.spec.goal;
      if (inRect(hx, hy, g.x, g.y, g.w, g.h)) inGoal++;
    }

    if (anyInput && !L.started) { L.started = true; L.startT = L.t; }
    if (!L.complete && alive > 0 && alive === W.players.length && inGoal === alive) {
      L.complete = true;
      L.completeT = L.t;
      L.time = L.t - L.startT;
      L.events.push({ type: 'complete', time: L.time });
    }

    // Trampolines: a head or crate touching the top face bounces.
    if (L.trampolines) {
      const list = W.engine.pairs.list;
      for (let i = 0; i < list.length; i++) {
        const pr = list[i];
        if (!pr.isActive) continue;
        const a = pr.bodyA;
        const b = pr.bodyB;
        const tramp = a.dg && a.dg.kind === 'trampoline' ? a : b.dg && b.dg.kind === 'trampoline' ? b : null;
        if (!tramp) continue;
        const o = tramp === a ? b : a;
        if (o.isStatic || !o.dg || (o.dg.kind !== 'head' && o.dg.kind !== 'crate')) continue;
        if (o._bounceAt !== undefined && W.time - o._bounceAt < 0.2) continue;
        if (o.position.y > tramp.position.y) continue;                 // only from above
        const vy = P().velY(o);
        const launch = Math.max(c.TRAMPOLINE_LAUNCH, vy * c.TRAMPOLINE_KEEP);
        P().setVel(o, P().velX(o), -launch);
        // The whole player leaves the pad together, or the hands' fall would drag the head back down.
        if (o.dg.kind === 'head') for (const h of o.dg.owner.hands) P().setVel(h, P().velX(h), -launch);
        o._bounceAt = W.time;
        L.events.push({ type: 'bounce', x: o.position.x, y: tramp.position.y });
      }
    }
  }

  Dangle.Hazards = { preStep, postStep, tideTop, respawnPoint, grounded, circleRect, inRect };
})();
