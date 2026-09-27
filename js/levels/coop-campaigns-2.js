// Co-op campaigns 6-10 (50 levels), a step up from co-op 1-5: more obstacles per level, combined with the timed /
// moving / bouncing mechanics from solo 6-10 (js/levels/solo-campaigns-2.js). Every level still has 2+ co-op-only
// obstacles (lint), now often back to back; level 5 of each campaign is a mid-boss, level 10 the finale.
// Shorthands: solo ones from solo-campaigns.js (Levels.dsl), co-op ones from coop-campaigns.js (Levels.dslCoop).
// Verified ranges beyond Phase 8 (tools/coop-bots.js, quick extra checks before authoring): lever lift up to 5.5R
// (no wall climb at the top: the platform carries you all the way), gate plate distance up to 6R, heavy crate wall
// up to 2.2R (2.5R and up fails: crateWall's climb runs out); kept a margin under each. Chain gaps stay 1.9-2.0R
// over any floor (spikes/lava/water: the fall is the same hazard death either way).
//   6 Tidal Ruins: tides around gates, lifts and chains.   7 Clockwork Works: sliding bridges and lifts next to
//   the co-op devices.   8 Sky Islands: springboards and wind with chains, big drops.   9 Ember Depths: lava tides,
//   lava chains, no-grab wind shafts.   10 The Big Dangle: everything, finale.
window.Dangle = window.Dangle || {};

