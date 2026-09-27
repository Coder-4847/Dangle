// Co-op campaigns 1-5 (25 levels), built for two players: every level has at least two obstacles one player can't
// pass alone (config.LINT COOP_*, tools/coop-bots.js), mixed with the campaign's solo obstacles, which both players
// cross on their own. Distances are in REACH units; shorthands come from solo-campaigns.js (Levels.dsl).
// The co-op obstacles (segments.js):
//   gate    a portcullis held open by standing on a plate 3R+ away; a second plate beyond lets the partner through.
//   lever   a counterweight lift: hang on a handle and the partner's platform rises up a no-grab wall; a handle on
//           top brings the first one up.
//   heavy   a crate that only moves while both grip it and push the same way: push it to a no-grab wall, climb it.
//   chain   a 1.9-2.0R pit: one hangs off the lip with their head out, the other climbs over them to the far side;
//           the one left behind drops and comes back beside the partner (partner respawn).
// Each campaign introduces its co-op idea gently in level 1 and ends with a longer signature level.
window.Dangle = window.Dangle || {};

(function () {
  const L = Dangle.Levels;
  const C = Dangle.Campaigns;
  const { start, goal, ledge, gap, rope, ropes, beamGap, up, down, wall, beamRun, ice, windRise } = L.dsl;
  const gate = (dist, h) => ['gate', { dist: dist || 3.2, h: h || 3 }];
  const lever = (h) => ['leverLift', { h }];
  const heavy = (h, run) => ['heavyCrate', { h, run }];
  const chain = (w, floor) => ['gap', { w, aid: 'chain', floor: floor || 'spikes', land: 2 }];
  const S = { floor: 'spikes' };

  const defs = {
    // ---------------------------------------------------------------- 1 Sunny Meadow: plates, the heavy crate, the lift
    'coop-1-1': [start(), gate(), gap(0.6), up(0.5), gate(3.4), down(0.5), goal()],
    'coop-1-2': [start(), heavy(1.7, 1.8), down(1.7), gap(0.7), gate(), goal()],
    'coop-1-3': [start(), lever(2.2), down(2.2), up(0.6), heavy(1.7, 2), down(2.3), goal()],
    'coop-1-4': [start(), gate(), rope(1.7), lever(2.4), down(2.4), heavy(1.8, 2.2), down(1.8), goal()],
    'coop-1-5': [start(), gate(), up(0.8), heavy(1.9, 2.5), wall(1.5), lever(2.6), down(3.4), down(3.4), gap(0.9), gate(3.4), goal(3)],

    // ---------------------------------------------------------------- 2 Bamboo Grove: chains of friends, ropes
    'coop-2-1': [start(), chain(1.9), ledge(0.6), gate(), rope(1.8), goal()],
    'coop-2-2': [start(), ropes(2, 1.0), chain(1.9), up(0.8), chain(2.0), down(0.8), goal()],
    'coop-2-3': [start(), chain(2.0), heavy(1.8, 2), down(1.8), ropes(3, 1.0, S), chain(1.9), goal()],
    'coop-2-4': [start(), rope(1.9, S), chain(2.0), lever(2.4), down(2.4), chain(1.9), gate(), rope(2, S), goal()],
    'coop-2-5': [start(), chain(1.9), ropes(3, 1.0, S), gate(), chain(2.0), up(1), lever(2.6), down(1.8), down(1.8), chain(2.0), rope(2, S), heavy(1.9, 2.5), down(1.9), goal(3)],

    // ---------------------------------------------------------------- 3 Lantern Caves: gates and lifts in the dark
    'coop-3-1': [start(), beamRun(2.5), gate(), gap(0.8), lever(2.2), down(2.2), goal()],
    'coop-3-2': [start(), gate(3.4), beamGap(2.4), chain(1.9), up(1), gate(), down(1), goal()],
    'coop-3-3': [start(), lever(2.6), beamRun(3), down(2.6), heavy(1.8, 2), down(1.8), gate(), chain(2.0), goal()],
    'coop-3-4': [start(), gate(), rope(1.9, S), lever(3), beamGap(3, S), down(3), chain(2.0), heavy(1.8, 2.2), down(1.8), goal()],
    'coop-3-5': [start(), beamRun(3), gate(3.4), chain(2.0), lever(2.8), beamRun(3.5), down(2.8), heavy(1.9, 2.5), wall(1.2), down(3.1), chain(1.9), gate(), ropes(3, 1.0, S), goal(3)],

    // ---------------------------------------------------------------- 4 Salt Flats: heavy crates, wind, long spans
    'coop-4-1': [start(), heavy(1.7, 1.8), windRise(2.5), down(2.1), down(2.1), gate(), goal()],
    'coop-4-2': [start(), windRise(3), down(3), heavy(1.8, 2.5), down(1.8), chain(2.0), beamGap(3), goal()],
    'coop-4-3': [start(), gate(), beamGap(3.2), heavy(1.9, 3), windRise(3), down(2.45), down(2.45), chain(2.0), rope(2), goal()],
    'coop-4-4': [start(), chain(2.0), ropes(3, 1.0), heavy(1.8, 2.5), windRise(3.5), down(2.65), down(2.65), lever(2.4), down(2.4), gate(), goal()],
    'coop-4-5': [start(), heavy(1.9, 3.5), windRise(3.5), down(2.7), down(2.7), chain(2.0), beamGap(3.5), gate(3.6), lever(3), ropes(3, 1.0), down(3), heavy(1.8, 2.5), down(1.8), rope(2), goal(3)],

    // ---------------------------------------------------------------- 5 Frozen Peaks: lifts up icy walls, slick ledges
    'coop-5-1': [start(), ice(0.6), ledge(0.8), lever(2.2), down(2.8), gate(), goal()],
    'coop-5-2': [start(), lever(2.6), ice(0.8), ledge(0.8), heavy(1.8, 2), down(2.6), down(2.6), chain(1.9), goal()],
    'coop-5-3': [start(), wall(2.4), ice(1), ledge(0.8), lever(3), down(3.2), down(3.2), gate(), chain(2.0), goal()],
    'coop-5-4': [start(), ice(0.8), ledge(0.8), gate(), lever(3.2), ice(1), ledge(0.8), chain(2.0), heavy(1.8, 2.2), wall(2), down(2.9), down(2.9), down(3), goal()],
    'coop-5-5': [start(), ice(1), ledge(0.8), lever(3.5), wall(2.6), ice(1), ledge(0.8), chain(2.0), heavy(1.9, 2.5), gate(3.4), lever(3), ice(0.8), ledge(0.8), chain(2.0), rope(2, S), down(3.3), down(3.3), down(3.3), down(3.3), down(0.6), gate(), goal(3)],
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
