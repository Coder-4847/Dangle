// Level linter: node tools/lint-levels.js [levelId]
// Checks every level's compiled spec against the rules in docs/MASTER_PROMPT.md 5.5 (spawn, goal,
// checkpoints, gap sizes per aid, co-op-only gaps, spawn overlaps, level length) plus a few
// physics-safety rules (min thickness, tides that can be outrun, determinism).
// Runs on plain data only: no Matter, no DOM. Exit code 1 if any level has an error.
const path = require('path');
global.window = global;
for (const f of ['config', 'levels/builder', 'levels/segments', 'levels/segments-coop', 'levels/levels', 'levels/themes', 'levels/test-levels', 'levels/campaigns', 'levels/solo-campaigns', 'levels/solo-campaigns-2', 'levels/coop-campaigns', 'levels/coop-campaigns-2']) {
  try { require(path.join('..', 'js', f + '.js')); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
}
const D = global.Dangle;
const cfg = D.config;
const R = cfg.REACH;
const LINT = cfg.LINT;

// ---- geometry helpers -------------------------------------------------------------------
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function circleOverlapsPoly(cx, cy, r, poly) {
  if (pointInPoly(cx, cy, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    let t = ((cx - a.x) * ex + (cy - a.y) * ey) / (ex * ex + ey * ey);
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(cx - (a.x + ex * t), cy - (a.y + ey * t)) < r) return true;
  }
  return false;
}
const rectPoly = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
function polysOverlap(a, b) {
  // Convex separating-axis test; touching edges do not count as overlap.
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const nx = -(q.y - p.y);
      const ny = q.x - p.x;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) { const d = v.x * nx + v.y * ny; minA = Math.min(minA, d); maxA = Math.max(maxA, d); }
      for (const v of b) { const d = v.x * nx + v.y * ny; minB = Math.min(minB, d); maxB = Math.max(maxB, d); }
      if (maxA <= minB + 1e-6 || maxB <= minA + 1e-6) return false;
    }
  }
  return true;
}

