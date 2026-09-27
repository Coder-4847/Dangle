// Two-player scripted bots for the co-op obstacles (Phase 8), plus probes that one player alone can NOT do them.
//   node tools/coop-bots.js [name-filter] [--probe]
// A co-op policy is two per-player scripts (generators, like tools/bots.js) run side by side by `both`; they keep in
// step through shared flags in ctx. Each crossing gets BOTH players past the obstacle: the first with the partner's
// help, the second with the first one's help, or (chain gap) by dropping into the pit and coming back beside the
// partner, which is the game's catch-up rule (hazards.js respawnPoint).
// --probe also runs the slow chain-gap solo search (how often a lone player's lip swing gets across).
const B = require('./bots.js');
const { D, R, set, crawlTo, climbWall, STEPS } = B;

function* both(ga, gb) {
  let ra, rb, da = false, db = false;
  for (;;) {
    if (!da) { const r = ga.next(); if (r.done) { da = true; ra = r.value; } }
    if (!db) { const r = gb.next(); if (r.done) { db = true; rb = r.value; } }
    if (da && db) return !!(ra && rb);
    yield;
  }
}
function* wait(p, cond, sec) {
  for (let i = 0; i < (sec || 40) * STEPS; i++) { if (cond()) return true; set(p, 0, 0, false, false); yield; }
  return false;
}
function* hold(p, i, cond, sec) {                        // keep hand i gripping (stick neutral) until cond()
  for (let k = 0; k < (sec || 40) * STEPS; k++) { if (cond()) return true; set(p, 0, 0, i === 0, i === 1); yield; }
  return false;
}
function* letGo(p, n) { for (let i = 0; i < (n || 10); i++) { set(p, 0, 0, false, false); yield; } return true; }

// ---- hold-open gate: A stands on the near plate, B goes through onto the far plate, then A follows ------------------
function gatePolicies(ctx, t) {
  const { a, b, W } = ctx;
  const g = W.level.devices.find((d) => d.role === 'gate' && Math.abs(d.bx - (t.x + 0.3 * R)) < 1);
  const past = t.x + 0.6 * R + 30;
  const farMid = t.far + t.pw / 2, end = t.far + t.pw;
  const A = (function* () {
    if (!(yield* crawlTo({ p: a }, t.near + t.pw / 2 - 10))) return false;
    if (!(yield* wait(a, () => ctx.bOnFar, 40))) return false;
    yield* letGo(a);
    return yield* crawlTo({ p: a }, past + 30);          // through: the partner steps off the far plate after this
  })();
  const Bp = (function* () {
    if (!(yield* crawlTo({ p: b }, t.x - 75))) return false;
    if (!(yield* wait(b, () => g.u === 1, 40))) return false;
    yield* letGo(b);
    if (!(yield* crawlTo({ p: b }, farMid + 20))) return false;
    ctx.bOnFar = true;
    if (!(yield* wait(b, () => a.head.position.x > past, 60))) return false;
    yield* letGo(b);
    yield* crawlTo({ p: b }, end, 5);                     // off the far plate (whatever comes next is another obstacle)
    return true;
  })();
  return both(A, Bp);
}

