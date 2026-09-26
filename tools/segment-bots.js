// Solvability evidence for the segments the real campaigns use: a scripted one-player bot (tools/bots.js)
// crosses each obstacle at the limits set in config.LINT. Complements tools/gap-bots.js (plain and single-rope
// gaps) and tools/level-bot.js (whole levels).
//   node tools/segment-bots.js [name-filter] [--probe]
// --probe also runs cases just beyond the limits in config.LINT, to see how much margin they leave: wall 4R, wind
// rise 4.5R, rope rows 2 x 1.2R and 3 x 1.1R (the bot crosses all of these, so the limits keep a margin), and zigzag
// ledges up a shaft (the bot does NOT get past them: the head ends up under the overhang; not used in levels).
const B = require('./bots.js');
const { D, R, speed, setup, run, crawlTo, dropOff, climbWall, ropeCross, beamHang, iceUp, crateWall } = B;

const tests = [];
const test = (name, fn, probe) => tests.push({ name, fn, probe: !!probe });
const done = (W, r) => { D.Level.unload(W); return r.ok ? r.t : -1; };

// ---- walking: flat ground is a crawl (grip ahead, pull, swap hands); levels are designed around ~70 px/s -------------
test('crawl 5R of flat ground', () => {
  const { W, p, x0 } = setup([['ledge', { len: 6 }]], 0);
  const r = run(W, p, crawlTo({ p }, x0 + 5 * R), 40);
  D.Level.unload(W);
  return r.ok && (5 * R) / r.t >= 55 ? r.t : -1;                 // at least 55 px/s
});

// ---- drops: walk off a ledge and land lower --------------------------------------------------------------------
for (const h of [0.8, 1.4, 3.3]) {
  test(`drop ${h}R`, () => {
    const { W, p, x0, spec } = setup([['step', { h: -h, len: 1.4 }]], 130);
    return done(W, run(W, p, dropOff({ p }, x0, spec.segments[1].y1), 30));
  });
}

// ---- walls and steps: hand over hand up a face and over the lip ------------------------------------------------
for (const [h, probe] of [[0.5], [0.8], [0.9], [1], [2], [3], [3.5], [4, true]]) {
  test(`${h < 1.5 ? 'step' : 'wall'} ${h}R`, () => {
    const { W, p, x0 } = setup([['wall', { h }]], 60);
    return done(W, run(W, p, climbWall({ p }, x0, -h * R), 40));
  }, probe);
}

// ---- wind rise: an updraft beside a wall; the climb is the same, gravity is mostly cancelled ------------------
for (const [h, probe] of [[2.5], [3.5], [4.5, true]]) {
  test(`windRise ${h}R`, () => {
    const { W, p, x0 } = setup([['windRise', { h }]], -(1.6 * R - 60));
    return done(W, run(W, p, climbWall({ p }, x0 + 1.6 * R, -h * R), 40));
  }, probe);
}

// ---- ice slope (grabbable, but heads do not grip it), then its slick shelf and the ground after -----------------
for (const rise of [0.6, 0.8, 1.0]) {
  test(`iceSlope ${rise}R + shelf`, () => {
    const { W, p, x0 } = setup([['iceSlope', { len: 3, rise, shelf: 1.4 }], ['ledge', { len: 2 }]], 40);
    return done(W, run(W, p, iceUp({ p }, x0, 3, rise, x0 + 3 * R + 1.4 * R + 1.2 * R), 90));
  });
}

// ---- overhead beam over spikes, and a helper beam over a pit: reach up, hang, hand over hand ---------------------
for (const len of [2.5, 3, 4]) {
  test(`beamRun ${len}R`, () => {
    const { W, p, x0 } = setup([['beamRun', { len }]], 55);
    return done(W, run(W, p, beamHang({ p }, 0, x0 + len * R + 40), 60));
  });
}
for (const w of [1.2, 2, 3, 3.5]) {
  test(`gap beam ${w}R`, () => {
    const { W, p, spec } = setup([['gap', { w, aid: 'beam', land: 2 }]], 30);
    const g = spec.gaps[0];
    p.spawn = { x: g.x0 - 40, y: -27 };
    D.Player.respawn(W, p);
    return done(W, run(W, p, beamHang({ p }, 0, g.x1 + 30), 60));
  });
}

// ---- a crate at a wall's foot -------------------------------------------------------------------------------------
for (const h of [1.2, 1.5, 1.9]) {
  test(`crateStep ${h}R`, () => {
    const { W, p, x0 } = setup([['crateStep', { h }]], 60);
    return done(W, run(W, p, crateWall({ p }, W.level.crates[0], x0 + 1.4 * R, -h * R), 60));
  });
}

// ---- rope rows: swing from rope to rope (release points searched, see bots.js) ------------------------------------
for (const [n, spacing, probe] of [[2, 1.1], [3, 1.0], [2, 1.2, true], [3, 1.1, true]]) {
  test(`ropes n=${n} spacing ${spacing}R`, () => { const r = ropeCross({ aid: 'ropes', n, spacing }); return r ? r.t : -1; }, probe);
}

// ---- probe only: zigzag ledges up a shaft (each ledge is a lip; the bot always ends under the overhang) ----------
test('zigzag n=4 dy=1R', () => {
  const def = { id: 'bot', name: 'bot', theme: 'frozen', direction: 'up', seed: 1, segments: [['startUp', { width: 4 }], ['zigzag', { n: 4, dy: 1 }], ['goalUp', {}]] };
  const W = D.Level.load(D.Levels.compile(def), 1);
  const p = W.players[0];
  p.spawn = { x: -60, y: -27 };
  D.Player.respawn(W, p);
  for (let i = 0; i < 60; i++) D.World.step(W);
  const shaft = 2 * R, w = 1.8 * R;
  let k = 0, s = {};
  for (let i = 0; i < 40 * 120; i++) {
    const dir = k % 2 === 0 ? 1 : -1;
    B.climbStep(p, s, dir > 0 ? shaft - w : -(shaft - w), -(k + 1) * R, 0.55, dir, 0);
    D.World.step(W);
    if (p.dead) break;
    if (s.top && speed(p.head) < 30) { k++; s = {}; if (k === 4) { D.Level.unload(W); return i / 120; } }
  }
  D.Level.unload(W);
  return -1;
}, true);

module.exports = { tests };

if (require.main === module) {
  const args = process.argv.slice(2);
  const probe = args.indexOf('--probe') !== -1;
  const only = args.filter((a) => a !== '--probe')[0];
  let fails = 0;
  for (const t of tests) {
    if (only && t.name.indexOf(only) === -1) continue;
    if (t.probe && !probe) continue;
    let secs;
    try { secs = t.fn(); } catch (e) { console.log(`FAIL  ${t.name}  EXCEPTION ${e.stack.split('\n').slice(0, 3).join(' / ')}`); fails++; continue; }
    if (t.probe) console.log(`(probe) ${t.name}: ${secs > 0 ? `crossed in ${secs.toFixed(1)} s` : 'not crossed'}`);
    else { console.log(`${secs > 0 ? 'ok  ' : 'FAIL'}  ${t.name}${secs > 0 ? ` (${secs.toFixed(1)} s)` : ''}`); if (secs <= 0) fails++; }
  }
  console.log(fails ? `${fails} failed` : 'segment bots all crossed');
  process.exit(fails ? 1 : 0);
}
