// Solo campaigns 6-10 (50 levels), authored from segments (shorthands come from solo-campaigns.js: Levels.dsl).
// Distances are in REACH units. A step up from campaigns 1-5: more obstacles per level, obstacles chained with
// little ground between them, and the timed / moving / bouncing mechanics. Everything used is proven by scripted
// players (tools/segment-bots.js, tools/level-bot.js): rising tides (crawl + optional wall, water speed planned at
// 1.35x the crossing time), sliding bridges up to 8R, lifts up to 6R, springboards up to a 3.2R wall, wind rises up
// to 3.5R (also beside a no-grab wall face), plus everything from campaigns 1-5.
//   6 Tidal Ruins: tides you outrun, then tides you climb out of.   7 Clockwork Works: sliding bridges and lifts.
//   8 Sky Islands: springboards, wind, ropes between islands, big drops.   9 Ember Depths: lava floors, lava tides,
//   no-grab wind shafts, tight landings.   10 The Big Dangle: all of it. Level 5 of each campaign is a mid-boss,
//   level 10 the signature finale.
window.Dangle = window.Dangle || {};

(function () {
  const L = Dangle.Levels;
  const C = Dangle.Campaigns;
  const { start, goal, ledge, gap, rope, ropes, beamGap, up, down, wall, beamRun, ice, windRise, crate, tide, mover, lift, bounce } = L.dsl;

  const W = { floor: 'water' }, S = { floor: 'spikes' }, V = { floor: 'lava' };            // pit floors (decoration: the pit kills)
  const tight = (o) => Object.assign({ land: 0.9 }, o);                                     // short landings
  const lavaGap = (w, land) => ['gap', { w, land: land || 1.2, floor: 'lava' }];
  const nog = (h) => windRise(h, true);                                                     // wind rise beside a no-grab face

  const defs = {
    // ---------------------------------------------------------------- 6 Tidal Ruins: rising water, timed sections
    'solo-6-1': [start(), tide(3), gap(0.7), up(1), tide(3.5), goal()],
    'solo-6-2': [start(), tide(4), up(0.8), tide(3, 1.5), gap(0.8), rope(1.8, W), goal()],
    'solo-6-3': [start(), gap(0.9), tide(4, 2), ledge(0.8), ropes(2, 1.0, W), tide(3.5), up(1.2), tide(3, 1.5), goal()],
    'solo-6-4': [start(), tide(4, 2.5), beamGap(2.5, W), tide(5), wall(2), gap(0.9), tide(3, 2), down(2), goal()],
    'solo-6-5': [start(), tide(4, 2), rope(1.9, W), tide(5), crate(1.4), tide(3, 3), beamGap(3, W), tide(4), down(3), goal()],
    'solo-6-6': [start(), tide(5, 2), ropes(3, 1.0, W), tide(4, 3), gap(0.9), tide(4), wall(2.4), beamRun(3), tide(3, 2), goal()],
    'solo-6-7': [start(), tide(5, 3), rope(2, W), tide(5), beamGap(3.2, W), tide(4, 3.5), down(3.5), ropes(2, 1.1, W), tide(4, 2), goal()],
    'solo-6-8': [start(), tide(6, 2), crate(1.6), tide(5, 3), rope(2, W), tide(4), wall(3), tide(5, 2.5), beamGap(3.5, W), tide(4), goal()],
    'solo-6-9': [start(), tide(6, 3), ropes(3, 1.0, W), tide(6), beamRun(3.5), tide(5, 3), rope(2, W), tide(5, 3.5), down(3.5), tide(4), gap(0.9), goal()],
    'solo-6-10': [start(), tide(6, 3), rope(2, W), tide(6, 3.5), beamGap(3.5, W), tide(5), ropes(3, 1.0, W), tide(5, 3), crate(1.9), tide(6, 3), beamRun(4), tide(5, 2.5), rope(2, W), tide(5, 3.5), down(4), tide(4), goal(3)],

    // ---------------------------------------------------------------- 7 Clockwork Works: sliding bridges, lifts, timing
    'solo-7-1': [start(), mover(3, 7), up(0.8), lift(2.5, 6), gap(0.7), goal()],
    'solo-7-2': [start(), lift(3, 7), mover(4, 7), wall(1.5), rope(1.8), down(3), goal()],
    'solo-7-3': [start(), mover(5, 8), lift(4, 8), gap(0.9), mover(4, 6), up(1), ropes(2, 1.0), goal()],
    'solo-7-4': [start(), lift(3.5, 7), mover(6, 8), beamGap(2.5), lift(2.5, 6), rope(1.9), mover(3, 6), goal()],
    'solo-7-5': [start(), mover(5, 7), lift(4, 8), mover(7, 8), crate(1.5), lift(5, 9), rope(2), mover(4, 6), down(6), goal()],
    'solo-7-6': [start(), lift(4, 7), mover(6, 7), wall(2.4), mover(5, 6), lift(3, 6), ropes(3, 1.0), mover(4, 7), beamRun(3), down(4), goal()],
    'solo-7-7': [start(), mover(7, 8), lift(5, 9), beamGap(3, S), lift(3, 6), mover(5, 6), rope(2, S), up(1), ledge(1.5), mover(6, 7), lift(2.5, 6), down(5), goal()],
    'solo-7-8': [start(), lift(5, 8), mover(8, 9), lift(4, 8), rope(2), mover(5, 6), crate(1.7), lift(6, 10), mover(6, 6), beamRun(3.5), down(6), goal()],
    'solo-7-9': [start(), mover(6, 6), lift(4, 7), mover(8, 8), ropes(3, 1.0, S), lift(5, 8), beamGap(3.5, S), mover(5, 6), lift(3, 6), mover(7, 7), wall(3), down(6), goal()],
    'solo-7-10': [start(), lift(5, 8), mover(8, 8), lift(6, 10), mover(6, 6), rope(2, S), lift(4, 7), ropes(3, 1.0, S), mover(8, 9), beamRun(4), lift(5, 8), mover(7, 7), crate(1.9), lift(6, 9), mover(5, 6), beamGap(3.5, S), lift(3, 6), mover(6, 6), down(7), goal(3)],

    // ---------------------------------------------------------------- 8 Sky Islands: springboards, wind, big drops
    'solo-8-1': [start(), bounce(1, 1.6), gap(0.8), windRise(2.5), down(2.5), goal()],
    'solo-8-2': [start(), bounce(1, 2.2), rope(1.8), windRise(3), down(3), bounce(1, 1.8), goal()],
    'solo-8-3': [start(), windRise(3.5), down(3.5), bounce(1, 2.6), rope(1.9, tight()), ledge(0.6), ropes(2, 1.0), goal()],
    'solo-8-4': [start(), bounce(1.2, 3), rope(2, tight()), windRise(2.5), down(3), beamGap(2.5), bounce(1, 2.4), down(2), goal()],
    'solo-8-5': [start(), bounce(1, 2.6), ropes(3, 1.0, tight()), windRise(3.5), down(6), bounce(1.2, 3.2), rope(2), gap(0.9), down(3), goal()],
    'solo-8-6': [start(), windRise(3.5), down(3.5), bounce(1, 3), beamGap(3, tight()), bounce(1.4, 2.6), rope(2, tight()), windRise(3), ropes(3, 1.0, tight()), bounce(1.2, 3), down(6), goal()],
    'solo-8-7': [start(), bounce(1.2, 3.2), ropes(3, 1.0, tight()), down(3), windRise(3.5), down(3.5), bounce(1, 2.2), beamGap(3.5), rope(2, tight()), bounce(1, 3.2), rope(2, tight()), down(5), goal()],
    'solo-8-8': [start(), bounce(1, 3.2), rope(2, tight()), bounce(1.4, 3), windRise(3.5), down(6), ropes(3, 1.0, tight()), bounce(1, 2.6), gap(0.9, 1), beamGap(3.2), windRise(3.5), ropes(2, 1.1, tight()), down(4), goal()],
    'solo-8-9': [start(), windRise(3.5), bounce(1.2, 3.2), down(3.5), rope(2, tight()), beamGap(3.5, tight()), bounce(1, 3), ropes(3, 1.0, tight()), windRise(3), down(6), bounce(1.4, 3.2), rope(2), beamGap(3.5), bounce(1.4, 3.2), down(3.5), goal()],
    'solo-8-10': [start(), bounce(1, 3.2), rope(2, tight()), windRise(3.5), down(3.5), ropes(3, 1.0, tight()), bounce(1.4, 3.2), beamGap(3.5, tight()), windRise(3.5), down(7), rope(2, tight()), bounce(1, 3.2), gap(0.9, 1), ropes(3, 1.0), windRise(3), bounce(1.4, 3.2), beamGap(3.5, tight()), down(6), goal(3)],

    // ---------------------------------------------------------------- 9 Ember Depths: lava, no-grab shafts, tight routes
    'solo-9-1': [start(), lavaGap(0.8), up(1), rope(1.8, V), nog(2.5), down(2.5), goal()],
    'solo-9-2': [start(), lavaGap(0.9, 0.9), beamGap(2.5, V), up(1.2), rope(1.9, V), nog(3), down(3), goal()],
    'solo-9-3': [start(), tide(4, 2, 'lava'), lavaGap(0.9, 0.9), ropes(2, 1.0, V), nog(2.5), down(2.5), beamRun(3), goal()],
    'solo-9-4': [start(), rope(2, tight(V)), nog(3.5), down(3.5), tide(4, 2.5, 'lava'), beamGap(3, V), lavaGap(0.9, 0.9), ice(0.8), down(1), goal()],
    'solo-9-5': [start(), ropes(3, 1.0, tight(V)), nog(3), down(3), tide(5, 2, 'lava'), beamRun(3.5), lavaGap(0.9, 0.9), rope(2, V), ice(1), down(1.5), goal()],
    'solo-9-6': [start(), tide(5, 3, 'lava'), beamGap(3.2, tight(V)), nog(3.5), down(3.5), rope(2, tight(V)), ice(1), wall(2.4), lavaGap(0.9, 0.9), rope(2, tight(V)), beamRun(3.5), down(2.4), goal()],
    'solo-9-7': [start(), nog(3.5), down(3.5), ropes(3, 1.0, tight(V)), tide(5, 3, 'lava'), beamRun(4), lavaGap(0.9, 0.9), ice(1), rope(2, tight(V)), wall(3), tide(5, 2.5, 'lava'), rope(2, tight(V)), down(4), goal()],
    'solo-9-8': [start(), rope(2, tight(V)), nog(3.5), down(3.5), tide(6, 2.5, 'lava'), beamGap(3.5, tight(V)), lavaGap(0.9, 0.9), ice(1), ropes(3, 1.0, tight(V)), nog(3), down(3), lavaGap(0.9, 0.9), rope(2, tight(V)), goal()],
    'solo-9-9': [start(), tide(6, 3, 'lava'), nog(3.5), rope(2, tight(V)), down(3.5), beamRun(4), lavaGap(0.9, 0.9), ice(1), tide(5, 3.5, 'lava'), ropes(3, 1.0, tight(V)), beamGap(3.5, V), wall(3), nog(3), rope(2, tight(V)), down(6.5), goal()],
    'solo-9-10': [start(), nog(3.5), down(3.5), tide(6, 3, 'lava'), rope(2, tight(V)), ice(1), ledge(0.8), lavaGap(0.9, 0.9), ropes(3, 1.0, tight(V)), nog(3.5), down(3.5), beamGap(3.5, tight(V)), tide(6, 3.5, 'lava'), beamRun(4), lavaGap(0.9, 0.9), rope(2, tight(V)), ice(1), wall(3), down(4), goal(3)],

    // ---------------------------------------------------------------- 10 The Big Dangle: every mechanic combined
    'solo-10-1': [start(), tide(4, 2), mover(4, 7), bounce(1, 2.4), rope(1.9, S), nog(2.5), down(2.5), goal()],
    'solo-10-2': [start(), lift(3, 7), rope(2, W), ice(0.8), tide(4, 2.5, 'lava'), beamGap(3, V), bounce(1, 2.6), crate(1.5), down(3), goal()],
    'solo-10-3': [start(), ropes(3, 1.0, S), mover(5, 7), nog(3), down(3), tide(5, 2), lift(4, 8), beamRun(3), lavaGap(0.9, 0.9), goal()],
    'solo-10-4': [start(), bounce(1, 3), rope(2, tight(W)), tide(5, 3), ice(1), mover(6, 7), beamGap(3, S), lift(3, 6), nog(3.5), down(6), goal()],
    'solo-10-5': [start(), tide(5, 3), rope(2, W), bounce(1.2, 3.2), ropes(3, 1.0, S), lift(5, 8), mover(7, 8), ice(1), beamRun(3.5), nog(3.5), down(6), lavaGap(0.9, 0.9), goal()],
    'solo-10-6': [start(), mover(6, 6), lift(4, 7), tide(5, 3, 'lava'), beamGap(3.5, V), bounce(1, 3), rope(2, tight(V)), ice(1), ledge(0.8), crate(1.7), nog(3), down(3), ropes(3, 1.0, tight(S)), mover(6, 7), bounce(1, 3), down(4), goal()],
    'solo-10-7': [start(), tide(6, 3), bounce(1.4, 3.2), mover(7, 7), ropes(3, 1.0, tight(W)), lift(5, 8), nog(3.5), down(5), beamRun(4), ice(1), rope(2, V), tide(5, 2.5, 'lava'), lift(4, 8), beamGap(3, S), down(3), goal()],
    'solo-10-8': [start(), lift(6, 10), rope(2, tight(S)), mover(8, 8), bounce(1, 3.2), tide(6, 3, 'lava'), beamGap(3.5, tight(V)), ice(1), ropes(3, 1.0, W), nog(3.5), down(6), crate(1.9), lavaGap(0.9, 0.9), ropes(3, 1.0, tight(W)), tide(5, 3), down(3), goal()],
    'solo-10-9': [start(), tide(6, 3.5), mover(8, 8), bounce(1.2, 3.2), ropes(3, 1.0, tight(S)), lift(5, 8), ice(1), beamRun(4), nog(3.5), rope(2, tight(V)), down(6), tide(6, 3, 'lava'), beamGap(3.5, W), lavaGap(0.9, 0.9), wall(3), crate(1.7), mover(6, 7), down(6), goal()],
    'solo-10-10': [start(), tide(6, 3), lift(6, 10), rope(2, tight(W)), mover(8, 8), bounce(1.4, 3.2), ropes(3, 1.0, tight(S)), nog(3.5), down(3.5), ice(1), beamRun(4), tide(6, 3.5, 'lava'), crate(1.9), beamGap(3.5, tight(V)), lift(5, 8), rope(2, tight(V)), mover(7, 7), bounce(1, 3.2), lavaGap(0.9, 0.9), ropes(3, 1.0, W), wall(3.4), ice(1), down(9), goal(3)],
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