// ---- counterweight lift: B rides while A hangs on the bottom handle; B then hangs on the top handle for A ---------
function* grabBar(p, bar, x0, y0) {                      // reach up to a handle above the head and hold it
  for (let i = 0; i < 6 * STEPS; i++) {
    const hx = x0 + 0.25 * R - p.head.position.x, hy = y0 + 12 - p.head.position.y, d = Math.hypot(hx, hy) || 1;
    const m = Math.min(1, d / R);
    const g = p.grab[0].pin && p.grab[0].target === bar ? 0 : p.grab[1].pin && p.grab[1].target === bar ? 1 : -1;
    if (g >= 0) return g;
    const near = (h) => Math.abs(h.position.x - (x0 + 0.25 * R)) < 0.4 * R && Math.abs(h.position.y - y0) < 30;   // only the bar, not the floor
    set(p, hx / d * m, hy / d * m, near(p.hands[0]), near(p.hands[1]));
    yield;
  }
  return -1;
}
function liftPolicies(ctx, t) {
  const { a, b, W } = ctx;
  const d = W.level.devices.find((q) => q.role === 'lift' && Math.abs(q.bx - (t.x + (1.3 * R - 26) / 2)) < 1);
  const [hb, ht] = d.handles;
  const topY = t.y - t.h * R;
  const onPlat = (p) => Math.abs(p.head.position.x - d.body.position.x) < 0.5 * R && p.head.position.y < d.body.position.y;
  const A = (function* () {
    if (!(yield* crawlTo({ p: a }, t.bottom + 0.25 * R - 20))) return false;
    yield* letGo(a);
    if (!(yield* wait(a, () => onPlat(b), 60))) return false;
    const gi = yield* grabBar(a, hb, t.bottom, hb.position.y);
    if (gi < 0) return false;
    if (!(yield* hold(a, gi, () => ctx.bUp, 30))) return false;
    yield* letGo(a);
    if (!(yield* wait(a, () => d.u === 0, 30))) return false;
    if (!(yield* crawlTo({ p: a }, t.x + 0.3 * R))) return false;
    yield* letGo(a);
    ctx.aOn = true;
    if (!(yield* wait(a, () => d.u === 1, 30))) return false;
    yield* letGo(a);
    return yield* crawlTo({ p: a }, t.wx + 1.2 * R);
  })();
  const Bp = (function* () {
    if (!(yield* crawlTo({ p: b }, t.x + 0.5 * R))) return false;
    yield* letGo(b);
    if (!(yield* wait(b, () => d.u === 1, 40))) return false;
    if (!(yield* crawlTo({ p: b }, t.top + 0.25 * R - 20))) return false;
    ctx.bUp = true;
    if (!(yield* wait(b, () => ctx.aOn, 60))) return false;
    const gi = yield* grabBar(b, ht, t.top, ht.position.y);
    if (gi < 0) return false;
    if (!(yield* hold(b, gi, () => a.head.position.x > t.wx + R && a.head.position.y < topY, 40))) return false;
    return yield* letGo(b);
  })();
  return both(A, Bp);
}

