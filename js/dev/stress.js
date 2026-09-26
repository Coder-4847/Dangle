// Physics stress tests with pass/fail thresholds. Each scenario scripts the inputs per step.
// Run all headless: `node tools/sim-test.js` or open index.html?stress=1.
// Watch one live: index.html?stress=<name>.
window.Dangle = window.Dangle || {};

(function () {
  const cfg = () => Dangle.config;
  const P = () => Dangle.Player;
  const S = () => Dangle.Surfaces;
  const vx = (b) => Dangle.Player.velX(b);
  const vy = (b) => Dangle.Player.velY(b);
  const speed = (b) => Math.hypot(vx(b), vy(b));
  const LOOKS = [{ head: '#f2a03d', dark: '#b8691a' }, { head: '#5fc4a8', dark: '#2f8a72' }];

  function set(p, ax, ay, l, r) { p.input.aimX = ax; p.input.aimY = ay; p.input.grab[0] = !!l; p.input.grab[1] = !!r; }
  function player(W, i, x, y) { return P().create(W, i, x, y, LOOKS[i]); }
  function teleport(b, x, y) { Dangle.World.teleport(b, x, y); }
  function ground(W, x0, x1, y) { S().block(W, x0, y, x1 - x0, 120, 'ground'); }
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  const f1 = (v) => v.toFixed(1);
  const f0 = (v) => v.toFixed(0);

  // Mechanical energy of some bodies, in units of (total mass * g * REACH).
  function energy(bodies) {
    const g = cfg().GRAVITY;
    let e = 0, m = 0;
    for (const b of bodies) { e += 0.5 * b.mass * (vx(b) ** 2 + vy(b) ** 2) - b.mass * g * b.position.y; m += b.mass; }
    return e / (m * g * cfg().REACH);
  }
  // Swing pump: stick halfway between "against the motion" and "toward the grip". The gripping
  // arm then shoves the head along the swing while keeping the arm loaded (no inelastic snap
  // at the bottom). Found by a policy sweep: ~830 px/s and full loops within a few seconds.
  function pump(p, l, r) {
    const v = speed(p.head);
    const g = p.grab[0].pin ? p.hands[0] : p.hands[1];
    const dx = g.position.x - p.head.position.x;
    const dy = g.position.y - p.head.position.y;
    const d = Math.hypot(dx, dy) || 1;
    if (v < 30) { set(p, 1, 0, l, r); return; }
    const ax = -vx(p.head) / v + dx / d;
    const ay = -vy(p.head) / v + dy / d;
    const m = Math.hypot(ax, ay) || 1;
    set(p, ax / m, ay / m, l, r);
  }
  function gripTo(g, bodyKind) { return g.pin && (!bodyKind || g.target.dg.kind === bodyKind); }

  const scenarios = [
    {
      name: 'rest',
      desc: 'Two players stand still: heads must not creep or jitter.',
      seconds: 5,
      build() { const W = Dangle.World.create(); ground(W, -800, 800, 600); player(W, 0, 0, 570); player(W, 1, 100, 570); return W; },
      input(W) { W.players.forEach((p) => set(p, 0, 0)); },
      measure(W, s, t) {
        s.prev = s.prev || W.players.map((p) => ({ x: p.head.position.x, y: p.head.position.y }));
        W.players.forEach((p, i) => {
          const d = Math.hypot(p.head.position.x - s.prev[i].x, p.head.position.y - s.prev[i].y);
          if (t > 2) s.max = Math.max(s.max || 0, d);
          s.prev[i].x = p.head.position.x; s.prev[i].y = p.head.position.y;
        });
      },
      result(W, s) { return { pass: s.max < 0.02, info: `max head move/step ${s.max.toFixed(4)} px` }; },
    },
    {
      name: 'hangEnergy',
      desc: 'Hang from a bar with both hands after a shove, stick neutral: energy may only fall.',
      seconds: 8,
      build() {
        const W = Dangle.World.create(); S().block(W, -100, 0, 200, 24, 'ground'); ground(W, -800, 800, 900);
        const p = player(W, 0, 0, 150); teleport(p.hands[0], -15, 35); teleport(p.hands[1], 15, 35); return W;
      },
      input(W, s, t) {
        const p = W.players[0];
        set(p, 0, 0, true, true);
        if (Math.abs(t - 0.6) < 1e-6 + cfg().STEP / 2) P().setVel(p.head, 500, 0);
      },
      measure(W, s, t) {
        const p = W.players[0];
        if (t > 0.8) { const e = energy(p.bodies); if (s.e0 === undefined) s.e0 = e; s.gain = Math.max(s.gain || 0, e - s.e0); }
        if (!(p.grab[0].pin && p.grab[1].pin) && t > 0.2) s.lost = true;
      },
      result(W, s) { return { pass: s.gain < 0.01 && !s.lost, info: `energy gain ${s.gain.toFixed(4)} (max 0.01)${s.lost ? ', LOST GRIP' : ''}` }; },
    },
    {
      name: 'pumpSwing',
      desc: 'One hand on a bar, pump by pushing against the swing: must swing above the bar.',
      seconds: 7,
      build() {
        const W = Dangle.World.create(); S().block(W, -30, 0, 60, 24, 'ground'); ground(W, -800, 800, 900);
        const p = player(W, 0, 0, 150); teleport(p.hands[1], 0, 35); return W;
      },
      input(W, s, t) { const p = W.players[0]; if (t < 0.5) set(p, 0, 0, false, true); else pump(p, false, true); },
      measure(W, s, t) {
        const p = W.players[0];
        const ang = Math.atan2(Math.abs(p.head.position.x), p.head.position.y - 12) * 180 / Math.PI;
        s.maxAng = Math.max(s.maxAng || 0, ang);
        if (ang >= 90 && s.t90 === undefined) s.t90 = t - 0.5;
        if (!p.grab[1].pin && t > 0.2) s.lost = true;
      },
      result(W, s) {
        return { pass: s.maxAng >= 100 && !s.lost && s.t90 < 4, info: `max angle ${f0(s.maxAng)}\u00b0, reached 90\u00b0 after ${s.t90 === undefined ? 'never' : f1(s.t90) + ' s'} of pumping` };
      },
    },
    {
      name: 'fling',
      desc: 'Pump a one-hand swing, let go just past the bottom: a long, clean flight.',
      seconds: 9,
      build() {
        const W = Dangle.World.create(); S().block(W, -30, 0, 60, 24, 'ground'); ground(W, -1500, 2500, 600);
        const p = player(W, 0, 0, 150); teleport(p.hands[1], 0, 35); return W;
      },
      input(W, s, t) {
        const p = W.players[0];
        if (s.released) { set(p, 0, 0); return; }
        if (t < 0.5) { set(p, 0, 0, false, true); return; }
        pump(p, false, true);
        const ang = Math.atan2(p.head.position.x, p.head.position.y - 12) * 180 / Math.PI;
        s.maxAng = Math.max(s.maxAng || 0, Math.abs(ang));
        const side = Math.sign(vx(p.head));                                   // fling whichever way it swings
        const dir = Math.atan2(-vy(p.head), Math.abs(vx(p.head))) * 180 / Math.PI;   // 0 = level, 90 = up
        if (s.maxAng > 100 && speed(p.head) > 450 && p.head.position.x * side > 0 && p.head.position.y > 12 && dir > 10 && dir < 40) {
          s.side = side;
          s.released = true;
          s.rel = { x: p.head.position.x, y: p.head.position.y, v: speed(p.head), dir, t };
          set(p, 0, 0);
        }
      },
      measure(W, s) {
        const p = W.players[0];
        if (s.released && !s.landed && p.head.position.y > 560) { s.landed = true; s.range = (p.head.position.x - s.rel.x) * s.side; }
      },
      result(W, s) {
        if (!s.released) return { pass: false, info: 'never got a release window' };
        const r = s.rel;
        const level = r.v * r.v * Math.sin(2 * r.dir * Math.PI / 180) / cfg().GRAVITY;  // same-height flight
        const need = 2.5 * cfg().REACH;
        return { pass: s.range >= need, info: `released at ${f0(r.v)} px/s, ${f0(r.dir)}\u00b0 up, after ${f1(r.t)} s; flew ${f0(s.range || 0)} px dropping ${f0(560 - r.y)} (need ${f0(need)}); same-level flight ~${f0(level)} px` };
      },
    },
    {
      name: 'climb',
      desc: 'Hand-over-hand up a 360 px wall (stick up, alternate grabs) and over the top.',
      seconds: 12,
      build() {
        const W = Dangle.World.create(); ground(W, -800, 1200, 600); S().block(W, 0, 240, 500, 360, 'ground');
        player(W, 0, -60, 570); return W;
      },
      input(W, s, t) {
        const p = W.players[0];
        const g = p.grab;
        const H = p.head.position;
        if (s.top) { set(p, 0.5, 0); return; }
        if (H.y < 240 - 4 && H.x > 8) { s.top = true; s.tTop = t; set(p, 0.5, 0); return; }
        // Near the lip: shove down-away so the gripping arms throw the head up and over.
        if ((g[0].pin || g[1].pin) && Math.min(p.hands[0].position.y, p.hands[1].position.y) < 250 && H.y < 330) {
          set(p, -0.7, 0.7, g[0].pin, g[1].pin);
          return;
        }
        // Keep the stick up (a bit into the wall). One hand holds; the other is released, flies
        // up past it, and grabs once it is clearly higher. Then swap.
        if (s.holder === undefined) {
          set(p, 0.55, -1, p.hands[0].position.y < H.y - 60, p.hands[1].position.y < H.y - 60);
          if (g[0].pin || g[1].pin) s.holder = g[0].pin ? 0 : 1;
          return;
        }
        const h = s.holder;
        const r = 1 - h;
        const higher = p.hands[r].position.y < p.hands[h].position.y - 45;
        const grabs = [false, false];
        grabs[h] = true;
        grabs[r] = higher;                              // lower hand lets go, re-grabs once higher
        set(p, 0.55, -1, grabs[0], grabs[1]);
        if (g[r].pin && higher) s.holder = r;           // new holder; the old one lets go next step
        if (!g[h].pin) s.holder = undefined;            // lost the hold: start over
      },
      measure(W, s) { if (s.top && W.players[0].head.position.y > 300) s.fell = true; },
      result(W, s) {
        const p = W.players[0];
        const onTop = p.head.position.y < 240 && p.head.position.x > 0;
        return { pass: onTop && s.tTop < 8 && !s.fell, info: s.tTop ? `on top after ${f1(s.tTop)} s` : `stuck at y=${f0(p.head.position.y)}` };
      },
    },
    {
      name: 'ledgeHeave',
      desc: 'Both hands on a ledge lip, stick down-away: heave the head up onto the ledge.',
      seconds: 4,
      build() {
        const W = Dangle.World.create(); S().block(W, 0, 0, 400, 400, 'ground'); ground(W, -800, 800, 900);
        const p = player(W, 0, -30, 110); teleport(p.hands[0], 8, -11); teleport(p.hands[1], 24, -11); return W;
      },
      input(W, s, t) {
        const p = W.players[0];
        if (t < 0.6) { set(p, 0, 0, true, true); return; }
        if (!s.let && p.head.position.x > 6 && p.head.position.y < -20) { s.let = true; s.tUp = t - 0.6; }
        if (s.let) set(p, 0.3, 0); else set(p, -0.7, 0.7, true, true);
      },
      result(W, s) {
        const p = W.players[0];
        const ok = p.head.position.x > 0 && p.head.position.y < -10;
        return { pass: ok && s.tUp < 1.5, info: s.tUp !== undefined ? `over the lip ${f1(s.tUp)} s after pulling, resting at y=${f0(p.head.position.y)}` : 'never got over' };
      },
    },
    {
      name: 'chain',
      desc: 'P1 on a rope, P2 hangs from P1’s head; pump, then let go of the stick: no energy gain, rope never stretches.',
      seconds: 9,
      build() {
        const W = Dangle.World.create(); ground(W, -1500, 1500, 1200);
        S().rope(W, 0, 0, 10, 33, 1.2);
        const a = player(W, 0, 15, 420); const b = player(W, 1, 15, 560);
        teleport(a.hands[1], 15, 313); teleport(a.hands[0], 15, 330);
        teleport(b.hands[0], 3, 455); teleport(b.hands[1], 27, 455);
        return W;
      },
      input(W, s, t) {
        const [a, b] = W.players;
        set(b, 0, 0, true, true);
        if (t < 0.8 || t > 4) set(a, 0, 0, true, true); else pump(a, true, true);
      },
      measure(W, s, t) {
        const [a, b] = W.players;
        const r = W.ropes[0];
        const bodies = a.bodies.concat(b.bodies, r.bodies);
        const tip = r.bodies[r.bodies.length - 1];
        const stretch = Math.hypot(tip.position.x, tip.position.y) / (9.5 * r.spacing) - 1;
        s.stretch = Math.max(s.stretch || 0, stretch);
        // Chains slosh energy between bodies from step to step, so compare the average energy
        // just after letting go with the average at the end (must not rise), and bound transients.
        if (t > 4.3) {
          const e = energy(bodies);
          if (s.e0 === undefined) { s.e0 = e; s.early = 0; s.late = 0; s.ne = 0; s.nl = 0; }
          s.gain = Math.max(s.gain || 0, e - s.e0);
          if (t < 5.3) { s.early += e; s.ne++; }
          if (t > 7) { s.late += e; s.nl++; }
        }
        if (t > 0.2 && !(b.grab[0].pin || b.grab[1].pin)) s.dropped = true;
        s.peak = Math.max(s.peak || 0, speed(b.head));
      },
      result(W, s) {
        const trend = s.late / s.nl - s.early / s.ne;
        return { pass: trend < 0.005 && s.gain < 0.05 && s.stretch < 0.03 && !s.dropped, info: `energy trend ${trend.toFixed(3)} (must fall), peak transient ${s.gain.toFixed(3)}, rope stretch ${(s.stretch * 100).toFixed(1)}%, P2 peak ${f0(s.peak)} px/s${s.dropped ? ', P2 LOST GRIP' : ''}` };
      },
    },
    {
      name: 'mutual',
      desc: 'Both players grab each other’s heads and thrash randomly for 20 s.',
      seconds: 20,
      build() { const W = Dangle.World.create(); ground(W, -1500, 1500, 600); player(W, 0, 200, 570); player(W, 1, 290, 570); return W; },
      input(W, s, t) {
        const [a, b] = W.players;
        s.rnd = s.rnd || rng(99);
        if (t < 0.3) { set(a, 1, 0); set(b, -1, 0); return; }
        if (t < 0.6) { set(a, 1, 0, true, true); set(b, -1, 0, true, true); return; }
        if (Math.round(t / cfg().STEP) % 30 === 0) for (const p of [a, b]) { const an = s.rnd() * 6.283; set(p, Math.cos(an), Math.sin(an), true, true); }
      },
      measure(W, s) { for (const p of W.players) s.peak = Math.max(s.peak || 0, speed(p.head)); },
      result(W, s) {
        const [a, b] = W.players;
        const gap = Math.hypot(a.head.position.x - b.head.position.x, a.head.position.y - b.head.position.y);
        return { pass: s.peak < 1500 && gap < 400, info: `peak head speed ${f0(s.peak)} px/s, final gap ${f0(gap)} px` };
      },
    },
    {
      name: 'regrab',
      desc: 'Two players mash grab/release every 1-4 steps against a wall and each other.',
      seconds: 12,
      build() {
        const W = Dangle.World.create(); ground(W, -800, 800, 600); S().block(W, 150, 300, 150, 300, 'ground');
        player(W, 0, 90, 570); player(W, 1, 20, 570); return W;
      },
      input(W, s, t) {
        s.rnd = s.rnd || rng(7); s.n = (s.n || 0) + 1;
        for (const p of W.players) {
          if (s.rnd() < 0.4) { p.input.grab[0] = s.rnd() < 0.5; p.input.grab[1] = s.rnd() < 0.5; }
          if (s.n % 24 === 0) { const an = s.rnd() * 6.283; p.input.aimX = Math.cos(an); p.input.aimY = Math.sin(an); }
        }
      },
      measure(W, s) {
        for (const p of W.players) {
          s.peak = Math.max(s.peak || 0, speed(p.head));
          for (const h of p.hands) { s.hn = (s.hn || 0) + 1; if (speed(h) > cfg().MAX_HAND_SPEED * 0.98) s.capped = (s.capped || 0) + 1; }
        }
      },
      result(W, s) {
        const capped = (s.capped || 0) / s.hn;
        return { pass: s.peak < 1400 && capped < 0.002, info: `peak head ${f0(s.peak)} px/s, hands at speed cap ${(capped * 100).toFixed(2)}% of steps` };
      },
    },
    {
      name: 'corner',
      desc: 'Wedged into an inside corner, pushing and grabbing: no sinking, no buzzing.',
      seconds: 8,
      build() { const W = Dangle.World.create(); ground(W, -800, 800, 600); S().block(W, 200, 200, 200, 400, 'ground'); player(W, 0, 170, 570); return W; },
      input(W, s, t) {
        const p = W.players[0];
        if (t < 5) { const k = Math.floor(t / 0.5) % 4; const dirs = [[1, 1], [1, -1], [1, 0.3], [0.2, 1]]; set(p, dirs[k][0], dirs[k][1], k % 2 === 0, k > 1); }
        else set(p, 1, 0.5);
      },
      measure(W, s, t) {
        const p = W.players[0];
        const r = cfg().HEAD_RADIUS;
        const pen = Math.max(p.head.position.x - (200 - r), p.head.position.y - (600 - r), 0);
        s.pen = Math.max(s.pen || 0, pen);
        if (s.prev && t > 6.5) s.jit = Math.max(s.jit || 0, Math.hypot(p.head.position.x - s.prev.x, p.head.position.y - s.prev.y));
        s.prev = { x: p.head.position.x, y: p.head.position.y };
      },
      result(W, s) { return { pass: s.pen < 4 && s.jit < 0.2, info: `max penetration ${f1(s.pen)} px, final buzz ${s.jit.toFixed(3)} px/step` }; },
    },
    {
      name: 'mover',
      desc: 'P1 rides a sliding platform; P2 hangs under a diagonal one: carried smoothly, grips hold.',
      seconds: 9,
      build() {
        const W = Dangle.World.create(); ground(W, -1500, 1500, 800);
        S().mover(W, -100, 400, 200, 30, { dx: 300, period: 3 });
        S().mover(W, 500, 100, 200, 30, { dx: 250, dy: -80, period: 4 });
        const a = player(W, 0, 0, 376); const b = player(W, 1, 600, 250);
        teleport(b.hands[0], 585, 141); teleport(b.hands[1], 615, 141); return W;
      },
      input(W) { const [a, b] = W.players; set(a, 0, 0); set(b, 0, 0, true, true); },
      measure(W, s, t) {
        const [a, b] = W.players;
        const plat = W.movers[0];
        const off = a.head.position.x - plat.position.x;
        if (s.off0 === undefined) s.off0 = off;
        s.drift = Math.max(s.drift || 0, Math.abs(off - s.off0));
        if (a.head.position.y > 420) s.fellA = true;
        if (t > 0.3) {
          for (const g of b.grab) {
            if (!g.pin) { s.dropB = true; continue; }
            const ax = g.target.position.x + g.pin.pointB.x;
            const ay = g.target.position.y + g.pin.pointB.y;
            const h = g.pin.bodyA;
            s.err = Math.max(s.err || 0, Math.hypot(h.position.x - ax, h.position.y - ay));
          }
        }
      },
      result(W, s) {
        return { pass: s.drift < 40 && !s.fellA && !s.dropB && s.err < 3, info: `rider drift ${f0(s.drift)} px, hanger grip error ${f1(s.err)} px${s.fellA ? ', RIDER FELL' : ''}${s.dropB ? ', HANGER DROPPED' : ''}` };
      },
    },
    {
      name: 'heavyRope',
      desc: '16-segment rope with a heavy crate and a player hanging under it, kicked hard.',
      seconds: 8,
      build() {
        const W = Dangle.World.create(); ground(W, -1500, 1500, 1300);
        const r = S().rope(W, 0, 0, 16, 30, 1.2);
        const crate = S().crate(W, 0, 505, 50, 20);
        Dangle.World.addConstraint(W, Matter.Constraint.create({ bodyA: r.bodies[15], pointA: { x: 0, y: 15 }, bodyB: crate, pointB: { x: 0, y: -25 }, length: 0, stiffness: 1 }));
        const p = player(W, 0, 0, 650); teleport(p.hands[0], -12, 541); teleport(p.hands[1], 12, 541);
        return W;
      },
      input(W, s, t) {
        set(W.players[0], 0, 0, true, true);
        if (Math.abs(t - 0.5) < cfg().STEP / 2) P().setVel(W.drawables.find((b) => b.dg.kind === 'crate'), 900, 0);
      },
      measure(W, s) {
        const r = W.ropes[0];
        const tip = r.bodies[15];
        s.stretch = Math.max(s.stretch || 0, Math.hypot(tip.position.x, tip.position.y) / (15.5 * r.spacing) - 1);
        const p = W.players[0];
        if (!(p.grab[0].pin || p.grab[1].pin)) s.dropped = true;
      },
      result(W, s) { return { pass: s.stretch < 0.03 && !s.dropped, info: `rope stretch ${(s.stretch * 100).toFixed(1)}%${s.dropped ? ', PLAYER DROPPED' : ''}` }; },
    },
    {
      name: 'tunnel',
      desc: 'Hands whipped and a head fired at max speed into a 24 px wall: nothing passes through.',
      seconds: 8,
      build() {
        const W = Dangle.World.create(); ground(W, -800, 800, 600); S().block(W, 200, -200, 24, 800, 'ground');
        player(W, 0, 120, 570); player(W, 1, 0, 300); return W;
      },
      input(W, s, t) {
        const [a, b] = W.players;
        set(a, Math.floor(t / 0.2) % 2 ? 1 : -0.2, -0.2);
        set(b, 1, 0);
        if (Math.round(t / cfg().STEP) % 60 === 0) {
          teleport(b.head, 60, 300); teleport(b.hands[0], 40, 320); teleport(b.hands[1], 80, 320);
          for (const bd of b.bodies) P().setVel(bd, 3000, -100);
        }
      },
      measure(W, s) { for (const p of W.players) for (const bd of p.bodies) if (bd.position.x > 212) s.through = (s.through || 0) + 1; },
      result(W, s) { return { pass: !s.through, info: s.through ? `${s.through} body-steps past the wall` : 'nothing got through' }; },
    },
    {
      name: 'grabReliability',
      desc: 'Hands thrown past ropes/edges/walls at 150-2400 px/s with grab held, pressed early (buffer) and late (coyote): every touch must grip.',
      custom: true,
      run() {
        const cases = [];
        const speeds = [150, 400, 800, 1400, 2000, 2400];
        for (const target of ['rope', 'wall', 'edge', 'head']) {
          for (const v of speeds) {
            for (const timing of ['held', 'early', 'late']) {
              const W = Dangle.World.create();
              ground(W, -2000, 2000, 1400);
              let aimAt;
              if (target === 'rope') { const r = S().rope(W, 300, -300, 12, 33, 1.2); aimAt = r.bodies[8]; }
              else if (target === 'wall') { aimAt = S().block(W, 290, -200, 60, 400, 'ground'); }
              else if (target === 'edge') { aimAt = S().block(W, 290, 30, 300, 60, 'ground'); }  // pass just over its top-left corner
              else { const q = player(W, 1, 300, 0); aimAt = q.head; }
              const p = player(W, 0, 0, 0);
              const hand = p.hands[1];
              const ty = target === 'edge' ? 30 - cfg().HAND_RADIUS - 4 : aimAt.position.y;
              // Everything floats (no gravity) so only the grab logic is being tested.
              W.engine.gravity.scale = 0;
              teleport(p.head, 300 - 140, ty); teleport(p.hands[0], 300 - 170, ty); teleport(hand, 300 - 120, ty);
              P().setVel(hand, v, 0); P().setVel(p.head, v, 0); P().setVel(p.hands[0], v, 0);
              let touched = -1, gripped = -1;
              const g = p.grab[1];
              const isNear = () => g.contact && (g.contact === aimAt || (target === 'rope' && g.contact.dg.kind === 'ropeSeg') || (target === 'head' && g.contact.dg.owner === aimAt.dg.owner));
              for (let i = 0; i < 240; i++) {
                let press;
                if (timing === 'held') press = true;
                else if (timing === 'early') press = i >= 0 && i < 3;          // tap ~25 ms, well before contact
                else press = touched >= 0 && i >= touched + Math.round(0.06 / cfg().STEP);  // 60 ms after first touch
                set(p, 0, 0, false, press);
                Dangle.World.step(W);
                if (isNear() && touched < 0) touched = i;
                if (g.pin && gripped < 0) { gripped = i; break; }
              }
              // 'early' taps before the hand has even reached the target only need to count when
              // contact happened within the buffer window.
              // A late press on a rope you fly *through* only counts while the hand is still within
              // coyote range (~2.5 hand+tolerance radii); snatching from further would feel like magic.
              const coyoteRange = (cfg().HAND_RADIUS + cfg().GRAB_TOLERANCE) * 2.5;
              if (timing === 'late' && target === 'rope' && v * 0.06 > coyoteRange) continue;
              const inBuffer = timing !== 'early' || (touched >= 0 && touched * cfg().STEP <= cfg().GRAB_BUFFER);
              if (touched < 0 && timing !== 'early') cases.push(`${target}@${v} ${timing}: never touched`);
              else if (inBuffer && touched >= 0 && gripped < 0) cases.push(`${target}@${v} ${timing}: touched, no grip`);
            }
          }
        }
        return { pass: cases.length === 0, info: cases.length ? cases.slice(0, 6).join('; ') : 'every touch gripped (early/held/late presses, 150-2400 px/s)' };
      },
    },
    {
      name: 'frameRate',
      desc: 'Same timed input at 30/60/144/240 Hz: the outcome must match.',
      custom: true,
      run() {
        // Time-scripted input sampled once per frame (as in the real game), no release: a swing
        // is smooth, so trajectories should agree up to one frame of input latency.
        const paths = {};
        for (const hz of [30, 60, 144, 240]) {
          const W = Dangle.World.create(); S().block(W, -30, 0, 60, 24, 'ground'); ground(W, -1500, 2500, 600);
          const p = player(W, 0, 0, 150); teleport(p.hands[1], 0, 35);
          let time = 0;
          const path = [];
          const st = Dangle.Loop.createStepper({
            frame(dt) { time += dt; set(p, time < 3 ? Math.sin(time * 2 * Math.PI / 1.4) : 0, 0.2, false, true); },
            step() { Dangle.World.step(W); if (W.time >= (path.length + 1) * 0.25 - 1e-9) path.push({ x: p.head.position.x, y: p.head.position.y }); },
          });
          for (let i = 0; i < 4.5 * hz; i++) st.advance(1 / hz);
          paths[hz] = path;
        }
        const dev = (hz) => Math.max(...paths[144].map((q, i) => (paths[hz][i] ? Math.hypot(q.x - paths[hz][i].x, q.y - paths[hz][i].y) : 0)));
        const pass = dev(60) < 25 && dev(240) < 25 && dev(30) < 60;
        return { pass, info: `max path deviation from 144 Hz: ${f0(dev(30))} (30 Hz), ${f0(dev(60))} (60 Hz), ${f0(dev(240))} (240 Hz) px` };
      },
    },
    {
      name: 'lowFps',
      desc: '20 s of random frame hitches (5-300 ms) with two thrashing players.',
      custom: true,
      run() {
        const W = Dangle.World.create(); ground(W, -900, 900, 600); S().block(W, -960, -600, 60, 1300); S().block(W, 900, -600, 60, 1300);
        S().block(W, -900, -600, 1800, 60); S().block(W, -200, 350, 250, 30);
        player(W, 0, -100, 570); player(W, 1, 100, 570);
        const rnd = rng(3);
        let maxSteps = 0, peak = 0;
        const st = Dangle.Loop.createStepper({
          frame() { for (const p of W.players) if (rnd() < 0.2) { const an = rnd() * 6.283; set(p, Math.cos(an), Math.sin(an), rnd() < 0.6, rnd() < 0.6); } },
          step() { Dangle.World.step(W); for (const p of W.players) peak = Math.max(peak, speed(p.head)); },
        });
        for (let t = 0; t < 20;) { const dt = rnd() < 0.15 ? 0.1 + rnd() * 0.2 : 0.005 + rnd() * 0.03; t += dt; st.advance(dt); maxSteps = Math.max(maxSteps, st.lastSteps); }
        const resp = W.players.reduce((n, p) => n + p.respawns, 0);
        return { pass: resp === 0 && maxSteps <= cfg().MAX_STEPS_PER_FRAME && peak <= cfg().MAX_HEAD_SPEED, info: `respawns ${resp}, max steps/frame ${maxSteps}, peak head ${f0(peak)} px/s` };
      },
    },
  ];

  // A stepping session: headless runs call step() to the end; the page calls it from the loop.
  function session(sc) {
    const W = sc.build();
    const s = {};
    let t = 0;
    let nan = 0;
    const sess = {
      W, s, sc, finished: false, result: null,
      get time() { return t; },
      step() {
        if (sess.finished) return;
        sc.input(W, s, t);
        Dangle.World.step(W);
        t += cfg().STEP;
        for (const p of W.players) for (const b of p.bodies) if (!isFinite(b.position.x + b.position.y)) nan++;
        if (sc.measure) sc.measure(W, s, t);
        if (t >= sc.seconds - 1e-9) sess.finish();
      },
      finish() {
        const r = sc.result(W, s);
        const resp = W.players.reduce((n, p) => n + p.respawns, 0);
        if (nan) { r.pass = false; r.info = `NaN x${nan}; ` + r.info; }
        if (resp) { r.pass = false; r.info += `; respawned x${resp}`; }
        sess.result = r;
        sess.finished = true;
      },
    };
    return sess;
  }

  function run(sc) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    let r;
    try {
      if (sc.custom) r = sc.run();
      else { const sess = session(sc); while (!sess.finished) sess.step(); r = sess.result; }
    } catch (e) { r = { pass: false, info: 'EXCEPTION ' + e.message }; }
    r.name = sc.name;
    r.ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return r;
  }

  function runAll() { return scenarios.map(run); }
  function find(name) { return scenarios.find((s) => s.name === name); }

  Dangle.Stress = { scenarios, session, run, runAll, find };
})();
