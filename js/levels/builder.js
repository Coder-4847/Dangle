// Level builder: segments (segments.js) call these helpers to add geometry to a plain-data spec.
// No Matter, no DOM: specs are pure JSON so tools/lint-levels.js can inspect them under node.
// Everything is deterministic: same definition in, same spec out (seeded PRNG only).
window.Dangle = window.Dangle || {};

(function () {
  const cfg = () => Dangle.config;

  function rngFrom(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Corner points of a block spec (handles the optional rotation about its centre).
  function blockPoly(bl) {
    const cx = bl.x + bl.w / 2;
    const cy = bl.y + bl.h / 2;
    const pts = [[-bl.w / 2, -bl.h / 2], [bl.w / 2, -bl.h / 2], [bl.w / 2, bl.h / 2], [-bl.w / 2, bl.h / 2]];
    const a = bl.angle || 0;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return pts.map(([px, py]) => ({ x: cx + px * cos - py * sin, y: cy + px * sin + py * cos }));
  }

  function create(def) {
    const c = cfg();
    const R = c.REACH;
    const spec = {
      id: def.id, name: def.name, theme: def.theme, direction: def.direction || 'right',
      coop: !!def.coop, difficulty: def.difficulty || 1,
      blocks: [], movers: [], ropes: [], crates: [], hazards: [], trampolines: [], winds: [], risers: [],
      checkpoints: [], gaps: [], rises: [], tides: [], beams: [], segments: [],
      spawns: [], goal: null, bounds: null, killY: 0, length: 0,
    };
    const ext = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    const b = {
      def, spec, R, D: 160,            // D = how deep ground slabs are
      dir: spec.direction, coop: spec.coop,
      x: 0, y: 0,                      // cursor: where the next segment starts (floor level)
      safe: false, cpAt: null, lastCp: 0,
      shaft: 0, side: 1,               // vertical levels: half width of the shaft, next ledge side
      maxFloorY: 0,
      rnd: rngFrom(def.seed || 1),

      grow(x, y) {
        if (x < ext.minX) ext.minX = x;
        if (x > ext.maxX) ext.maxX = x;
        if (y < ext.minY) ext.minY = y;
        if (y > ext.maxY) ext.maxY = y;
      },
      progress() { return b.dir === 'up' ? -b.y : b.x; },
      floor(y) { if (y > b.maxFloorY) b.maxFloorY = y; },

      block(x, y, w, h, kind, angle) {
        const bl = { x, y, w, h, kind: kind || 'ground' };
        if (angle) bl.angle = angle;
        spec.blocks.push(bl);
        for (const p of blockPoly(bl)) b.grow(p.x, p.y);
        return bl;
      },
      mover(x, y, w, h, dx, dy, period, phase, kind) {
        spec.movers.push({ x, y, w, h, dx, dy, period, phase: phase || 0, kind: kind || 'ground' });
        b.grow(x, y); b.grow(x + w + dx, y + h + dy);
      },
      rope(x, y, n, spacing, mass) {
        spec.ropes.push({ x, y, n, spacing, mass: mass || 1.2 });
        b.grow(x - 20, y); b.grow(x + 20, y + n * spacing);
      },
      crate(x, y, size, mass) { spec.crates.push({ x, y, size, mass }); b.grow(x - size, y - size); },
      hazard(type, x, y, w, h) { spec.hazards.push({ type, x, y, w, h }); b.grow(x, y); b.grow(x + w, y + h); },
      trampoline(x, y, w, h) { spec.trampolines.push({ x, y, w, h }); b.grow(x, y); b.grow(x + w, y + h); },
      wind(x, y, w, h, ax, ay) { spec.winds.push({ x, y, w, h, ax, ay }); },
      riser(r) { spec.risers.push(r); b.grow(r.x0, r.endY); b.grow(r.x1, r.startY); },

      // Records for the linter: what the player must be able to do here.
      gap(g) { spec.gaps.push(g); },
      // h in REACH units; gapX (ledge stacks): sideways distance between the tips, in REACH units.
      rise(h, kind, gapX) { spec.rises.push({ x: b.x, y: b.y, h, kind, gapX }); },

      // Mark the cursor as safe ground for a checkpoint; x optionally says where the flag goes.
      markSafe(x) { b.safe = true; b.cpAt = { x: x === undefined ? b.x - 0.7 * R : x, y: b.y }; },

      checkpoint(x, y) {
        const hr = c.HEAD_RADIUS + 4;
        spec.checkpoints.push({
          x, y, w: 0.7 * R, h: 1.8 * R,
          spawns: [{ x: x - 0.25 * R, y: y - hr }, { x: x + 0.25 * R, y: y - hr }],
        });
        b.lastCp = b.progress();
      },
    };
    b.ext = ext;
    return b;
  }

  // Wrap up after the last segment: side walls for shafts, bounds, kill plane, length.
  function finish(b) {
    const s = b.spec;
    const c = cfg();
    if (b.dir === 'up') {
      const top = b.ext.minY - 800;
      const bottom = b.maxFloorY + b.D;
      b.block(-b.shaft - 60, top, 60, bottom - top, 'ground');
      b.block(b.shaft, top, 60, bottom - top, 'ground');
    }
    const e = b.ext;
    s.bounds = { minX: e.minX - 80, maxX: e.maxX + 80, minY: e.minY - 200, maxY: e.maxY + 200 };
    s.killY = b.maxFloorY + c.KILL_DEPTH;
    s.length = b.dir === 'up' ? (b.maxFloorY - e.minY) : (e.maxX - e.minX);
    return s;
  }

  Dangle.Builder = { create, finish, blockPoly };
})();