(function () {
  const L = Dangle.Levels;
  const C = Dangle.Campaigns;
  const { start, goal, ledge, gap, rope, ropes, beamGap, up, down, wall, beamRun, ice, windRise, tide, mover, lift, bounce } = L.dsl;
  const { gate, lever, heavy, chain } = L.dslCoop;

  const W = { floor: 'water' }, S = { floor: 'spikes' }, V = { floor: 'lava' };
  const tight = (o) => Object.assign({ land: 0.9 }, o);
  const lavaGap = (w, land) => ['gap', { w, land: land || 1.2, floor: 'lava' }];
  const nog = (h) => windRise(h, true);

  const defs = {
    // ---------------------------------------------------------------- 6 Tidal Ruins: tides around gates, lifts, chains
    'coop-6-1': [start(), tide(3), gate(), tide(3, 1.5), chain(2.0), goal()],
    'coop-6-2': [start(), tide(3.5), heavy(1.7, 1.8), down(1.7), tide(4), chain(2.0), goal()],
    'coop-6-3': [start(), tide(4), lever(2.4), down(2.4), tide(3, 1.5), gate(), rope(1.8, W), goal()],
    'coop-6-4': [start(), gate(), tide(4, 2), chain(2.1), tide(5), heavy(1.8, 2), down(1.8), goal()],
    'coop-6-5': [start(), tide(4), lever(2.8), tide(5, 2), down(2.8), gate(3.6), chain(2.0), rope(2, W), tide(4), goal()],
    'coop-6-6': [start(), tide(5), gate(), chain(2.1), tide(4, 2.5), heavy(1.8, 2.2), down(1.8), tide(4), goal()],
    'coop-6-7': [start(), tide(5, 2), lever(3), tide(5), down(3), chain(2.0), gate(3.6), tide(4, 2), rope(2, W), goal()],
    'coop-6-8': [start(), gate(), tide(5), heavy(1.9, 2.5), tide(4, 2.5), down(1.9), chain(2.1), tide(5), lever(2.6), down(2.6), goal()],
    'coop-6-9': [start(), tide(5, 2), chain(2.0), gate(3.8), tide(6), lever(3.2), tide(5, 2.5), down(3.2), heavy(1.8, 2.2), tide(4), down(1.8), goal()],
    'coop-6-10': [start(), tide(5), gate(), chain(2.1), tide(5, 2.5), lever(3.5), tide(6), down(3.5), heavy(1.9, 2.5), tide(5, 2.5), down(1.9), chain(2.0), gate(4), tide(6), rope(2, W), goal(3)],

    // ---------------------------------------------------------------- 7 Clockwork Works: sliding bridges, lifts, gates
    'coop-7-1': [start(), mover(3, 7), gate(), heavy(1.7, 1.8), down(1.7), goal()],
    'coop-7-2': [start(), lever(2.6), down(2.6), mover(4, 7), chain(2.0), goal()],
    'coop-7-3': [start(), mover(5, 8), heavy(1.7, 2), down(1.7), gate(), rope(1.9), goal()],
    'coop-7-4': [start(), gate(), mover(4, 6), lever(3), down(3), chain(2.1), mover(5, 7), goal()],
    'coop-7-5': [start(), mover(5, 7), gate(3.6), heavy(1.8, 2.2), down(1.8), mover(6, 7), chain(2.0), lever(2.8), down(2.8), goal()],
    'coop-7-6': [start(), lever(3.2), down(3.2), mover(6, 7), gate(), chain(2.1), mover(5, 6), heavy(1.9, 2.2), down(1.9), goal()],
    'coop-7-7': [start(), mover(6, 8), gate(4), lever(3.5), down(3.5), mover(7, 8), chain(2.0), rope(2, S), heavy(1.8, 2.2), down(1.8), goal()],
    'coop-7-8': [start(), gate(), mover(6, 7), heavy(1.9, 2.2), down(1.9), lever(3.4), mover(7, 7), down(3.4), chain(2.1), mover(5, 6), goal()],
    'coop-7-9': [start(), mover(7, 8), lever(3.8), gate(4.2), down(3.8), mover(6, 6), chain(2.0), heavy(1.8, 2.2), mover(7, 7), down(1.8), rope(2, S), goal()],
    'coop-7-10': [start(), mover(7, 8), gate(), lever(4), mover(6, 6), down(4), chain(2.1), mover(8, 8), heavy(1.9, 2.2), down(1.9), gate(4.6), mover(6, 7), chain(2.0), lever(3.4), down(3.4), goal(3)],

    // ---------------------------------------------------------------- 8 Sky Islands: springboards, wind, chains, drops
    'coop-8-1': [start(), gate(), bounce(1, 1.8), chain(2.0), goal()],
    'coop-8-2': [start(), gate(), windRise(2.5), down(2.5), bounce(1, 2.2), chain(2.1), goal()],
    'coop-8-3': [start(), bounce(1, 2.6), heavy(1.7, 2), down(1.7), windRise(3), down(3), chain(2.0), goal()],
    'coop-8-4': [start(), lever(2.6), down(2.6), bounce(1, 2.6), gate(), windRise(3), down(3), chain(2.1), rope(1.9, tight()), goal()],
    'coop-8-5': [start(), bounce(1.2, 3), chain(2.0), windRise(3.5), down(3.5), heavy(1.8, 2.2), down(1.8), gate(3.6), bounce(1, 2.6), chain(2.1), goal()],
    'coop-8-6': [start(), gate(), bounce(1, 2.6), lever(3), down(3), windRise(3), down(3), chain(2.0), bounce(1.2, 3), heavy(1.9, 2.2), down(1.9), goal()],
    'coop-8-7': [start(), bounce(1, 3), windRise(3.5), down(3.5), gate(4), chain(2.1), bounce(1.4, 3), lever(3.2), down(3.2), heavy(1.8, 2.2), down(1.8), goal()],
    'coop-8-8': [start(), windRise(3), down(3), bounce(1.2, 3), heavy(1.9, 2.2), down(1.9), gate(), chain(2.0), bounce(1, 2.6), windRise(3.5), down(3.5), lever(2.8), down(2.8), goal()],
    'coop-8-9': [start(), bounce(1, 3), gate(4), chain(2.1), windRise(3.5), down(3.5), heavy(1.8, 2.2), bounce(1.4, 3), down(1.8), lever(3.4), down(3.4), chain(2.0), rope(2, tight()), goal()],
    'coop-8-10': [start(), gate(), bounce(1, 3), windRise(3.5), down(3.5), chain(2.1), heavy(1.9, 2.2), bounce(1.2, 3), down(1.9), lever(3.6), down(3.6), gate(4.4), chain(2.0), windRise(3), bounce(1.4, 3), down(3), goal(3)],

    // ---------------------------------------------------------------- 9 Ember Depths: lava tides, lava chains, no-grab shafts
    'coop-9-1': [start(), gate(), lavaGap(0.8), chain(2.0, 'lava'), goal()],
    'coop-9-2': [start(), gate(), nog(2.5), down(2.5), chain(2.1, 'lava'), goal()],
    'coop-9-3': [start(), tide(4, 2, 'lava'), heavy(1.7, 2), down(1.7), lavaGap(0.9, 0.9), chain(2.0, 'lava'), goal()],
    'coop-9-4': [start(), nog(3), down(3), gate(3.6), lever(2.8), down(2.8), chain(2.1, 'lava'), rope(1.9, tight(V)), goal()],
    'coop-9-5': [start(), tide(5, 2.5, 'lava'), chain(2.0, 'lava'), gate(), nog(3.5), down(3.5), heavy(1.8, 2.2), down(1.8), chain(2.1, 'lava'), goal()],
    'coop-9-6': [start(), gate(3.8), tide(5, 2.5, 'lava'), lever(3.2), down(3.2), chain(2.0, 'lava'), nog(3), down(3), heavy(1.9, 2.2), down(1.9), goal()],
    'coop-9-7': [start(), nog(3.5), down(3.5), chain(2.1, 'lava'), gate(4), tide(5, 3, 'lava'), lever(3.4), down(3.4), rope(2, tight(V)), chain(2.0, 'lava'), goal()],
    'coop-9-8': [start(), heavy(1.8, 2.2), down(1.8), gate(), nog(3.5), down(3.5), tide(5, 3, 'lava'), chain(2.1, 'lava'), lever(3.6), down(3.6), chain(2.0, 'lava'), goal()],
    'coop-9-9': [start(), gate(4), chain(2.0, 'lava'), tide(6, 3, 'lava'), nog(3.5), down(3.5), heavy(1.9, 2.2), down(1.9), lever(3.8), down(3.8), chain(2.1, 'lava'), rope(2, tight(V)), goal()],
    'coop-9-10': [start(), gate(), nog(3.5), down(3.5), chain(2.1, 'lava'), tide(6, 3, 'lava'), heavy(1.8, 2.2), down(1.8), lever(4), down(4), gate(4.4), chain(2.0, 'lava'), tide(5, 2.5, 'lava'), nog(3), down(3), chain(2.1, 'lava'), goal(3)],

    // ---------------------------------------------------------------- 10 The Big Dangle: everything combined
    'coop-10-1': [start(), tide(3), gate(), mover(4, 7), chain(2.0), goal()],
    'coop-10-2': [start(), bounce(1, 2.2), heavy(1.7, 2), down(1.7), windRise(2.5), down(2.5), chain(2.1), goal()],
    'coop-10-3': [start(), lever(2.8), down(2.8), tide(4, 2), gate(), mover(5, 7), chain(2.0, 'lava'), goal()],
    'coop-10-4': [start(), gate(), nog(3), down(3), heavy(1.8, 2.2), down(1.8), chain(2.1, S), rope(1.9), mover(4, 6), goal()],
    'coop-10-5': [start(), tide(4, 2), chain(2.0), bounce(1, 2.6), lever(3), down(3), gate(3.6), mover(5, 7), chain(2.1, 'lava'), goal()],
    'coop-10-6': [start(), mover(5, 7), gate(), heavy(1.9, 2.2), down(1.9), tide(5, 2.5, 'lava'), chain(2.0, 'lava'), windRise(3), down(3), lever(3.2), down(3.2), goal()],
    'coop-10-7': [start(), gate(4), bounce(1.2, 3), chain(2.1), mover(6, 7), lever(3.4), down(3.4), nog(3.5), down(3.5), heavy(1.8, 2.2), down(1.8), chain(2.0, 'lava'), goal()],
    'coop-10-8': [start(), tide(5, 2.5), heavy(1.9, 2.2), down(1.9), gate(), mover(6, 7), chain(2.1, S), bounce(1, 3), lever(3.6), down(3.6), tide(5, 3, 'lava'), chain(2.0, 'lava'), goal()],
    'coop-10-9': [start(), mover(6, 7), gate(4.2), nog(3.5), down(3.5), chain(2.1), lever(3.8), down(3.8), tide(5, 2.5, 'lava'), heavy(1.8, 2.2), down(1.8), chain(2.0, 'lava'), bounce(1.4, 3), goal()],
    'coop-10-10': [
      start(), tide(4, 2), gate(), mover(5, 7), chain(2.0), lever(3), down(3), heavy(1.7, 2), down(1.7),
      bounce(1, 2.6), windRise(3), down(3), chain(2.1, S), gate(4), tide(5, 2.5, 'lava'), mover(6, 7),
      nog(3.5), down(3.5), lever(3.6), down(3.6), heavy(1.9, 2.2), down(1.9), chain(2.0, 'lava'),
      rope(2, tight(V)), gate(4.4), chain(2.1, 'lava'), goal(3),
    ],
  };

  for (const id of Object.keys(defs)) {
    const p = C.parse(id);
    const camp = C.list[p.c - 1];
    L.register({
      id, name: C.levelName(p.c, p.n), theme: camp.theme, direction: 'right', coop: true,
      difficulty: p.c, seed: p.c * 1000 + p.n + 500, segments: defs[id],
    });
  }
})();