// ---- the checks -------------------------------------------------------------------------
function lint(def) {
  const errors = [];
  const warns = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warns.push(m);
  const fmt = (v) => (v / R).toFixed(2) + 'R';

  let spec;
  try {
    spec = D.Levels.compile(def);
    if (JSON.stringify(spec) !== JSON.stringify(D.Levels.compile(def))) err('not deterministic: compiling twice gives different specs');
  } catch (e) { return { errors: ['compile failed: ' + e.message], warns, spec: null }; }

  const solids = spec.blocks.map((b, i) => ({ what: `block#${i} ${b.kind}`, poly: D.Builder.blockPoly(b) }));
  for (const [i, m] of spec.movers.entries()) {
    solids.push({ what: `mover#${i} (start)`, poly: rectPoly(m.x, m.y, m.w, m.h) });
    solids.push({ what: `mover#${i} (end)`, poly: rectPoly(m.x + m.dx, m.y + m.dy, m.w, m.h) });
  }
  for (const [i, t] of spec.trampolines.entries()) solids.push({ what: `trampoline#${i}`, poly: rectPoly(t.x, t.y, t.w, t.h) });
  const groundAt = (x, y, tol) => spec.blocks.some((b) => b.kind !== 'noGrab' && pointInPoly(x, y + tol, D.Builder.blockPoly(b))) ||
    spec.trampolines.some((t) => x > t.x && x < t.x + t.w && y + tol > t.y);

  if (spec.direction !== 'right' && spec.direction !== 'up') err(`bad direction '${spec.direction}'`);

  // Structure: spawn, goal, checkpoints.
  if (spec.spawns.length < 2) err('needs 2 spawn points (co-op)');
  if (!spec.goal) err('no goal');
  const len = spec.length / R;
  if (len < LINT.LEN_MIN || len > LINT.LEN_MAX) err(`length ${len.toFixed(1)}R outside ${LINT.LEN_MIN}..${LINT.LEN_MAX}R`);
  const needCp = Math.max(len > 8 ? 1 : 0, Math.floor(len / (2 * cfg.CHECKPOINT_SPACING)));
  if (spec.checkpoints.length < needCp) err(`only ${spec.checkpoints.length} checkpoints, need at least ${needCp} for ${len.toFixed(1)}R`);

  // Nothing overlaps a spawn or checkpoint respawn spot; there is ground under each.
  const spots = spec.spawns.map((s, i) => ({ what: `spawn ${i + 1}`, x: s.x, y: s.y }));
  spec.checkpoints.forEach((c, k) => c.spawns.forEach((s, i) => spots.push({ what: `checkpoint ${k + 1} spawn ${i + 1}`, x: s.x, y: s.y })));
  const spotR = cfg.HEAD_RADIUS + 2;
  for (const sp of spots) {
    for (const s of solids) if (circleOverlapsPoly(sp.x, sp.y, spotR, s.poly)) err(`${sp.what} overlaps ${s.what}`);
    for (const h of spec.hazards) if (h.type !== 'pit' && circleOverlapsPoly(sp.x, sp.y, spotR, rectPoly(h.x, h.y, h.w, h.h))) err(`${sp.what} overlaps a ${h.type} hazard`);
    if (!groundAt(sp.x, sp.y + cfg.HEAD_RADIUS, 10)) err(`${sp.what} has no ground under it`);
  }
  spec.checkpoints.forEach((c, k) => { if (!groundAt(c.x, c.y, 4)) err(`checkpoint ${k + 1} flag is not on ground`); });
  if (spec.goal && !groundAt(spec.goal.x + spec.goal.w / 2, spec.goal.y + spec.goal.h, 4)) err('goal zone is not on ground');

  // Gaps: solo gaps within the aid's limit; co-op-only gaps flagged and only in co-op levels.
  for (const g of spec.gaps) {
    const where = `gap at ${fmt(g.x0)} (${g.aid}, ${fmt(g.span)})`;
    if (g.coopOnly) {
      if (!spec.coop) err(`${where} is co-op-only but the level is solo`);
      if (g.span > LINT.GAP_COOP_MAX * R + 0.5) err(`${where} exceeds the co-op limit ${LINT.GAP_COOP_MAX}R`);
      if (g.span < LINT.CHAIN_MIN * R - 0.5) err(`${where} is narrower than ${LINT.CHAIN_MIN}R: one player could swing across alone`);
      continue;
    }
    const limit = { none: LINT.GAP_PLAIN_MAX, rope: LINT.GAP_ROPE_MAX, ropes: Infinity, mover: LINT.GAP_MOVER_MAX, beam: LINT.GAP_BEAM_SPAN_MAX }[g.aid];
    if (limit === undefined) { err(`${where}: unknown aid`); continue; }
    if (g.span > limit * R + 0.5) err(`${where} is wider than one player can cross (max ${limit}R)`);
    if (g.aid === 'ropes') {
      const xs = [g.x0].concat(g.ropes, [g.x1]);
      for (let i = 0; i < xs.length - 1; i++) {
        const d = xs[i + 1] - xs[i];
        const edge = i === 0 || i === xs.length - 2;
        const max = edge ? 0.9 : (g.ropes.length > 2 ? LINT.GAP_ROPES3_STEP_MAX : LINT.GAP_ROPES_STEP_MAX);
        if (d > max * R + 0.5) err(`${where}: rope ${edge ? 'to edge' : 'spacing'} ${fmt(d)} exceeds ${max}R`);
      }
    }
    if (g.aid === 'rope' && g.ropes[0] - g.x0 > 0.9 * R) err(`${where}: rope is ${fmt(g.ropes[0] - g.x0)} from the edge (max 0.9R)`);
    if (g.aid === 'mover' && g.period < 3) err(`${where}: platform period ${g.period}s is too quick`);
    if (g.aid === 'mover' && g.platW >= g.span) warn(`${where}: platform is as wide as the gap`);
  }
  for (const b of spec.beams) if (b.x1 - b.x0 > LINT.GAP_BEAM_MAX * R) err(`beam at ${fmt(b.x0)} is ${fmt(b.x1 - b.x0)} long (max ${LINT.GAP_BEAM_MAX}R)`);

  // Vertical rises.
  const riseMax = { wall: LINT.WALL_SOLO_MAX, ledge: LINT.STEP_UP_MAX, wind: LINT.WIND_RISE_MAX, lift: LINT.LIFT_H_MAX, coop: 99, trampoline: LINT.TRAMP_RISE_MAX, slope: LINT.SLOPE_MAX };
  for (const r of spec.rises) {
    const max = riseMax[r.kind];
    if (max === undefined) err(`unknown rise kind ${r.kind}`);
    else if (r.h > max + 1e-6) err(`${r.kind} rise of ${r.h.toFixed(2)}R at ${fmt(r.x)} exceeds ${max}R`);
    if (r.kind === 'ledge' && r.gapX !== undefined && (r.gapX > LINT.LEDGE_TIP_GAP_MAX + 1e-6 || r.gapX < 0.2)) {
      err(`ledge tips are ${r.gapX.toFixed(2)}R apart sideways (want 0.2..${LINT.LEDGE_TIP_GAP_MAX}R: overlaps can't be mantled, wide gaps can't be reached)`);
    }
  }

  // Tides must be outrunnable at planning speed.
  for (const t of spec.tides) {
    const flood = (t.startY - (t.floorY - cfg.HEAD_RADIUS)) / t.speed;
    const cross = D.tideCross(t.len, t.climb || 0);
    if (flood < 1.2 * cross) err(`tide at ${fmt(t.x0)} floods in ${flood.toFixed(1)}s but crossing takes ~${cross.toFixed(1)}s`);
  }

  // Co-op obstacles: only in co-op levels, and built so one player alone can't do them. A co-op level must need
  // teamwork more than once (not a solo level with a second head).
  for (const t of spec.coopTasks) {
    const where = `${t.type} at ${fmt(t.x)}`;
    if (!spec.coop) { if (t.type !== 'chain') err(`${where} is co-op-only but the level is solo`); continue; }
    if (t.type === 'gate' && t.plateGap < LINT.COOP_PLATE_MIN - 1e-6) err(`${where}: plate only ${t.plateGap.toFixed(2)}R from the gate (min ${LINT.COOP_PLATE_MIN}R)`);
    if (t.type === 'lift' && t.handleGap < LINT.COOP_PLATE_MIN - 1e-6) err(`${where}: handle only ${t.handleGap.toFixed(2)}R from the lift (min ${LINT.COOP_PLATE_MIN}R)`);
    if ((t.type === 'lift' || t.type === 'heavy' || t.type === 'gate') && t.h < LINT.COOP_WALL_MIN - 1e-6) err(`${where}: wall/gate of ${t.h.toFixed(2)}R can be reached alone (min ${LINT.COOP_WALL_MIN}R)`);
    if (t.type === 'heavy' && t.run < LINT.COOP_CRATE_RUN_MIN - 1e-6) err(`${where}: the crate starts only ${t.run.toFixed(2)}R from its wall (min ${LINT.COOP_CRATE_RUN_MIN}R)`);
  }
  if (spec.coop && spec.coopTasks.length < 2) err(`co-op level has ${spec.coopTasks.length} co-op obstacle(s): needs at least 2`);

  // Springboards: the drop onto the pad and the wall above it stay within what the bounce can do.
  for (const b of spec.bounces || []) {
    if (b.h > LINT.BOUNCE_H_MAX + 1e-6) err(`bounce wall of ${b.h.toFixed(2)}R at ${fmt(b.x)} exceeds ${LINT.BOUNCE_H_MAX}R`);
    if (b.drop < LINT.BOUNCE_DROP[0] - 1e-6 || b.drop > LINT.BOUNCE_DROP[1] + 1e-6) err(`bounce drop of ${b.drop.toFixed(2)}R at ${fmt(b.x)} outside ${LINT.BOUNCE_DROP.join('..')}R`);
  }

  // Physics safety: nothing thinner than MIN_THICK, nothing overlapping crates/hazards.
  for (const [i, b] of spec.blocks.entries()) if (Math.min(b.w, b.h) < LINT.MIN_THICK) err(`block#${i} ${b.kind} is only ${Math.min(b.w, b.h).toFixed(0)}px thick`);
  for (const [i, m] of spec.movers.entries()) if (Math.min(m.w, m.h) < LINT.MIN_THICK) err(`mover#${i} is too thin`);
  // A rider must not be shaken off: the platform's peak acceleration stays under what the head's grip holds.
  for (const [i, m] of spec.movers.entries()) {
    const half = (m.period / 2) * (1 - 2 * (m.dwell || 0));
    const accel = (Math.hypot(m.dx, m.dy) / 2) * Math.pow(Math.PI / half, 2);
    if (accel > 0.8 * cfg.HEAD_GRIP * cfg.GRAVITY) err(`mover#${i} accelerates at ${accel.toFixed(0)} px/s^2: a rider would slide off (max ${(0.8 * cfg.HEAD_GRIP * cfg.GRAVITY).toFixed(0)})`)
  }
  for (const [i, k] of spec.crates.entries()) {
    const cp = rectPoly(k.x - k.size / 2, k.y - k.size / 2, k.size, k.size);
    for (const s of solids) if (polysOverlap(cp, s.poly)) err(`crate#${i} overlaps ${s.what}`);
  }
  for (const h of spec.hazards) {
    if (h.type === 'pit' || h.type === 'lava' || h.type === 'water') continue;   // these sit in empty pits by design
    const hp = rectPoly(h.x + 2, h.y + 2, h.w - 4, h.h - 4);
    for (const s of solids) if (polysOverlap(hp, s.poly)) err(`${h.type} hazard at ${fmt(h.x)} overlaps ${s.what}`);
  }
  if (spec.goal) {
    const gp = rectPoly(spec.goal.x, spec.goal.y, spec.goal.w, spec.goal.h - 4);
    for (const s of solids) if (polysOverlap(gp, s.poly)) err(`goal zone overlaps ${s.what}`);
  }

  return { errors, warns, spec };
}