// ---- heavy crate: both grip its back face and push it to the wall, then each climbs crate + wall ------------------
function* pushCrate(p, crate, x1, ctx, high) {
  const face = () => crate.position.x - crate.dg.size.w / 2;
  const top = () => crate.position.y - crate.dg.size.h / 2;
  const s = {};
  let g = -1;
  for (let i = 0; i < 20 * STEPS && g < 0; i++) {        // get close, then reach for the back face (high or low) and grip it
    g = p.grab[0].pin && p.grab[0].target === crate ? 0 : p.grab[1].pin && p.grab[1].target === crate ? 1 : -1;
    if (g >= 0) break;
    if (p.head.position.x < face() - (high ? 125 : 90)) { B.crawlStep(p, s, 1, 0, 1, 0.1); for (let k = 0; k < 2; k++) if (p.grab[k].pin && p.grab[k].target.dg.owner) p.input.grab[k] = false; }
    else {
      const ty = high ? top() + 22 : top() + crate.dg.size.h * 0.6;
      const dx = face() - p.head.position.x, dy = ty - p.head.position.y, d = Math.hypot(dx, dy) || 1;
      const touch = (h) => Math.abs(h.position.x - face()) < 22 && h.position.y > top() && h.position.y < top() + crate.dg.size.h;
      set(p, dx / d, dy / d, touch(p.hands[0]), touch(p.hands[1]));
    }
    yield;
  }
  if (g < 0) return false;
  for (let k = 0; k < 30 * STEPS; k++) {                 // push: stick toward the wall, keep the grip
    if (crate.position.x >= x1 - 1) { set(p, 0, 0, false, false); return true; }
    set(p, 1, 0, g === 0, g === 1);
    yield;
  }
  return false;
}
function* climbCrateWall(ctx, p, crate, t) {
  const left = crate.position.x - t.size / 2, cTop = crate.position.y - t.size / 2;
  if (!(yield* climbWall({ p }, left, cTop, 1, 0.55, undefined, 8))) return false;
  yield* crawlTo({ p }, t.wx - 24 - 70, 6);              // across the crate top, toward the wall
  // Shuffle up to the wall: grip the crate top under the head, stick back: the head is driven past the grip.
  for (let i = 0; i < 3 * STEPS && p.head.position.x < t.wx - 24 - 32; i++) {
    const g = p.grab[0].pin ? 0 : p.grab[1].pin ? 1 : -1;
    if (g < 0) set(p, 0.1, 0.5, true, true); else set(p, -1, 0.1, g === 0, g === 1);
    yield;
  }
  yield* letGo(p, 4);
  return yield* climbWall({ p }, t.wx, t.y - t.h * R, 1, 0.55, undefined, undefined, { keepGrip: true, lip: true });
}
function heavyPolicies(ctx, t) {
  const { a, b, W } = ctx;
  const h = W.level.heavies.find((q) => Math.abs(q.x0 - t.x) < 1);
  const crate = h.body;
  ctx.pushed = 0;
  // After the push, whoever ended up nearer the crate climbs first; the other waits until they are up.
  const script = (p, q, high) => (function* () {
    if (!(yield* pushCrate(p, crate, h.x1, ctx, high))) return false;
    ctx.pushed++;
    yield* letGo(p, 30);
    if (!(yield* wait(p, () => ctx.pushed === 2, 20))) return false;
    const first = p.head.position.x >= q.head.position.x;
    if (!first && !(yield* wait(p, () => ctx.firstUp, 60))) return false;
    if (!(yield* climbCrateWall(ctx, p, crate, t))) return false;
    if (first) ctx.firstUp = true;
    return yield* crawlTo({ p }, t.wx + (first ? 1.6 : 0.8) * R);
  })();
  return both(script(a, b, false), script(b, a, true));
}

