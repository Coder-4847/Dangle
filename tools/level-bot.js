// Proves every obstacle of every authored solo level, with the exact options the level uses, using the scripted
// bot policies in tools/bots.js:
//   node tools/level-bot.js [levelId]
// Each obstacle is attempted from a standing start at its foot (the bot is put there like a checkpoint respawn:
// bots.js placeAt), in level order, exactly as the level builds it: the right wall height, gap width, rope spacing,
// slope, crate, beam length. Flat ground between obstacles is a plain crawl (segment-bots.js measures its speed),
// so the "bot time" is an estimate: obstacle times + flat distance at the measured crawl speed.
// Why not one continuous run: chaotic parts (rope swings, tiny approach differences) make a single scripted run
// fail for reasons that say nothing about the level; every obstacle proven from a clean start does.
// A segment with no policy fails loudly, so a new segment can't slip into a level unverified.
// Solo levels only (a co-op level needs two players by design).
const path = require('path');
const B = require('./bots.js');
for (const f of ['levels/test-levels', 'levels/campaigns', 'levels/solo-campaigns']) {
  try { require(path.join('..', 'js', f + '.js')); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
}
const { D, R, run, crawlTo, placeAt, dropOff, climbWall, plainGap, ropeCross, beamHang, iceUp, crateWall, settle } = B;
const CRAWL_SPEED = 70;                                 // px/s, measured by segment-bots.js ('crawl')

// One obstacle from a standing start. Returns a generator yielding to the physics loop; true when crossed.
function* obstacle(ctx, W, name, o, sg, spec, gap) {
  const x0 = sg.p0, fy = sg.y0;
  if (name === 'step' || name === 'wall') {
    const h = name === 'wall' ? (o.h || 3) : (o.h === undefined ? 1 : o.h);
    if (h > 0) return (yield* placeAt(ctx, x0 - 60, fy)) && (yield* climbWall(ctx, x0, fy - h * R));
    return (yield* placeAt(ctx, x0 - 130, fy)) && (yield* dropOff(ctx, x0, sg.y1));
  }
  if (name === 'gap') {
    const aid = o.aid || 'none';
    if (aid === 'none') return (yield* placeAt(ctx, gap.x0 - 14, fy)) && (yield* plainGap(ctx, gap, fy)) && (yield* settle(ctx, fy, 6));
    if (aid === 'rope' || aid === 'ropes') {
      // Rope swings are chaotic (a run from a slightly different start fails for reasons that say nothing about the
      // gap), so the crossing is searched in isolation with this gap's exact rope layout (bots.js ropeSearch).
      if (!ropeCross(o)) throw new Error(`no rope crossing found for ${JSON.stringify(o)}`);
      return true;
    }
    if (aid === 'beam') return (yield* placeAt(ctx, gap.x0 - 40, fy)) && (yield* beamHang(ctx, fy, gap.x1 + 30));
    throw new Error(`no bot policy for gap aid '${aid}'`);
  }
  if (name === 'beamRun') return (yield* placeAt(ctx, x0 - 55, fy)) && (yield* beamHang(ctx, fy, x0 + (o.len || 3) * R + 40));
  if (name === 'iceSlope') return (yield* placeAt(ctx, x0 - 40, fy)) && (yield* iceUp(ctx, x0, o.len || 3, o.rise || 0.8, sg.p1 - 90));
  if (name === 'windRise') { const wx = x0 + 1.6 * R; return (yield* placeAt(ctx, wx - 60, fy)) && (yield* climbWall(ctx, wx, fy - (o.h || 3.5) * R)); }
  if (name === 'crateStep') {
    const wx = x0 + 1.4 * R;
    const crate = W.level.crates.find((c) => Math.abs(c.position.x - (wx - 36)) < 200 && Math.abs(c.position.y - (fy - 32)) < 60);
    if (!crate) throw new Error('crate not found');
    return (yield* placeAt(ctx, x0 - 60, fy)) && (yield* crateWall(ctx, crate, wx, fy - (o.h || 1.5) * R));
  }
  throw new Error(`no bot policy for segment '${name}'`);
}

function playLevel(def) {
  const spec = D.Levels.compile(def);
  let gapIndex = 0, obstacles = 0, obstacleTime = 0, flat = 0, failed = '';
  for (let i = 0; i < def.segments.length && !failed; i++) {
    const [name, o0] = def.segments[i];
    const o = o0 || {};
    const sg = spec.segments[i];
    const label = `${i + 1}/${def.segments.length} ${name} ${JSON.stringify(o)} at ${(sg.p0 / R).toFixed(1)}R`;
    if (name === 'start' || name === 'ledge' || name === 'goal') { flat += sg.p1 - sg.p0; continue; }
    const gap = name === 'gap' ? spec.gaps[gapIndex++] : null;
    const W = D.Level.load(spec, 1);
    const p = W.players[0];
    const t0 = Date.now();
    let r;
    if (name === 'gap' && (o.aid === 'rope' || o.aid === 'ropes')) { r = { ok: !!ropeCross(o), t: 6 }; }
    else r = run(W, p, obstacle({ p, W }, W, name, o, sg, spec, gap), 120);
    D.Level.unload(W);
    obstacles++;
    obstacleTime += r.t;
    if (!r.ok) failed = `${r.dead ? 'DIED' : 'stuck'} at ${label}`;
    if (process.env.TRACE) console.log(`   ${r.ok ? 'ok  ' : 'FAIL'} ${label} ${r.t.toFixed(1)} s (${Date.now() - t0} ms)`);
  }
  const time = obstacleTime + flat / CRAWL_SPEED;
  return { ok: !failed, t: time, seg: failed, len: spec.length / R, obstacles };
}

if (require.main === module) {
  const only = process.argv[2];
  const defs = D.Levels.list().filter((d) => !d.coop && !d.stub && /^solo-/.test(d.id) && (!only || d.id === only));
  if (!defs.length) { console.log('no authored solo levels' + (only ? ' named ' + only : '')); process.exit(1); }
  let fails = 0;
  for (const def of defs) {
    let r;
    try { r = playLevel(def); } catch (e) { r = { ok: false, seg: 'EXCEPTION ' + e.message, t: 0 }; }
    if (!r.ok) fails++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${def.id.padEnd(9)} ${r.ok ? `${r.len.toFixed(0)}R, ${r.obstacles} obstacles, est. ${r.t.toFixed(0)} s` : r.seg}`);
  }
  console.log(fails ? `${fails} level(s) the bot could not finish` : `the bot crossed every obstacle of all ${defs.length} authored solo levels`);
  process.exit(fails ? 1 : 0);
}
module.exports = { playLevel };
