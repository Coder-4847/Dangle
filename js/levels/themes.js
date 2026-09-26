// Theme palettes, one per campaign. Flat and limited: the cream base (config.BG_COLOR) stays everywhere;
// each theme adds ground (fill/edge/top band), a pale far layer, one accent and a scenery set.
//   ground: [fill, edge]  top: surface band  ice: [fill, edge]  far: distant layer
//   accent: flags/goal/trampolines  post: ropes/poles  scenery: [kinds]  sc: scenery colours
//   dark: true = only light around players/lanterns (Lantern Caves)
window.Dangle = window.Dangle || {};

(function () {
  const T = {
    meadow: { name: 'Sunny Meadow', ground: ['#9fcf85', '#4f8a4a'], top: '#c3e396', ice: ['#d6ecf3', '#7fa8bd'], far: '#ecebc8',
      hazard: '#e8604f', water: '#5aa9d6', accent: '#f26b5b', post: '#7a5434', scenery: ['tuft', 'flower', 'tuft', 'bush'], sc: ['#6fae5c', '#f4d35e', '#f29ab6'] },
    bamboo: { name: 'Bamboo Grove', ground: ['#a9c47f', '#5e7a3a'], top: '#cadd98', ice: ['#d6ecf3', '#7fa8bd'], far: '#e3e9c9',
      hazard: '#dc5a44', water: '#4f9fbf', accent: '#e8a23a', post: '#7a5a2f', scenery: ['stalk', 'tuft', 'stalk', 'leafy'], sc: ['#b7cf8f', '#7fa35a', '#e8a23a'] },
    caves: { name: 'Lantern Caves', ground: ['#8a7ca3', '#463b5f'], top: '#a497ba', ice: ['#c3dbee', '#6d8fb0'], far: '#ddd5e6', dark: true,
      hazard: '#f06a4d', water: '#4a7fc0', accent: '#f6c453', post: '#5a4630', scenery: ['crystal', 'lantern', 'crystal', 'shroom'], sc: ['#8fd3e8', '#f6c453', '#c78fe0'] },
    salt: { name: 'Salt Flats', ground: ['#e8d5b0', '#a3875f'], top: '#f7eedc', ice: ['#dcf0f6', '#86b0c4'], far: '#f3e4cb',
      hazard: '#d4513e', water: '#58b0c9', accent: '#e8734a', post: '#7a5a3a', scenery: ['saltcube', 'cactus', 'saltcube', 'pebble'], sc: ['#ffffff', '#8fb872', '#c9b08a'] },
    frozen: { name: 'Frozen Peaks', ground: ['#b3cadb', '#5d7c95'], top: '#f4f9fc', ice: ['#e6f5fb', '#86b5cb'], far: '#e5edf1',
      hazard: '#dc5a44', water: '#4a95c9', accent: '#f08a4b', post: '#5d5a66', scenery: ['pine', 'snowball', 'pine', 'pebble'], sc: ['#5f8f86', '#ffffff', '#9fb3c0'] },
    tidal: { name: 'Tidal Ruins', ground: ['#a6bba9', '#58705f'], top: '#c3d3a8', ice: ['#d6ecf3', '#7fa8bd'], far: '#dbe8e2',
      hazard: '#e8604f', water: '#3f8fbf', accent: '#f2b04a', post: '#5f5a4a', scenery: ['column', 'shell', 'weed', 'shell'], sc: ['#cfd6c4', '#f2c6b0', '#6f9f6a'] },
    clock: { name: 'Clockwork Works', ground: ['#c9a882', '#7a5a3a'], top: '#e3c79d', ice: ['#d6ecf3', '#7fa8bd'], far: '#ece0cc',
      hazard: '#dc5a44', water: '#5aa0c9', accent: '#e8b83a', post: '#4f4a44', scenery: ['gear', 'bolt', 'gear', 'bolt'], sc: ['#d8c2a0', '#8a7a66', '#e8b83a'] },
    sky: { name: 'Sky Islands', ground: ['#b3dcb0', '#5a9a72'], top: '#dcf2c8', ice: ['#e2f3fa', '#8fc0d6'], far: '#e2eef0',
      hazard: '#e8604f', water: '#66b3e0', accent: '#f26b8a', post: '#7a6a4a', scenery: ['cloud', 'flower', 'tuft', 'cloud'], sc: ['#7fbf7a', '#f4d35e', '#f29ab6'] },
    ember: { name: 'Ember Depths', ground: ['#a36659', '#553430'], top: '#bc7c6e', ice: ['#d3e2ea', '#7f9fb5'], far: '#eed8cb',
      hazard: '#ff7a3c', water: '#4a7fb0', accent: '#f6c453', post: '#3a2f2a', scenery: ['ember', 'stump', 'ember', 'pebble'], sc: ['#ff9a4a', '#6a4a40', '#b08a7a'] },
    finale: { name: 'The Big Dangle', ground: ['#94c98c', '#3f6f52'], top: '#bde3a3', ice: ['#d6ecf3', '#7fa8bd'], far: '#f1e3d3',
      hazard: '#e8604f', water: '#5aa9d6', accent: '#f26b8a', post: '#6d4a2f', scenery: ['bunting', 'flower', 'tuft', 'gear'], sc: ['#6fae5c', '#f4d35e', '#f26b8a'] },
  };
  Dangle.Themes = { get(id) { return T[id] || T.meadow; }, ids() { return Object.keys(T); } };
})();
