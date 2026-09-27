// The campaign table (10 per mode; campaigns 1-5 have 5 levels, 6-10 have 10 = 75 levels per mode) and
// the level ids that hang off it: 'solo-3-2' = solo mode, campaign 3, level 2. The level definitions themselves
// are authored in solo-campaigns*.js and coop-campaigns*.js.
window.Dangle = window.Dangle || {};

(function () {
  const list = [
    { id: 1,  name: 'Sunny Meadow',    theme: 'meadow', levels: 5,  idea: 'Learn to grab, swing, heave' },
    { id: 2,  name: 'Bamboo Grove',    theme: 'bamboo', levels: 5,  idea: 'Vines, ropes, pendulums' },
    { id: 3,  name: 'Lantern Caves',   theme: 'caves',  levels: 5,  idea: 'Dark, narrow swings' },
    { id: 4,  name: 'Salt Flats',      theme: 'salt',   levels: 5,  idea: 'Long gaps, wind, crates' },
    { id: 5,  name: 'Frozen Peaks',    theme: 'frozen', levels: 5,  idea: 'Ice and vertical climbs' },
    { id: 6,  name: 'Tidal Ruins',     theme: 'tidal',  levels: 10, idea: 'Rising water, timed sections' },
    { id: 7,  name: 'Clockwork Works', theme: 'clock',  levels: 10, idea: 'Moving platforms, timing' },
    { id: 8,  name: 'Sky Islands',     theme: 'sky',    levels: 10, idea: 'Trampolines, wind, big drops' },
    { id: 9,  name: 'Ember Depths',    theme: 'ember',  levels: 10, idea: 'Lava, no-grab walls' },
    { id: 10, name: 'The Big Dangle',  theme: 'finale', levels: 10, idea: 'Everything at once' },
  ];

  function levelId(mode, c, n) { return `${mode}-${c}-${n}`; }
  function parse(id) {
    const m = /^(solo|coop)-(\d+)-(\d+)$/.exec(id);
    if (!m) return null;
    const c = +m[2], n = +m[3];
    if (c < 1 || c > list.length || n < 1 || n > list[c - 1].levels) return null;
    return { mode: m[1], c, n };
  }
  function levelName(c, n) { return `${list[c - 1].name} ${n}`; }
  function totalLevels() { return list.reduce((s, c) => s + c.levels, 0); }

  // The authored definition for an id.
  function def(id) { return Dangle.Levels.find(id); }

  function allIds(mode) {
    const ids = [];
    for (const c of list) for (let n = 1; n <= c.levels; n++) ids.push(levelId(mode, c.id, n));
    return ids;
  }

  Dangle.Campaigns = { list, levelId, parse, levelName, totalLevels, def, allIds };
})();
