// Three throwaway levels that prove the level engine (Phase 3). Real campaigns replace these
// in Phases 6-9. test-all is a slow tour of every mechanic; it is not meant to be fair yet.
window.Dangle = window.Dangle || {};

(function () {
  const L = Dangle.Levels;

  // The how-to-play playground: a step, a small pit, a wall, the flag. Loaded by the How to play screen.
  L.register({
    id: 'howto', name: 'How to play', theme: 'meadow', direction: 'right', difficulty: 1, seed: 9, hidden: true,
    segments: [['start', { len: 4 }], ['gap', { w: 0.7 }], ['wall', { h: 2, len: 1.8 }], ['goal', { len: 3 }]],
  });

  L.register({
    id: 'test-h', name: 'Test: Horizontal', theme: 'meadow', direction: 'right', difficulty: 1, seed: 1,
    segments: [
      ['start', { len: 3.2 }],
      ['ledge', { len: 2 }],
      ['gap', { w: 0.8 }],
      ['step', { h: 0.8, len: 2 }],
      ['ledge', { len: 2 }],
      ['gap', { w: 1.7, aid: 'rope', floor: 'spikes' }],
      ['ledge', { len: 2 }],
      ['goal', { len: 3 }],
    ],
  });

  L.register({
    id: 'test-v', name: 'Test: Vertical', theme: 'frozen', direction: 'up', difficulty: 1, seed: 2,
    segments: [
      ['startUp', { width: 4 }],
      ['zigzag', { n: 4, dy: 1 }],
      ['windShaft', { h: 3 }],
      ['zigzag', { n: 3, dy: 1 }],
      ['goalUp', {}],
    ],
  });

  L.register({
    id: 'test-all', name: 'Test: Every mechanic', theme: 'finale', direction: 'right', difficulty: 2, seed: 3,
    segments: [
      ['start', { len: 3 }],
      ['ledge', { len: 2 }],
      ['gap', { w: 1.7, aid: 'rope' }],
      ['gap', { aid: 'ropes', n: 3, spacing: 1.2 }],
      ['gap', { w: 5, aid: 'mover', period: 7 }],
      ['iceSlope', { len: 3, rise: 0.8 }],
      ['ledge', { len: 1.5 }],
      ['crateStep', { h: 1.5 }],
      ['trampolineStep', { h: 2.4 }],
      ['noGrabClimb', { h: 2.6 }],
      ['step', { h: -3, len: 2.5 }],
      ['beamRun', { len: 3 }],
      ['windRise', { h: 3.5 }],
      ['step', { h: -3.5, len: 2 }],
      ['gap', { w: 0.9, floor: 'lava' }],
      ['tide', { len: 4 }],
      ['ledge', { len: 1.5 }],
      ['goal', { len: 3 }],
    ],
  });
})();
