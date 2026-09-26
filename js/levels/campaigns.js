// The campaign table (10 per mode; campaigns 1-5 have 5 levels, 6-10 have 10 = 75 levels per mode) and
// the level ids that hang off it: 'solo-3-2' = solo mode, campaign 3, level 2.
//
// Until the real levels are authored (Phases 6-9), any id without a registered definition gets a
// generated PLACEHOLDER built from the campaign's signature mechanics, so every menu path is playable
// and lint-clean today. A real definition registered under the same id simply replaces the stub.
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

  // ---- placeholder generator ------------------------------------------------------------------
  function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // Obstacle makers: t = 0..1 difficulty, return [segmentName, options, rise (REACH units gained)].
  const OB = {
    gapPlain: (t) => ['gap', { w: 0.5 + 0.4 * t }, 0],
    gapRope: (t) => ['gap', { w: 1.7 + 0.3 * t, aid: 'rope' }, 0],
    ropes: (t) => ['gap', { aid: 'ropes', n: t > 0.55 ? 3 : 2, spacing: t > 0.55 ? 1.0 : 1.1 }, 0],
    mover: (t) => ['gap', { w: 3 + 2 * t, aid: 'mover', period: 8 - 2 * t }, 0],
    lavaGap: (t) => ['gap', { w: 0.5 + 0.4 * t, floor: 'lava' }, 0],
    lavaRope: (t) => ['gap', { w: 1.8 + 0.2 * t, aid: 'rope', floor: 'lava' }, 0],
    spikeRope: (t) => ['gap', { w: 1.8 + 0.2 * t, aid: 'rope', floor: 'spikes' }, 0],
    stepUp: (t) => { const h = 0.5 + 0.6 * t; return ['step', { h, len: 2 }, h]; },
    wall: (t) => { const h = 2 + 1.5 * t; return ['wall', { h }, h]; },
    crate: (t) => { const h = 1.2 + 0.5 * t; return ['crateStep', { h }, h]; },
    ice: (t) => { const h = 0.6 + 0.4 * t; return ['iceSlope', { len: 3, rise: h }, h]; },
    noGrab: (t) => { const h = 2 + 0.8 * t; return ['noGrabClimb', { h }, h]; },
    tramp: (t) => { const h = 1.8 + 0.9 * t; return ['trampolineStep', { h }, h]; },
    windRise: (t) => { const h = 2.5 + 1.0 * t; return ['windRise', { h }, h]; },
    beam: (t) => ['beamRun', { len: 2.5 + 1.5 * t }, 0],
    tide: (t) => ['tide', { len: 3 + 2 * t, kind: 'water' }, 0],
  };
  const POOLS = {
    1: ['gapPlain', 'stepUp', 'crate', 'gapPlain'],
    2: ['gapRope', 'ropes', 'gapPlain', 'stepUp', 'gapRope'],
    3: ['beam', 'noGrab', 'gapPlain', 'stepUp', 'wall'],
    4: ['crate', 'windRise', 'gapPlain', 'gapRope', 'wall'],
    5: ['ice', 'wall', 'gapPlain', 'stepUp', 'ice'],
    6: ['tide', 'gapPlain', 'gapRope', 'stepUp', 'wall', 'tide'],
    7: ['mover', 'gapRope', 'ropes', 'gapPlain', 'stepUp', 'mover'],
    8: ['tramp', 'windRise', 'ropes', 'gapRope', 'tramp'],
    9: ['lavaGap', 'lavaRope', 'beam', 'noGrab', 'wall', 'ice', 'spikeRope'],
    10: Object.keys(OB),
  };

  function stub(id) {
    const p = parse(id);
    if (!p) return null;
    const camp = list[p.c - 1];
    const rnd = rngFrom(p.c * 7919 + p.n * 104729 + (p.mode === 'coop' ? 13 : 0));
    const last = p.n === camp.levels;
    const t = camp.levels === 1 ? 0 : (p.n - 1) / (camp.levels - 1);       // 0..1 across the campaign
    const def = {
      id, name: levelName(p.c, p.n), theme: camp.theme, coop: p.mode === 'coop',
      difficulty: p.c, seed: p.c * 1000 + p.n, stub: true, direction: 'right', segments: [],
    };
    const segs = def.segments;

    // Frozen Peaks: every other level is a climb up a shaft instead.
    if (p.c === 5 && p.n % 2 === 0) {
      def.direction = 'up';
      const n = 4 + Math.min(3, Math.floor(p.n / 2));
      segs.push(['startUp', { width: 4 }], ['zigzag', { n, dy: 1 }], ['windShaft', { h: 2.5 + t }], ['zigzag', { n: n - 1, dy: 1 }], ['goalUp', {}]);
      return def;
    }

    const count = (camp.levels === 5 ? 2 + p.n : 3 + p.n) + (last ? 2 : 0);
    const pool = POOLS[p.c];
    segs.push(['start', { len: 3.2 }]);
    let height = 0;
    let prev = '';
    for (let i = 0; i < count; i++) {
      let name = pool[Math.floor(rnd() * pool.length)];
      if (name === prev && rnd() < 0.7) name = pool[Math.floor(rnd() * pool.length)];
      prev = name;
      const tt = Math.min(1, t * 0.7 + (i / count) * 0.3 + (last ? 0.15 : 0));
      const [seg, opts, rise] = OB[name](tt);
      segs.push([seg, opts]);
      height += rise;
      if (height > 3.5 || (height > 1.5 && rnd() < 0.3)) { segs.push(['step', { h: -height, len: 2 }]); height = 0; }
    }
    if (height > 0.2) segs.push(['step', { h: -height, len: 2 }]);
    segs.push(['goal', { len: 3 }]);
    return def;
  }

  // The definition for an id: a registered (authored) one wins over the stub.
  function def(id) { return Dangle.Levels.find(id); }

  function allIds(mode) {
    const ids = [];
    for (const c of list) for (let n = 1; n <= c.levels; n++) ids.push(levelId(mode, c.id, n));
    return ids;
  }

  Dangle.Campaigns = { list, levelId, parse, levelName, totalLevels, stub, def, allIds };
})();