// ---- chain gap: A hangs off the near lip with its head out over the pit; B climbs over A's head to the far lip. -------
// Then A lets go, falls, and comes back beside B (partner respawn).
function chainPolicies(ctx, t) {
  const { a, b } = ctx;
  const tag = (q) => q.pin && !q.target.dg.owner;
  const A = (function* () {
    for (let i = 0; i < 4 * STEPS && !a.grab[1].pin; i++) { set(a, 0.2, 0.45, false, true); yield; }   // grip the lip
    if (!a.grab[1].pin) return false;
    ctx.anchored = true;
    // Lean out firmly (stick down-left: the head is held up-right of the grip, just over the edge, easy to reach),
    // then, once B holds it, push the head further out and keep it up (B's weight hangs on it).
    for (let i = 0; i < 40 * STEPS && !ctx.bAcross; i++) { if (ctx.bOnHead) set(a, -0.8, 0.6, false, true); else set(a, -0.5, 0.5, false, true); yield; }
    if (!ctx.bAcross) return false;
    for (let i = 0; i < 20 * STEPS && !a.dead; i++) { set(a, 0, 0, false, false); yield; }              // let go: fall
    for (let i = 0; i < 6 * STEPS && a.dead; i++) yield;                                                // back beside B
    return !a.dead && a.head.position.x > t.x1;
  })();
  const Bp = (function* () {
    if (!(yield* wait(b, () => ctx.anchored, 10))) return false;
    for (let i = 0; i < (ctx.variant.wait || 1) * STEPS; i++) { set(b, 0, 0, false, false); yield; }   // the timing a pair would feel for
    // Shuffle up behind the anchor: grip the ground under the head, stick back, the head slides forward past the grip.
    for (let i = 0; i < 3 * STEPS && b.head.position.x < t.x - (ctx.variant.stop || 50); i++) {
      const g = b.grab[0].pin ? 0 : b.grab[1].pin ? 1 : -1;
      if (g < 0) set(b, 0.1, 0.5, true, true); else set(b, -1, 0.1, g === 0, g === 1);
      yield;
    }
    yield* letGo(b, 4);
    let ph = 'reach', hi = 1, mt = 0, cs = {};
    for (let i = 0; i < 30 * STEPS; i++) {
      const H = b.head.position;
      if (ph === 'reach') {
        // Aim at the top of A's head (the hand that touches it first grabs; nothing else).
        const dx = a.head.position.x - H.x, dy = a.head.position.y - (ctx.variant.aim || 20) - H.y, d = Math.hypot(dx, dy);
        const near = (h) => Math.hypot(h.position.x - a.head.position.x, h.position.y - a.head.position.y) < 42;
        const g0 = b.grab[0].pin && b.grab[0].target === a.head, g1 = b.grab[1].pin && b.grab[1].target === a.head;
        // The upper (left) hand arcs over the anchor's hand on the lip and lands on the head; the lower one would catch the hand.
        set(b, dx / d, dy / d, !g1 && near(b.hands[0]), ctx.variant.both ? !g0 && near(b.hands[1]) : false);
        if (g0 || g1) { ph = 'over'; ctx.bOnHead = true; hi = g0 ? 0 : 1; }
      } else if (ph === 'over') { set(b, -1, 0.2, hi === 0, hi === 1); if (H.x > a.head.position.x + 10) { ph = 'far'; ctx.bOver = true; } }
      else if (ph === 'far') {
        const dx = t.x1 + 10 - H.x, dy = t.y - 12 - H.y, d = Math.hypot(dx, dy);
        const f = 1 - hi;                                  // the free hand reaches for the far lip
        const ok = b.hands[f].position.x > t.x1 - 25 && b.hands[f].position.y > t.y - 40;
        set(b, dx / d, dy / d, f === 0 ? ok : !tag(b.grab[1]) , f === 1 ? ok : !tag(b.grab[0]));
        if (tag(b.grab[f])) ph = 'mantle';
      } else if (ph === 'mantle') {
        set(b, -0.7, 0.7, tag(b.grab[0]), tag(b.grab[1]));
        if (++mt > 1.5 * STEPS) { ph = 'climb'; cs = {}; }   // gripped low on the far face: climb it hand over hand
      } else B.climbStep(b, cs, t.x1, t.y, 0.55, 1);
      if (H.x > t.x1 + 10 && H.y < t.y - 10) break;
      yield;
    }
    if (!(b.head.position.x > t.x1 + 10)) return false;
    yield* letGo(b);
    yield* crawlTo({ p: b }, t.x1 + 1.1 * R, 8);                                    // clear of the edge (the landing may be short)
    if (b.head.position.x < t.x1 + 0.6 * R) return false;
    for (let i = 0; i < 40; i++) { set(b, 0, 0, false, false); yield; }
    ctx.bAcross = true;
    return yield* wait(b, () => a.dead === false && a.head.position.x > t.x1, 12);
  })();
  return both(A, Bp);
}

const policies = { gate: gatePolicies, lift: liftPolicies, heavy: heavyPolicies, chain: chainPolicies };