// Known-bad levels the linter must reject (run with --selftest): guards the linter itself.
const BAD = [
  ['plain gap too wide', { direction: 'right', segments: [['start', {}], ['ledge', {}], ['gap', { w: 1.6 }], ['ledge', { len: 6 }], ['goal', {}]] }, 'wider than one player'],
  ['rope gap too wide', { direction: 'right', segments: [['start', {}], ['ledge', {}], ['gap', { w: 2.6, aid: 'rope' }], ['ledge', { len: 6 }], ['goal', {}]] }, 'wider than one player'],
  ['co-op gap in a solo level', { direction: 'right', segments: [['start', {}], ['ledge', {}], ['gap', { w: 2, aid: 'chain' }], ['ledge', { len: 6 }], ['goal', {}]] }, 'co-op-only'],
  ['no goal', { direction: 'right', segments: [['start', { len: 20 }]] }, 'no goal'],
  ['too short', { direction: 'right', segments: [['start', { len: 2 }], ['goal', { len: 2 }]] }, 'length'],
  ['tide too fast', { direction: 'right', segments: [['start', {}], ['tide', { len: 6, speed: 80 }], ['goal', {}]] }, 'tide'],
  ['ledges too far apart', { direction: 'up', segments: [['startUp', {}], ['zigzag', { n: 3, dy: 1.5 }], ['goalUp', {}]] }, 'ledge rise'],
  ['beam gap too wide', { direction: 'right', segments: [['start', {}], ['gap', { w: 4.2, aid: 'beam' }], ['ledge', { len: 6 }], ['goal', {}]] }, 'wider than one player'],
  ['three ropes too far apart', { direction: 'right', segments: [['start', {}], ['gap', { aid: 'ropes', n: 3, spacing: 1.3 }], ['ledge', { len: 6 }], ['goal', {}]] }, 'rope spacing'],
  ['wall too tall', { direction: 'right', segments: [['start', {}], ['wall', { h: 4.6 }], ['ledge', { len: 6 }], ['goal', {}]] }, 'exceeds'],
  ['ice slope too steep', { direction: 'right', segments: [['start', {}], ['iceSlope', { rise: 1.6 }], ['ledge', { len: 6 }], ['goal', {}]] }, 'slope rise'],
  ['bounce wall too tall', { direction: 'right', segments: [['start', {}], ['bounce', { h: 3.6 }], ['ledge', { len: 6 }], ['goal', {}]] }, 'bounce wall'],
  ['gate in a solo level', { direction: 'right', segments: [['start', {}], ['gate', {}], ['ledge', { len: 6 }], ['goal', {}]] }, 'co-op-only'],
  ['gate plate too close', { direction: 'right', coop: true, segments: [['start', {}], ['gate', { dist: 1.5 }], ['heavyCrate', {}], ['goal', {}]] }, 'plate only'],
  ['co-op level with one co-op obstacle', { direction: 'right', coop: true, segments: [['start', {}], ['gate', {}], ['ledge', { len: 6 }], ['goal', {}]] }, 'at least 2'],
  ['chain gap soloable', { direction: 'right', coop: true, segments: [['start', {}], ['gap', { w: 1.4, aid: 'chain' }], ['gate', {}], ['goal', {}]] }, 'swing across alone'],
  ['heavy crate too close to its wall', { direction: 'right', coop: true, segments: [['start', {}], ['heavyCrate', { run: 1 }], ['gate', {}], ['goal', {}]] }, 'starts only'],
  ['ledges overlap', { direction: 'up', segments: [['startUp', {}], ['zigzag', { n: 3, ledge: 2.4 }], ['goalUp', {}]] }, 'ledge tips'],
  ['unknown segment', { direction: 'right', segments: [['start', {}], ['banana', {}]] }, 'unknown segment'],
  ['wrong direction', { direction: 'up', segments: [['start', {}]] }, 'right levels'],
];

