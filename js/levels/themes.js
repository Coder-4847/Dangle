// Theme palettes: one per campaign (flat, limited, warm cream base stays everywhere).
// Phase 4 refines these and adds scenery hooks; a theme may later provide decorate(spec).
window.Dangle = window.Dangle || {};

(function () {
  // ground: [fill, outline]; ice; hazard (spikes/lava); water; accent (flags, goal); post (ropes, beams)
  const T = {
    meadow:  { name: 'Sunny Meadow',    ground: ['#8fc17e', '#4d7f4a'], ice: ['#cfe8f2', '#7fa8bd'], hazard: '#e2574c', water: '#5aa9d6', accent: '#f2a03d', post: '#6d4a2f' },
    bamboo:  { name: 'Bamboo Grove',    ground: ['#9cc07a', '#557a3d'], ice: ['#cfe8f2', '#7fa8bd'], hazard: '#d9503f', water: '#4f9fbf', accent: '#e8b64a', post: '#7a5a2f' },
    caves:   { name: 'Lantern Caves',   ground: ['#8d7fa8', '#4a3f66'], ice: ['#bcd6ea', '#6d8fb0'], hazard: '#f06a4d', water: '#4a7fc0', accent: '#f6c453', post: '#5a4630' },
    salt:    { name: 'Salt Flats',      ground: ['#e0c9a0', '#9a7f55'], ice: ['#d8eef5', '#86b0c4'], hazard: '#cf4b3a', water: '#58b0c9', accent: '#e8734a', post: '#7a5a3a' },
    frozen:  { name: 'Frozen Peaks',    ground: ['#a9c4d6', '#5f7f96'], ice: ['#e4f4fb', '#8ab7cc'], hazard: '#d9503f', water: '#4a95c9', accent: '#f08a4b', post: '#5d5a66' },
    tidal:   { name: 'Tidal Ruins',     ground: ['#9fb6a6', '#566f5f'], ice: ['#cfe8f2', '#7fa8bd'], hazard: '#e2574c', water: '#3f8fbf', accent: '#f2b04a', post: '#5f5a4a' },
    clock:   { name: 'Clockwork Works', ground: ['#c9a27a', '#7a5a3a'], ice: ['#cfe8f2', '#7fa8bd'], hazard: '#d9503f', water: '#5aa0c9', accent: '#e8c04a', post: '#4f4a44' },
    sky:     { name: 'Sky Islands',     ground: ['#a8d5b0', '#5a9a72'], ice: ['#dff1fa', '#8fc0d6'], hazard: '#e2574c', water: '#66b3e0', accent: '#f26b8a', post: '#7a6a4a' },
    ember:   { name: 'Ember Depths',    ground: ['#a56a5a', '#5a3a34'], ice: ['#cfe0ea', '#7f9fb5'], hazard: '#ff7a3c', water: '#4a7fb0', accent: '#f6c453', post: '#3a2f2a' },
    finale:  { name: 'The Big Dangle',  ground: ['#8fc17e', '#3f6f52'], ice: ['#cfe8f2', '#7fa8bd'], hazard: '#e2574c', water: '#5aa9d6', accent: '#f26b8a', post: '#6d4a2f' },
  };
  Dangle.Themes = { get(id) { return T[id] || T.meadow; }, ids() { return Object.keys(T); } };
})();