// Put both players in front of co-op task t of a compiled level (as a checkpoint respawn would) and run its policy.
// Rope-like chaos: the chain crossing depends on timing, so (like the rope search in bots.js) a few climber timings
// are tried from the same stance; the crossing is proven if one of them works. Other co-op obstacles: one run.
const CHAIN_VARIANTS = [];
for (const both of [false, true]) for (const aim of [20, 8, 32, 44]) for (const off of [68, 80]) for (const stop of [50, 38]) CHAIN_VARIANTS.push({ wait: 1, off, stop, aim, both });
function crossTask(spec, t, maxSec) {
  if (t.type !== 'chain') return crossOnce(spec, t, maxSec, {});
  let r = null;
  for (const v of CHAIN_VARIANTS) { r = crossOnce(spec, t, maxSec, v); if (r.ok) { r.variant = v; return r; } }
  return r;
}
function crossOnce(spec, t, maxSec, variant) {
  const W = D.Level.load(spec, 2);
  const [a, b] = W.players;
  const put = (p, x) => { p.spawn = { x, y: t.y - 27 }; D.Player.respawn(W, p); };
  if (t.type === 'chain') { put(a, t.x - 14); put(b, t.x - (variant.off || 68)); }
  else if (t.type === 'gate') { put(a, t.near - 0.4 * R); put(b, t.near + t.pw + 0.5 * R); }
  else if (t.type === 'lift') { put(a, t.bottom - 0.4 * R); put(b, t.bottom + 1.2 * R); }
  else { put(a, t.x - t.size / 2 - 0.35 * R); put(b, t.x - t.size / 2 - 0.9 * R); }
  for (let i = 0; i < 60; i++) D.World.step(W);
  const ctx = { a, b, W, variant };
  const gen = policies[t.type](ctx, t);
  let r = { ok: false, t: maxSec || 120 };
  for (let n = 0; n < (maxSec || 120) * STEPS; n++) {
    const s = gen.next();
    if (s.done) { r = { ok: !!s.value, t: n / STEPS }; break; }
    D.World.step(W);
    if (process.env.TRACE && n % (+process.env.EVERY || 120) === 0) {
      const tg = (p) => p.grab.map((q) => (q.pin ? (q.target.dg.owner ? 'P' + (q.target.dg.owner.index + 1) + q.target.dg.kind : q.target.dg.kind) : '-')).join(',');
      console.log(`${(n / STEPS).toFixed(1).padStart(5)} A ${a.head.position.x.toFixed(0)},${a.head.position.y.toFixed(0)} ${tg(a)}${a.dead ? ' DEAD' : ''} | B ${b.head.position.x.toFixed(0)},${b.head.position.y.toFixed(0)} ${tg(b)}${b.dead ? ' DEAD' : ''} | dev ${W.level.devices.map((d) => d.u.toFixed(2)).join(',')} in ${a.input.aimX.toFixed(2)},${a.input.aimY.toFixed(2)}/${b.input.aimX.toFixed(2)},${b.input.aimY.toFixed(2)} heavy ${W.level.heavies.map((h) => h.body.position.x.toFixed(0) + '/' + h.movers).join(',')} ${JSON.stringify(Object.keys(ctx).filter((k) => ctx[k] === true || typeof ctx[k] === 'number').map((k) => k + '=' + ctx[k]))}`);
    }
  }
  r.deaths = a.deaths + b.deaths;
  r.flags = Object.keys(ctx).filter((k) => ctx[k] === true);
  D.Level.unload(W);
  return r;
}

module.exports = { crossTask, crossOnce, policies, both };

