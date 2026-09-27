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
      const platW = 1.8 * r;
      const { period, dwell } = platformTiming(w - platW, o.period);
      b.mover(x0, y, platW, THIN, w - platW, 0, period, 0, 'ground', dwell);
      g.platW = platW;
      g.period = period;
    }
    if (o.floor === 'spikes') b.hazard('spikes', x0, y + 260, w, 60);
    else if (o.floor) b.hazard(o.floor, x0, y + 260, w, 200);

    b.spec.gaps.push(g);
    const land = (o.land || 1.6) * r;
    b.block(x1, y, land, b.D);
    b.x = x1 + land;
    b.floor(y);
    b.markSafe(b.x - Math.min(0.7, land / r - 0.4) * r);      // the flag sits on the landing even when it is short
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
    b.crate(b.x + 1.4 * r - 34, b.y - 32, 64, 14);      // heavy: a climbing hand must not drag it off the wall
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
    if (o.nograb) b.block(b.x + zone - 24, b.y - h + 0.35 * r, 24, h - 0.35 * r, 'noGrab');   // hands slide off the face: only the wind lifts you
    b.rise(h / r, 'wind');
    b.x += zone + 2 * r; b.y -= h;
    b.floor(b.y);
    b.markSafe();
  });

  // Time a player needs to cross a tide stretch: crawl `len` px, then (if h > 0 REACH) climb a wall of that height.
  // One formula for the segment (default flood speed) and the linter.
  function tideCross(len, h) {
    const L = cfg().LINT;
    return len / L.TIDE_SPEED + (h > 0 ? L.TIDE_CLIMB_BASE + L.TIDE_CLIMB_PER_R * h : 0);
  }
  Dangle.tideCross = tideCross;

  // Timing of a platform gliding `travel` px between two resting ends: it rests REST_S at each end (time to step on and
  // off) and glides gently enough not to shake its rider off (peak acceleration <= 0.7 x what the head's floor grip
  // holds). Returns {period, dwell}: dwell is the mover's share of the cycle spent resting at each end (surfaces.js).
  const REST_S = 1.8;
  function platformTiming(travel, wantPeriod) {
    const a = 0.7 * cfg().HEAD_GRIP * cfg().GRAVITY;
    const glide = Math.PI * Math.sqrt(travel / 2 / a);            // seconds to travel one way
    const period = Math.max(wantPeriod || 0, Math.ceil(2 * glide + 2 * REST_S));
    return { period, dwell: Math.min(0.4, REST_S / period) };
  }

  // Ground stretch with a tide that starts rising when the first player enters and stops at head height (or,
  // with h > 0, a wall of h REACH ends the stretch: climb it before the water reaches you; the water stops at its
  // top). kind: water | lava. Speed defaults to a planning figure (1.35x the time to cross it).
  Segments.add('tide', 'right', (b, o) => {
    const r = R();
    const len = (o.len || 4) * r;
    const h = o.h || 0;
    const startY = b.y + 150;
    const cross = tideCross(len, h);
    const speed = o.speed || (startY - (b.y - HR())) / (1.35 * cross);
    const x0 = b.x;
    b.block(x0, b.y, len, b.D);
    b.riser({ x0, x1: x0 + len, trigger0: x0, trigger1: x0 + len, type: o.kind || 'water', startY, endY: b.y - (h > 0 ? h * r : 2.4 * r), speed });
    b.spec.tides.push({ x0, len, floorY: b.y, startY, speed, climb: h });
    b.x += len;
    if (h > 0) {
      const wall = 1.6 * r;
      b.block(b.x, b.y - h * r, wall, b.D + h * r);
      b.rise(h, 'wall');
      b.y -= h * r; b.x += wall;
      b.floor(b.y);
    }
    const land = 1.6 * r;
    b.block(b.x, b.y, land, b.D);
    b.x += land;
    b.markSafe();
  });

  // A lift: a platform that glides up a shaft beside a wall too tall to climb. Step on when it is down, step off at the
  // top. Falling into the shaft is the pit. period: seconds for a full down-up-down cycle.
  Segments.add('lift', 'right', (b, o) => {
    const r = R();
    const h = (o.h || 4) * r;
    const platW = 1.3 * r;
    const { period, dwell } = platformTiming(h, o.period);
    b.block(b.x, b.y, 0.5 * r, b.D);                        // standing room (and clearance from a beam overhanging the ledge before)
    b.x += 0.5 * r;
    b.mover(b.x, b.y, platW, THIN, 0, -h, period, 0, 'ground', dwell);
    b.hazard('pit', b.x, b.y + 260, platW, 60);
    b.spec.lifts = (b.spec.lifts || []).concat({ x: b.x, y: b.y, w: platW, h: h / r, period });
    const wx = b.x + platW;
    b.block(wx, b.y - h, 1.6 * r, b.D + h);
    b.rise(h / r, 'lift');
    b.x = wx + 1.6 * r; b.y -= h;
    b.floor(b.y);
    b.markSafe();
  });

  // Drop off the ledge onto a springboard at the foot of a wall: it throws you up the wall face; grab the lip.
  // drop: how far the pad is below the ledge; h: how high the wall rises above the pad (net rise h - drop).
  Segments.add('bounce', 'right', (b, o) => {
    const r = R();
    const drop = (o.drop || 1) * r;
    const h = (o.h || 2.2) * r;
    const padW = r;
    const padY = b.y + drop;
    b.trampoline(b.x, padY, padW, 40);
    b.block(b.x, padY + 40, padW, b.D - 40 + drop);
    const wx = b.x + padW;
    b.block(wx, padY - h, 2 * r, b.D + h + drop);
    b.rise(h / r, 'trampoline');
    b.spec.bounces = (b.spec.bounces || []).concat({ x: b.x, y: padY, drop: drop / r, h: h / r });
    b.x = wx + 2 * r; b.y = padY - h;
    b.floor(b.y);
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
