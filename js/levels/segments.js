// Segment library: reusable, parameterised chunks a level is assembled from.
// All distances are in REACH units (options) and converted with config.REACH, so retuning the
// arms never silently breaks solvability. A segment moves the builder's cursor (b.x, b.y) and
// records what the linter needs to know (gaps, rises, tides, beams).
// Horizontal levels: b.x advances, b.y is the current floor. Vertical ("up") levels: b.y rises.
window.Dangle = window.Dangle || {};

(function () {
  const cfg = () => Dangle.config;
  const R = () => cfg().REACH;
  const HR = () => cfg().HEAD_RADIUS;
  const THIN = 32;                                   // platform thickness (>= lint MIN_THICK)

  const list = {};
  const Segments = {
    add(name, dir, fn) { list[name] = { dir, fn }; },
    get(name) { return list[name]; },
    names() { return Object.keys(list); },
  };
  Dangle.Segments = Segments;

  // ---------------------------------------------------------------- horizontal levels

  // Spawn area: ground, a back wall, two spawn points.
  Segments.add('start', 'right', (b, o) => {
    const r = R();
    const len = (o.len || 3.2) * r;
    b.block(-1.4 * r, 0, 1.4 * r + len, b.D);
    b.block(-1.4 * r - 60, -1400, 60, 1400 + b.D);
    b.spec.spawns = [{ x: 0.6 * r, y: -HR() - 3 }, { x: 1.3 * r, y: -HR() - 3 }];
    b.x = len; b.y = 0;
    b.floor(0);
    b.markSafe();
  });

  Segments.add('ledge', 'right', (b, o) => {
    const len = (o.len || 2) * R();
    b.block(b.x, b.y, len, b.D);
    b.x += len;
    b.markSafe();
  });

  // A pit with an optional aid, then landing ground.
  // aid: 'none' (reach across) | 'rope' (one pendulum) | 'ropes' (a row) | 'beam' (helper beam overhead)
  //      | 'mover' (sliding bridge)
  //      | 'chain' (co-op only: too wide for one player)
  // floor: 'spikes' | 'lava' | 'water' fills the pit bottom with a hazard.
  Segments.add('gap', 'right', (b, o) => {
    const r = R();
    const aid = o.aid || 'none';
    const x0 = b.x;
    const y = b.y;
    let w = (o.w || 1) * r;
    const g = { x0, y, aid, coopOnly: aid === 'chain' };

    if (aid === 'ropes') {
      const n = o.n || 3;
      const sp = (o.spacing || 1.2) * r;
      const edge = 0.7 * r;
      w = 2 * edge + (n - 1) * sp;
      g.ropes = [];
      for (let i = 0; i < n; i++) g.ropes.push(x0 + edge + i * sp);
    } else if (aid === 'rope') {
      g.ropes = [x0 + Math.min(0.7 * r, 0.4 * w)];
    }
    const x1 = x0 + w;
    g.x1 = x1;
    g.span = w;

    if (g.ropes) {
      // Ropes hang 2.5 REACH from a high pivot; the tail ends just below floor level (the
      // Phase 1 sandbox rope: pivot 310 px above the floor for a 325 px rope).
      const seg = 0.25 * r;
      for (const rx of g.ropes) b.rope(rx, y - (10 * seg - 20), 10, seg, 1.2);
    }
    if (aid === 'beam') {
      // A striped helper beam over the pit, just within reach of a standing player: hang and go hand over hand.
      // It runs on past the far edge so a hanging player (about 50 px behind the hand) lands on ground.
      b.block(x0 - 0.3 * r, y - r - 24, w + 1.2 * r, 24, 'helper');
      b.spec.beams.push({ x0: x0 - 0.3 * r, x1: x1 + 0.9 * r, y: y - r });
    }
    if (aid === 'mover') {
      const platW = 1.3 * r;
      b.mover(x0, y, platW, THIN, w - platW, 0, o.period || 7, 0);
      g.platW = platW;
      g.period = o.period || 7;
    }
    if (o.floor === 'spikes') b.hazard('spikes', x0, y + 260, w, 60);
    else if (o.floor) b.hazard(o.floor, x0, y + 260, w, 200);

    b.spec.gaps.push(g);
    const land = (o.land || 1.6) * r;
    b.block(x1, y, land, b.D);
    b.x = x1 + land;
    b.floor(y);
    b.markSafe();
  });

  // Step up (h > 0) or down (h < 0) by h REACH; a tall step is a wall to climb hand over hand.
  function step(b, o) {
    const r = R();
    const h = (o.h === undefined ? 1 : o.h) * r;
    const len = (o.len || 2) * r;
    if (h >= 0) b.block(b.x, b.y - h, len, b.D + h);
    else b.block(b.x, b.y - h, len, b.D);
    if (h > 0) b.rise(h / r, 'wall');
    b.y -= h;
    b.x += len;
    b.floor(b.y);
    b.markSafe();
  }
  Segments.add('step', 'right', step);
  Segments.add('wall', 'right', (b, o) => step(b, { h: o.h || 3, len: o.len || 1.8 }));

  // A crate against a wall you can climb either way (crates matter more once two players push).
  Segments.add('crateStep', 'right', (b, o) => {
    const r = R();
    const h = (o.h || 1.5) * r;
    b.block(b.x, b.y, 1.4 * r, b.D);
    b.block(b.x + 1.4 * r, b.y - h, 2 * r, b.D + h);
    b.crate(b.x + 1.4 * r - 36, b.y - 32, 64, 7);
    b.rise(h / r, 'wall');
    b.x += 3.4 * r; b.y -= h;
    b.floor(b.y);
    b.markSafe();
  });

  // A slick ramp up, then a slick shelf. Grabbable, but heads don't grip it.
  Segments.add('iceSlope', 'right', (b, o) => {
    const r = R();
    const len = (o.len || 3) * r;
    const rise = (o.rise || 0.8) * r;
    const T = 48;
    const a = Math.atan2(-rise, len);
    const L = Math.hypot(len, rise);
    const cx = b.x + len / 2 - Math.sin(a) * T / 2;
    const cy = b.y - rise / 2 + Math.cos(a) * T / 2;
    b.block(cx - L / 2, cy - T / 2, L, T, 'ice', a);
    b.rise(rise / r, 'slope');
    b.x += len; b.y -= rise;
    const shelf = (o.shelf || 1.6) * r;
    b.block(b.x, b.y, shelf, b.D, 'ice');
    b.x += shelf;
    b.floor(b.y);
    b.markSafe();
  });

  // Spikes cover the ground; an overhead beam (just within reach) is the way across.
  Segments.add('beamRun', 'right', (b, o) => {
    const r = R();
    const len = (o.len || 3) * r;
    const x0 = b.x;
    b.block(x0, b.y, len, b.D);
    b.hazard('spikes', x0, b.y - 40, len, 40);
    // The beam runs on over the landing so a hanging player (about 50 px behind the hand) clears the spikes.
    b.block(x0 - 0.3 * r, b.y - r - 24, len + 1.2 * r, 24, 'helper');
    b.spec.beams.push({ x0: x0 - 0.3 * r, x1: x0 + len + 0.9 * r, y: b.y - r });
    b.x += len;
    const land = 1.6 * r;
    b.block(b.x, b.y, land, b.D);
    b.x += land;
    b.markSafe();
  });

  // A wall whose face is no-grab (hands slide off); stubs sticking out of it are the route.
  Segments.add('noGrabClimb', 'right', (b, o) => {
    const r = R();
    const h = (o.h || 2.6) * r;
    const wx = b.x + 1.2 * r;
    b.block(b.x, b.y, 1.2 * r, b.D);
    b.block(wx, b.y - h, 2 * r, b.D + h);                             // the wall (grabbable on top)
    b.block(wx - 24, b.y - h + 0.5 * r, 24, h - 0.5 * r, 'noGrab');   // slippery face panel
    const spacing = 0.95 * r;
    for (let y = b.y - spacing; y > b.y - h + 0.3 * r; y -= spacing) b.block(wx - 24 - 0.7 * r, y, 0.7 * r, 24, 'ground');
    b.rise(h / r, 'wall');
    b.x = wx + 2 * r; b.y -= h;
    b.floor(b.y);
    b.markSafe();
  });

  // Springboard beside a wall taller than you can climb quickly: bounce, grab, pull.
  Segments.add('trampolineStep', 'right', (b, o) => {
    const r = R();
    const h = (o.h || 2.4) * r;
    const padW = 1.1 * r;
    b.block(b.x, b.y, 0.5 * r, b.D);
    b.trampoline(b.x + 0.5 * r, b.y, padW, 40);
    b.block(b.x + 0.5 * r, b.y + 40, padW, b.D - 40);
    const wx = b.x + 0.5 * r + padW + 0.5 * r;
    b.block(b.x + 0.5 * r + padW, b.y, 0.5 * r, b.D);
    b.block(wx, b.y - h, 2 * r, b.D + h);
    b.rise(h / r, 'trampoline');
    b.x = wx + 2 * r; b.y -= h;
    b.floor(b.y);
    b.markSafe();
  });

  // A tall wall with an updraft in front of it: float up beside the wall instead of climbing it.
  Segments.add('windRise', 'right', (b, o) => {
    const r = R();
    const h = (o.h || 3.5) * r;
    const zone = 1.6 * r;
    b.block(b.x, b.y, zone, b.D);
    b.wind(b.x, b.y - h - 0.5 * r, zone, h + 0.5 * r, 0, -(o.lift || cfg().WIND_LIFT) * cfg().GRAVITY);
    b.block(b.x + zone, b.y - h, 2 * r, b.D + h);
    b.rise(h / r, 'wind');
    b.x += zone + 2 * r; b.y -= h;
    b.floor(b.y);
    b.markSafe();
  });

  // Ground stretch with a tide that starts rising when the first player enters and stops
  // at head height; speed defaults to a planning figure (1.35x the time to cross it).
  Segments.add('tide', 'right', (b, o) => {
    const r = R();
    const len = (o.len || 4) * r;
    const startY = b.y + 150;
    const cross = len / cfg().LINT.TIDE_SPEED;
    const speed = o.speed || (startY - (b.y - HR())) / (1.35 * cross);
    const x0 = b.x;
    b.block(x0, b.y, len, b.D);
    b.riser({ x0, x1: x0 + len, trigger0: x0, trigger1: x0 + len, type: o.kind || 'water', startY, endY: b.y - 2.4 * r, speed });
    b.spec.tides.push({ x0, len, floorY: b.y, startY, speed });
    b.x += len;
    const land = 1.6 * r;
    b.block(b.x, b.y, land, b.D);
    b.x += land;
    b.markSafe();
  });

  // Final ledge with the goal zone (checkered flag) and an end wall.
  Segments.add('goal', 'right', (b, o) => {
    const r = R();
    const len = (o.len || 3) * r;
    b.block(b.x, b.y, len, b.D);
    b.block(b.x + len, b.y - 1400, 60, 1400 + b.D);
    b.spec.goal = { x: b.x + 0.9 * r, y: b.y - 2 * r, w: 1.6 * r, h: 2 * r };
    b.x += len;
  });

  // ---------------------------------------------------------------- vertical levels

  Segments.add('startUp', 'up', (b, o) => {
    const r = R();
    const S = (o.width || 4) * r;
    b.shaft = S / 2;
    b.block(-S / 2, 0, S, b.D);
    b.spec.spawns = [{ x: -0.6 * r, y: -HR() - 3 }, { x: 0.6 * r, y: -HR() - 3 }];
    b.x = 0; b.y = 0;
    b.floor(0);
    b.markSafe(0);
  });

  // Alternating ledges, each dy above the last, on alternate shaft walls. The ledge tips are
  // a short reach apart sideways (never overlapping: an overhang can't be mantled from below);
  // you stand at one tip, grab the next tip's corner diagonally above, and heave over it.
  Segments.add('zigzag', 'up', (b, o) => {
    const r = R();
    const dy = (o.dy || 1) * r;
    const w = (o.ledge || 1.8) * r;
    let last = 0;
    for (let i = 0; i < (o.n || 4); i++) {
      b.y -= dy;
      const x = b.side > 0 ? b.shaft - w : -b.shaft;
      b.block(x, b.y, w, THIN, 'ground');
      b.rise(dy / r, 'ledge', (2 * b.shaft - 2 * w) / r);
      last = x + w / 2;
      b.side = -b.side;
    }
    b.markSafe(last);
  });

  // A column of rising air, then a ledge at the top.
  Segments.add('windShaft', 'up', (b, o) => {
    const r = R();
    const h = (o.h || 3) * r;
    const w = 1.8 * r;
    b.wind(-b.shaft, b.y - h - 0.4 * r, 2 * b.shaft, h + 0.4 * r, 0, -(o.lift || cfg().WIND_LIFT) * cfg().GRAVITY);
    b.y -= h;
    const x = b.side > 0 ? b.shaft - w : -b.shaft;
    b.block(x, b.y, w, THIN, 'ground');
    b.rise(h / r, 'wind');
    b.side = -b.side;
    b.markSafe(x + w / 2);
  });

  // The goal sits on one more zigzag-style ledge (same tip rules as the ledges below it).
  Segments.add('goalUp', 'up', (b, o) => {
    const r = R();
    const w = 1.8 * r;
    b.y -= r;
    const x = b.side > 0 ? b.shaft - w : -b.shaft;
    b.block(x, b.y, w, THIN, 'ground');
    b.rise(1, 'ledge', (2 * b.shaft - 2 * w) / r);
    b.spec.goal = { x: x + 0.1 * r, y: b.y - 2 * r, w: 1.6 * r, h: 2 * r };
  });
})();
