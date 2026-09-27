// Level smoke test: node tools/level-smoke.js [levelId | --all]
// Default: registered levels plus the first and last level of every campaign in both modes.
// --all: every level (153): about a minute.
// For every registered level, with 1 and 2 players: load, settle, reach a checkpoint, die in a
// hazard and respawn, fall out of the world, finish (all players in the goal), unload, and
// check nothing leaked. Then 20 rapid restarts must not slow down or grow memory.
// Reused by every level phase (6-9) as the automated "all levels load and finish" test.
const path = require('path');
if (!global.gc) {   // need a forced GC for the memory check: re-run ourselves with the flag
  const r = require('child_process').spawnSync(process.execPath, ['--expose-gc', __filename, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}
global.window = global;
global.Matter = require('../js/lib/matter.min.js');
for (const f of ['config', 'core/characters', 'core/loop', 'physics/world', 'physics/grab', 'physics/player', 'physics/surfaces', 'physics/hazards', 'physics/devices',
  'levels/builder', 'levels/segments', 'levels/segments-coop', 'levels/levels', 'levels/themes', 'levels/test-levels', 'levels/campaigns', 'levels/solo-campaigns', 'levels/solo-campaigns-2', 'levels/coop-campaigns', 'levels/loader']) {
  try { require(path.join('..', 'js', f + '.js')); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
}
const D = global.Dangle;
const cfg = D.config;
const STEP = cfg.STEP;

const stepFor = (W, sec, fn) => { for (let i = 0, n = Math.round(sec / STEP); i < n; i++) { if (fn) fn(i * STEP); D.World.step(W); } };
const speed = (b) => Math.hypot(D.Player.velX(b), D.Player.velY(b));
function place(W, p, x, y) { p.spawn = { x, y }; D.Player.respawn(W, p); }
function noNaN(W) { return W.players.every((p) => p.dead || p.bodies.every((b) => isFinite(b.position.x + b.position.y))); }

function testLevel(id, count) {
  const errs = [];
  const spec = D.Levels.spec(id);
  const W = D.Level.load(spec, count);
  const base = D.Level.census(W);
  const L = W.level;
  const tag = `${count}P`;
  const check = (ok, msg) => { if (!ok) errs.push(`${tag}: ${msg}`); };

  // 1. Settle at the spawn: alive, calm, no deaths.
  stepFor(W, 2);
  check(W.players.every((p) => !p.dead && p.deaths === 0), 'died while standing at the spawn');
  check(W.players.every((p) => speed(p.head) < 5), 'players still moving after 2 s at rest');
  check(noNaN(W), 'NaN at rest');

  // 2. Checkpoint: stepping into the first flag's zone activates it.
  const cp = spec.checkpoints[0];
  if (cp) {
    place(W, W.players[0], cp.x, cp.y - 40);
    stepFor(W, 0.1);
    check(L.checkpoint === 0, 'checkpoint 1 did not activate');
    place(W, W.players[0], spec.spawns[0].x, spec.spawns[0].y);
  } else errs.push(`${tag}: level has no checkpoints`);

  // 3. Hazard death and respawn at the last checkpoint.
  const hz = spec.hazards.find((h) => h.type !== 'pit') || spec.hazards[0];
  if (hz) {
    const p = W.players[0];
    place(W, p, hz.x + hz.w / 2, hz.y + hz.h / 2);
    stepFor(W, 0.05);
    check(p.dead, `did not die in a ${hz.type} hazard`);
    check(W.engine.world.bodies.indexOf(p.head) === -1, 'dead player is still in the world');
    const wait = (count > 1 ? cfg.RESPAWN_DELAY_COOP : cfg.RESPAWN_DELAY_SOLO);
    stepFor(W, wait - 0.2);
    check(p.dead, 'came back too early');
    stepFor(W, 0.5);
    check(!p.dead, 'never respawned');
    const at = L.checkpoint >= 0 ? spec.checkpoints[L.checkpoint].spawns[0] : spec.spawns[0];
    check(Math.hypot(p.head.position.x - at.x, p.head.position.y - at.y) < 60 || count > 1, `respawned at (${p.head.position.x | 0},${p.head.position.y | 0}), expected ~(${at.x | 0},${at.y | 0})`);
  }  // (vertical levels may have no hazards: the fall test below still covers death and respawn)

  // 4. Falling out of the world respawns too.
  {
    const p = W.players[W.players.length - 1];
    place(W, p, spec.spawns[0].x, spec.killY + 300);
    stepFor(W, 0.05);
    check(p.dead, 'falling below the kill plane did not kill');
    stepFor(W, cfg.RESPAWN_DELAY_COOP + 0.3);
    check(!p.dead && noNaN(W), 'no clean respawn after a fall');
  }

  // 4b. Co-op catch-up: a player who dies comes back beside a partner standing well ahead (hazards.js respawnPoint).
  if (count > 1) {
    const g0 = spec.goal, [p1, p2] = W.players;
    place(W, p2, g0.x - 0.75 * cfg.REACH, g0.y + g0.h - 30);    // just short of the goal zone, on its ledge
    stepFor(W, 1);
    place(W, p1, spec.spawns[0].x, spec.killY + 300);
    stepFor(W, cfg.RESPAWN_DELAY_COOP + 0.3);
    const d = Math.hypot(p1.head.position.x - p2.head.position.x, p1.head.position.y - p2.head.position.y);
    check(!p1.dead && d < 2 * cfg.REACH, `co-op: a fallen player came back ${(d / cfg.REACH).toFixed(1)}R from the partner waiting by the goal (want beside them)`);
    place(W, p1, spec.spawns[0].x, spec.spawns[0].y);
    place(W, p2, spec.spawns[1].x, spec.spawns[1].y);
  }

  // 5. Finish: everyone in the goal completes the level; one missing does not.
  const g = spec.goal;
  stepFor(W, 0.3);
  if (count > 1) {
    place(W, W.players[0], g.x + g.w / 2, g.y + g.h - 40);
    stepFor(W, 0.05);
    check(!L.complete, 'completed with only one of two players in the goal');
  }
  W.players.forEach((p, i) => place(W, p, g.x + g.w * (0.3 + 0.4 * i), g.y + g.h - 40));
  stepFor(W, 0.1);
  check(L.complete, 'did not complete with everyone in the goal');

  // 6. Mechanics that exist in this level actually work (fresh world each so state is clean).
  mechanics(spec, check);

  // 7. Unload leaves nothing behind.
  D.Level.unload(W);
  const after = D.Level.census(W);
  check(after.bodies === 0 && after.constraints === 0 && after.dynamic === 0 && after.grabbables === 0, `unload left ${JSON.stringify(after)}`);
  check(W.level === null, 'level state survives unload');
  return { errs, base };
}

// Feature checks, one throwaway world per feature.
function mechanics(spec, check) {
  const fresh = () => D.Level.load(spec, 1);
  const g = cfg.GRAVITY;

  const t = spec.trampolines[0];
  if (t) {
    const W = fresh(); const p = W.players[0];
    place(W, p, t.x + t.w / 2, t.y - 260);
    let apex = Infinity, bounced = false;
    stepFor(W, 3, () => { apex = Math.min(apex, p.head.position.y); W.level.events.forEach((e) => { if (e.type === 'bounce') bounced = true; }); });
    const height = t.y - cfg.HEAD_RADIUS - apex;
    check(bounced && height > 2 * cfg.REACH, `trampoline: apex only ${height.toFixed(0)} px above the pad (need > 2 REACH)`);
    D.Level.unload(W);
  }

  const z = spec.winds[0];
  if (z) {
    const W = fresh(); const p = W.players[0];
    place(W, p, z.x + z.w / 2, z.y + z.h * 0.75);
    stepFor(W, 0.6);
    check(D.Player.velY(p.head) < 0, `wind: player is not being lifted (vy ${D.Player.velY(p.head).toFixed(0)})`);
    D.Level.unload(W);
  }

  const r = spec.risers[0];
  if (r) {
    const W = fresh(); const p = W.players[0];
    const t0 = spec.tides[0];
    place(W, p, r.x0 + 60, t0.floorY - cfg.HEAD_RADIUS - 3);
    let died = -1;
    stepFor(W, 60, (tt) => { if (p.dead && died < 0) died = tt; });
    const expect = (t0.startY - (t0.floorY - cfg.HEAD_RADIUS)) / t0.speed;
    check(died > 0 && Math.abs(died - expect) < 1.5, `tide: standing still died at ${died.toFixed(1)} s, expected ~${expect.toFixed(1)} s`);
    D.Level.unload(W);
  }

  // Co-op devices: a head on a plate opens its gate/lift; stepping off lets it close; one grip can't move a heavy crate.
  const dv = spec.devices.findIndex((d) => d.plates.length);
  if (dv >= 0) {
    const W = fresh(); const p = W.players[0]; const d = W.level.devices[dv]; const pl = spec.plates[spec.devices[dv].plates[0]];
    place(W, p, pl.x + pl.w / 2, pl.y + pl.h - 30);
    stepFor(W, d.time + 0.4);
    check(d.u === 1, `device: standing on its plate did not open it (u ${d.u.toFixed(2)})`);
    place(W, p, spec.spawns[0].x, spec.spawns[0].y);
    stepFor(W, d.time + 0.4);
    check(d.u === 0, `device: leaving the plate did not close it again (u ${d.u.toFixed(2)})`);
    D.Level.unload(W);
  }
  if (spec.heavies.length) {
    const W = fresh(); const h = W.level.heavies[0]; const x0 = h.body.position.x;
    const p = W.players[0];
    place(W, p, x0 - h.body.dg.size.w / 2 - 30, spec.heavies[0].y + spec.heavies[0].size / 2 - 30);
    stepFor(W, 2, () => { p.input.aimX = 1; p.input.aimY = 0; p.input.grab[0] = p.input.grab[1] = true; });
    check(Math.abs(h.body.position.x - x0) < 1, `heavy crate: one player moved it ${Math.abs(h.body.position.x - x0).toFixed(0)} px`);
    D.Level.unload(W);
  }

  const m = spec.movers[0];
  if (m) {
    const W = fresh(); const p = W.players[0];
    place(W, p, m.x + m.w / 2, m.y - cfg.HEAD_RADIUS - 3);
    let x0 = null, y0 = null, maxD = 0;
    stepFor(W, m.period, () => { if (x0 === null) { x0 = p.head.position.x; y0 = p.head.position.y; } maxD = Math.max(maxD, Math.hypot(p.head.position.x - x0, p.head.position.y - y0)); });
    const travel = Math.hypot(m.dx, m.dy);
    check(!p.dead && maxD > 0.5 * travel, `mover: rider moved only ${maxD.toFixed(0)} of ${travel.toFixed(0)} px`);
    D.Level.unload(W);
  }
}

function rapidRestarts(id) {
  const errs = [];
  const spec = D.Levels.spec(id);
  const times = [];
  const heap = [];
  let census0 = null;
  for (let i = 0; i < 20; i++) {
    const t0 = process.hrtime.bigint();
    const W = D.Level.load(spec, 2);
    stepFor(W, 0.5);
    const c = JSON.stringify(D.Level.census(W));
    if (census0 === null) census0 = c;
    else if (c !== census0) errs.push(`restart ${i}: census ${c} differs from first ${census0}`);
    D.Level.unload(W);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    global.gc();
    heap.push(process.memoryUsage().heapUsed / 1e6);
  }
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const early = avg(times.slice(1, 6));                     // skip the JIT warm-up run
  const late = avg(times.slice(-5));
  if (late > early * 1.6 + 5) errs.push(`restarts slow down: ${early.toFixed(1)} ms -> ${late.toFixed(1)} ms`);
  const growth = avg(heap.slice(-5)) - avg(heap.slice(2, 7));
  if (growth > 3) errs.push(`heap grows ${growth.toFixed(1)} MB over restarts`);
  return { errs, info: `${early.toFixed(0)} -> ${late.toFixed(0)} ms/restart, heap ${growth >= 0 ? '+' : ''}${growth.toFixed(2)} MB` };
}

const arg = process.argv[2];
const only = arg && arg !== '--all' ? arg : null;
const sample = (d) => {
  const p = D.Campaigns.parse(d.id);
  return !p || p.n === 1 || p.n === D.Campaigns.list[p.c - 1].levels;
};
let failed = 0;
for (const def of D.Levels.all().filter((d) => (only ? d.id === only : arg === '--all' || sample(d)))) {
  const errs = [];
  let info = '';
  try {
    for (const count of [1, 2]) { const r = testLevel(def.id, count); errs.push(...r.errs); info = `${r.base.bodies} bodies, ${r.base.constraints} constraints`; }
    const rr = rapidRestarts(def.id);
    errs.push(...rr.errs);
    info += ` | ${rr.info}`;
  } catch (e) { errs.push('EXCEPTION ' + (e.stack || e.message).split('\n').slice(0, 3).join(' / ')); }
  if (errs.length) failed++;
  console.log(`${errs.length ? 'FAIL' : 'PASS'}  ${def.id.padEnd(12)} ${info}`);
  for (const e of errs) console.log('        ' + e);
}
console.log(failed ? `${failed} level(s) failed` : 'all levels loaded, finished, respawned, unloaded and restarted cleanly');
process.exit(failed ? 1 : 0);