function selftest() {
  let fails = 0;
  for (const [name, def, expect] of BAD) {
    const r = lint(Object.assign({ id: 'bad', name, theme: 'meadow', seed: 1 }, def));
    const hit = r.errors.some((e) => e.indexOf(expect) !== -1) || r.errors.some((e) => e.indexOf('right levels') !== -1 && expect === 'right levels');
    if (!hit) { fails++; console.log(`FAIL  linter missed: ${name}   (got: ${r.errors.join(' | ') || 'nothing'})`); }
    else console.log(`ok    rejects: ${name}`);
  }
  console.log(fails ? `${fails} selftest failure(s)` : 'linter selftest passed');
  return fails;
}

if (require.main === module) {
  if (process.argv[2] === '--selftest') process.exit(selftest() ? 1 : 0);
  const only = process.argv[2];
  const defs = D.Levels.all().filter((d) => !only || d.id === only);
  if (!defs.length) { console.log('no levels' + (only ? ' named ' + only : '')); process.exit(1); }
  let bad = 0;
  for (const def of defs) {
    const r = lint(def);
    const s = r.spec;
    const stats = s ? `${(s.length / R).toFixed(1)}R, ${s.checkpoints.length} cp, ${s.gaps.length} gaps` : '';
    console.log(`${r.errors.length ? 'FAIL' : 'PASS'}  ${def.id.padEnd(12)} ${stats}`);
    for (const e of r.errors) console.log('        error: ' + e);
    for (const w of r.warns) console.log('        warn:  ' + w);
    if (r.errors.length) bad++;
  }
  console.log(bad ? `${bad} level(s) failed` : `all ${defs.length} level(s) clean`);
  process.exit(bad ? 1 : 0);
}
module.exports = { lint, selftest };