// ---- the tests ----------------------------------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const probe = args.indexOf('--probe') !== -1;
  const only = args.filter((a) => a !== '--probe')[0];
  const mk = (segs) => D.Levels.compile({ id: 'cb', name: 'cb', theme: 'meadow', direction: 'right', coop: true, seed: 1, segments: [['start', { len: 3 }]].concat(segs, [['goal', {}]]) });
  const tests = [];
  const test = (name, fn, isProbe) => tests.push({ name, fn, isProbe });

  for (const [dist, h] of [[3, 3], [3.2, 3], [4, 2.4]]) test(`gate plate ${dist}R`, () => { const s = mk([['gate', { dist, h }], ['heavyCrate', {}]]); return crossTask(s, s.coopTasks[0]); });
  for (const h of [2.2, 2.6, 3.5]) test(`lever lift ${h}R`, () => { const s = mk([['leverLift', { h }], ['gate', {}]]); return crossTask(s, s.coopTasks[0]); });
  for (const [h, run] of [[1.7, 1.8], [1.9, 2.5], [1.9, 3.5]]) test(`heavy crate wall ${h}R run ${run}R`, () => { const s = mk([['heavyCrate', { h, run }], ['gate', {}]]); return crossTask(s, s.coopTasks[0]); });
  for (const w of [2.0, 2.1]) for (const floor of ['spikes', 'lava']) test(`chain gap ${w}R over ${floor}`, () => { const s = mk([['gap', { w, aid: 'chain', floor, land: 2.5 }], ['gate', {}]]); return crossTask(s, s.coopTasks[0]); });

  // One player alone: the device rules must hold (deterministic), and nothing else gets them past.
  test('solo: gate closes before a lone player reaches it', () => {
    const s = mk([['gate', {}], ['heavyCrate', {}]]); const t = s.coopTasks[0];
    const W = D.Level.load(s, 1); const p = W.players[0];
    p.spawn = { x: t.near + t.pw / 2, y: t.y - 27 }; D.Player.respawn(W, p);
    const g = crawlTo({ p }, t.x + 0.6 * R + 30, 30); let best = 0;
    for (let i = 0; i < 30 * STEPS; i++) { g.next(); D.World.step(W); best = Math.max(best, p.head.position.x); }
    const opened = W.level.devices[0].u; D.Level.unload(W);
    return best < t.x - 10 && opened === 0 ? { ok: true, t: 0 } : { ok: false, t: 0 };
  });
  test('solo: a lift does not rise with its rider alone', () => {
    const s = mk([['leverLift', {}], ['gate', {}]]); const t = s.coopTasks[0];
    const W = D.Level.load(s, 1); const p = W.players[0];
    p.spawn = { x: t.x + 0.5 * R, y: t.y - 60 }; D.Player.respawn(W, p);
    for (let i = 0; i < 5 * STEPS; i++) { set(p, 0, -1, true, true); D.World.step(W); }
    const u = W.level.devices[0].u; D.Level.unload(W);
    return u === 0 ? { ok: true, t: 0 } : { ok: false, t: 0 };
  });
  test('solo: one player cannot move a heavy crate', () => {
    const s = mk([['heavyCrate', {}], ['gate', {}]]); const t = s.coopTasks[0];
    const W = D.Level.load(s, 1); const p = W.players[0];
    p.spawn = { x: t.x - t.size / 2 - 0.35 * R, y: t.y - 27 }; D.Player.respawn(W, p);
    const crate = W.level.heavies[0].body, x0 = crate.position.x;
    const g = pushCrate(p, crate, W.level.heavies[0].x1, {});
    for (let i = 0; i < 12 * STEPS; i++) { g.next(); D.World.step(W); }
    const moved = Math.abs(crate.position.x - x0); D.Level.unload(W);
    return moved < 1 ? { ok: true, t: 0 } : { ok: false, t: 0 };
  });
  test('solo: lip swing across a 2.0R chain gap (probe, info only)', () => {
    const s = require('./coop-solo-swing.js');
    const n = s.successes(2.0);
    console.log(`        (a lone player's lip swing crossed 2.0R with ${n} of 80 release timings)`);
    return { ok: true, t: 0 };
  }, true);

  let fails = 0;
  for (const t of tests) {
    if (only && t.name.indexOf(only) === -1) continue;
    if (t.isProbe && !probe) continue;
    let r;
    try { r = t.fn(); } catch (e) { r = { ok: false, t: 0, err: e.stack.split('\n').slice(0, 3).join(' / ') }; }
    if (!r.ok) fails++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${t.name}${r.ok && r.t ? ` (both across in ${r.t.toFixed(1)} s${r.deaths ? `, ${r.deaths} planned fall` : ''})` : ''}${r.err ? ' ' + r.err : ''}`);
  }
  console.log(fails ? `${fails} failed` : 'co-op bots all passed');
  process.exit(fails ? 1 : 0);
}
