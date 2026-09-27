// Solo campaigns 1-5 (25 levels), authored from segments. Distances are in REACH units.
// Every aid used here is proven by scripted players (tools/segment-bots.js, tools/gap-bots.js):
//   plain gap <= 0.9R | one rope 1.7-2.0R | two ropes <= 1.2R apart, three <= 1.0R | helper beam gap <= 3.5R
//   walls <= 3.5R hand over hand | ice slope (3R long, rise <= 1R) | wind rise <= 3.5R | beam run 2.5-4R | crate step.
// Movement on flat ground is slow (a crawl of about 60 px/s), so ledges are short and the level's interest
// comes from steps, drops, ropes and beams rather than long flat runs. Each campaign teaches one idea in its
// first level, combines it in the middle, and ends with a signature level.
window.Dangle = window.Dangle || {};

(function () {
  const L = Dangle.Levels;
  const C = Dangle.Campaigns;

  // shorthands: start / goal / ledge, gaps by aid, steps
  const start = (len) => ['start', { len: len || 2.4 }];
  const goal = (len) => ['goal', { len: len || 2.6 }];
  const ledge = (len) => ['ledge', { len }];
  const gap = (w, land) => ['gap', { w, land: land || 1.2 }];
  const rope = (w, o) => ['gap', Object.assign({ w, aid: 'rope', land: 1.3 }, o)];
  const ropes = (n, spacing, o) => ['gap', Object.assign({ aid: 'ropes', n, spacing, land: 1.3 }, o)];
  const beamGap = (w, o) => ['gap', Object.assign({ w, aid: 'beam', land: 1.6 }, o)];
  const up = (h, len) => ['step', { h, len: len || 1.4 }];
  const down = (h, len) => ['step', { h: -h, len: len || 1.4 }];
  const wall = (h, len) => ['wall', { h, len: len || 1.4 }];
  const beamRun = (len) => ['beamRun', { len }];
  const ice = (rise) => ['iceSlope', { len: 3, rise, shelf: 1.4 }];
  const crate = (h) => ['crateStep', { h }];
  const windRise = (h, nograb) => ['windRise', { h, nograb: !!nograb }];
  const tide = (len, h, kind) => ['tide', { len, h: h || 0, kind: kind || 'water' }];
  const mover = (w, period, o) => ['gap', Object.assign({ w, aid: 'mover', period, land: 1.4 }, o)];
  const lift = (h, period) => ['lift', { h, period: period || 8 }];
  const bounce = (drop, h) => ['bounce', { drop, h }];

  // The segment shorthands, shared with the other authoring files (solo-campaigns-2.js).
  L.dsl = { start, goal, ledge, gap, rope, ropes, beamGap, up, down, wall, beamRun, ice, windRise, crate, tide, mover, lift, bounce };

  const defs = {
    // ---------------------------------------------------------------- 1 Sunny Meadow: grab, swing, heave; safe drops
    'solo-1-1': [start(), up(0.5), up(0.7), ledge(1.2), down(0.8, 1.6), down(0.4), ledge(1.2), up(0.9, 1.5), ledge(1), goal()],
    'solo-1-2': [start(), down(1, 1.8), up(1.6), ledge(1), gap(0.5), up(0.8), gap(0.6), down(1.2, 1.6), up(1.8), ledge(1), goal()],
    'solo-1-3': [start(), gap(0.6), ledge(0.8), gap(0.75), up(1), gap(0.85), down(1.6), up(2.4), gap(0.9), ledge(1), goal()],
    'solo-1-4': [start(), gap(0.7), wall(2, 1.4), ledge(1), rope(1.7), ledge(0.8), down(1.4), gap(0.9), wall(2.6), rope(1.9), down(1.2), goal()],
    'solo-1-5': [start(), gap(0.8), crate(1.4), rope(1.9), down(1.5), beamGap(2), wall(3), rope(1.8), gap(0.9), down(3), goal(3)],

    // ---------------------------------------------------------------- 2 Bamboo Grove: vines, ropes, pendulums
    'solo-2-1': [start(), rope(1.7), ledge(0.8), rope(1.8), up(0.6), rope(1.9), ledge(1), gap(0.7), goal()],
    'solo-2-2': [start(), ropes(2, 1.0), ledge(1), rope(1.8), up(1), ropes(2, 1.1), wall(1.8), rope(2), down(2.8), goal()],
    'solo-2-3': [start(), rope(1.8, { floor: 'spikes' }), ledge(0.8), ropes(3, 1.0), up(1.2), rope(1.9, { floor: 'spikes' }), wall(2.4), ropes(2, 1.1, { floor: 'spikes' }), down(3.6), goal()],
    'solo-2-4': [start(), ropes(3, 1.0), up(0.8), gap(0.9), rope(2, { floor: 'spikes' }), wall(2), beamGap(2.6), ropes(3, 1, { floor: 'spikes' }), rope(1.8), down(2.8), goal()],
    'solo-2-5': [start(), ropes(3, 1.0), up(1), rope(2, { floor: 'spikes' }), wall(2.8), ropes(2, 1.1), up(0.8), ropes(3, 1.0, { floor: 'spikes' }), wall(2.2), rope(2), gap(0.9), beamGap(3), rope(1.9), down(3), down(3), goal(3)],

    // ---------------------------------------------------------------- 3 Lantern Caves: dark, short ledges, narrow swings, beams
    'solo-3-1': [start(), ledge(0.8), gap(0.8), up(0.8), rope(1.8), ledge(0.8), beamRun(2.5), down(0.8), gap(0.7), goal()],
    'solo-3-2': [start(), gap(0.9, 0.9), up(1.2, 1), rope(1.8), beamRun(3), gap(0.8, 0.9), wall(2.2), ropes(2, 1.1), down(3.4), goal()],
    'solo-3-3': [start(), beamRun(3), ledge(0.6), rope(1.9, { floor: 'spikes' }), up(1), gap(0.9, 0.9), ropes(3, 1.0), wall(2.6), beamGap(2.4), down(3.6), goal()],
    'solo-3-4': [start(), rope(1.8), beamRun(3.5), gap(0.9, 0.9), up(1), ropes(2, 1.1, { floor: 'spikes' }), wall(3), beamRun(2.5), gap(0.9, 0.9), rope(2), beamGap(3), down(4), goal()],
    'solo-3-5': [start(), beamRun(3), rope(1.9), up(0.8), ropes(3, 1.0), beamRun(3.5), wall(2.8), gap(0.9, 0.9), rope(2, { floor: 'spikes' }), beamGap(3.4), up(1), ropes(3, 1.0, { floor: 'spikes' }), beamRun(4), wall(2.4), gap(0.9), down(3.3), down(3.3), goal(3)],

    // ---------------------------------------------------------------- 4 Salt Flats: long gaps, wind, crates
    'solo-4-1': [start(), rope(2), ledge(0.8), windRise(2.5), down(2.5), beamGap(2.5), gap(0.9), up(1), goal()],
    'solo-4-2': [start(), ropes(3, 1.0), crate(1.4), windRise(3), down(3), rope(2), beamGap(3), wall(2), down(2), goal()],
    'solo-4-3': [start(), beamGap(3.2), windRise(3.5), down(3.5), ropes(3, 1.0), crate(1.6), rope(1.9), gap(0.9), up(1.4), ropes(2, 1.1), down(1.4), goal()],
    'solo-4-4': [start(), ropes(3, 1.0), windRise(3), rope(2), down(3), crate(1.5), beamGap(3.5), wall(3), gap(0.9), ropes(3, 1.0), down(3), goal()],
    'solo-4-5': [start(), beamGap(3.5), windRise(3.5), ropes(3, 1.0), down(3.5), crate(1.9), rope(2), windRise(3), beamGap(3.2), down(3), ropes(3, 1.0), wall(2.6), rope(2), gap(0.9), down(2.6), goal(3)],

    // ---------------------------------------------------------------- 5 Frozen Peaks: ice, slick slopes, tall climbs
    'solo-5-1': [start(), ice(0.6), ledge(0.8), gap(0.8), wall(2), ice(0.6), down(2.6), goal()],
    'solo-5-2': [start(), wall(2.6), ice(0.8), rope(1.8), ledge(0.6), ice(0.8), wall(2), down(3.6, 1.6), gap(0.9), goal()],
    'solo-5-3': [start(), ice(1), wall(3), ledge(0.6), gap(0.9), ice(0.8), rope(1.9, { floor: 'spikes' }), wall(2.4), ice(1), down(4.6, 1.6), beamGap(2.5), goal()],
    'solo-5-4': [start(), ice(0.8), wall(3), ice(1), ropes(2, 1.1), wall(3.2), gap(0.9), ice(1), beamGap(3), wall(2.6), down(4.6, 1.6), down(4.6, 1.6), goal()],
    'solo-5-5': [start(), ice(1), wall(3.2), ice(0.8), rope(2, { floor: 'spikes' }), wall(3), ice(1), ropes(3, 1.0), wall(3.4), gap(0.9), ice(1), beamGap(3.2), wall(3), ice(0.8), rope(2), wall(2.6), down(5, 1.6), down(5, 1.6), down(4.8, 1.8), goal(3)],
  };

  for (const id of Object.keys(defs)) {
    const p = C.parse(id);
    const camp = C.list[p.c - 1];
    L.register({
      id, name: C.levelName(p.c, p.n), theme: camp.theme, direction: 'right', coop: false,
      difficulty: p.c, seed: p.c * 1000 + p.n, segments: defs[id],
    });
  }
})();
