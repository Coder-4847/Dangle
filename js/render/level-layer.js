// Pre-rendered static level layer. Static geometry, spikes and scenery are painted once into
// world-space tiles (lazily, a few per frame, prefetching just outside the view) and kept in an LRU
// cache with a memory cap. A tile that isn't ready yet is drawn as vectors so nothing ever pops out.
// Also owns the per-level sprites for moving platforms and crates, and the far background layer.
window.Dangle = window.Dangle || {};

(function () {
  const C = () => Dangle.Crayon;
  const TILE = 384;             // world units per tile
  const MARGIN = 2;             // tiles overlap by this much so no hairline seams show
  const BUDGET = 6;             // tiles rendered per frame at most
  const MEM_CAP = 72e6;         // bytes of tile pixels kept

  function styleFor(kind, t) {
    switch (kind) {
      case 'ice': return { fill: t.ice[0], edge: t.ice[1], top: '#ffffff' };
      case 'noGrab': return { fill: '#4a4a58', edge: '#24242e', top: null };
      case 'helper': return { fill: '#f2c94c', edge: '#3a3a48', top: null };
      case 'trampoline': return { fill: t.accent, edge: C().shade(t.accent, -0.4), top: C().shade(t.accent, 0.35) };
      default: return { fill: t.ground[0], edge: t.ground[1], top: t.top };
    }
  }

  function build(W, themeId, dpr) {
    const theme = Dangle.Themes.get(themeId);
    const shapes = [];
    let seed = 101;
    let ext = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const grow = (bb) => { ext.x0 = Math.min(ext.x0, bb.x0); ext.y0 = Math.min(ext.y0, bb.y0); ext.x1 = Math.max(ext.x1, bb.x1); ext.y1 = Math.max(ext.y1, bb.y1); };
    for (const b of W.drawables) {
      if (!b.isStatic || b.dg.mover) continue;
      const pts = b.vertices.map((v) => ({ x: v.x, y: v.y }));
      // Wobbly path for the outline; the exact polygon for the fill, so touching blocks meet with
      // no gap (the outline's outer half is what shows, so the silhouette still wobbles).
      const path = C().toPath(C().wobble(pts, (seed++) * 7919, { amp: 1.7, radius: 5 }));
      const fillPath = new Path2D();
      pts.forEach((p, i) => (i ? fillPath.lineTo(p.x, p.y) : fillPath.moveTo(p.x, p.y)));
      fillPath.closePath();
      const bbox = { x0: b.bounds.min.x - 10, y0: b.bounds.min.y - 14, x1: b.bounds.max.x + 10, y1: b.bounds.max.y + 10 };
      shapes.push({ kind: b.dg.kind, path, fillPath, bbox, st: styleFor(b.dg.kind, theme), angle: b.angle, cx: b.position.x, cy: b.position.y, w: b.dg.size.w, h: b.dg.size.h });
      grow(bbox);
    }
    const spikes = [];
    if (W.level) {
      for (const h of W.level.hazards) {
        if (h.type !== 'spikes') continue;
        const n = Math.max(1, Math.round(h.w / 28));
        const tw = h.w / n;
        const path = new Path2D();
        for (let i = 0; i < n; i++) {
          path.moveTo(h.x + i * tw + 1, h.y + h.h);
          path.lineTo(h.x + (i + 0.5) * tw, h.y + ((i * 37) % 7) - 2);
          path.lineTo(h.x + (i + 1) * tw - 1, h.y + h.h);
        }
        const bbox = { x0: h.x - 6, y0: h.y - 8, x1: h.x + h.w + 6, y1: h.y + h.h + 6 };
        spikes.push({ path, bbox });
        grow(bbox);
      }
    }
    const spec = W.level && W.level.spec;
    const scenery = Dangle.Scenery.generate(W, theme, (spec ? spec.id.length * 131 : 7) + 17);
    for (const it of scenery) grow(it.bbox);
    const lights = scenery.filter((it) => it.kind === 'lantern').map((it) => ({ x: it.x + 10, y: it.y - 26, r: 150 }));

    const layer = {
      theme, themeId, shapes, spikes, scenery, lights, ext,
      res: Math.min(2, Math.max(1, dpr * 1.1)),
      tiles: new Map(), bytes: 0, rendered: 0,
      sprites: new Map(),
      far: buildFar(theme, ext, themeId),
    };
    return layer;
  }

  // Paint everything static that touches the rect. `grain` is off for the on-screen fallback.
  function paint(g, L, x0, y0, x1, y1, grain) {
    const t = L.theme;
    const hit = (bb) => bb.x1 > x0 && bb.x0 < x1 && bb.y1 > y0 && bb.y0 < y1;
    for (const it of L.scenery) if (it.back && hit(it.bbox)) Dangle.Scenery.draw(g, it, t);
    // Outlines first, fills on top: only the outer half of each edge survives, so blocks that
    // touch merge into one shape with no seams.
    g.lineJoin = 'round';
    for (const s of L.shapes) {
      if (!hit(s.bbox)) continue;
      g.strokeStyle = s.st.edge;
      g.lineWidth = 9;
      g.stroke(s.path);
    }
    for (const s of L.shapes) {
      if (!hit(s.bbox)) continue;
      g.fillStyle = s.st.fill;
      g.fill(s.fillPath);
    }
    for (const s of L.shapes) if (hit(s.bbox)) decorate(g, s, t);
    for (const it of L.scenery) if (!it.back && hit(it.bbox)) Dangle.Scenery.draw(g, it, t);
    for (const sp of L.spikes) {
      if (!hit(sp.bbox)) continue;
      g.fillStyle = t.hazard; g.fill(sp.path);
      g.strokeStyle = C().shade(t.hazard, -0.45); g.lineWidth = 3; g.stroke(sp.path);
    }
    if (grain) C().grain(g, x0, y0, x1 - x0, y1 - y0, 1);
    else {
      // On-screen fallback: same world-anchored grain, clipped to the shapes instead of 'source-atop'
      // (which would also texture whatever is already on the main canvas), so it matches the tile.
      const clip = new Path2D();
      for (const s of L.shapes) if (hit(s.bbox)) clip.addPath(s.path);
      for (const sp of L.spikes) if (hit(sp.bbox)) clip.addPath(sp.path);
      g.save();
      g.clip(clip);
      g.fillStyle = C().grainPattern(g);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.restore();
    }
  }

  // Surface band (grass, snow, shine), warning stripes, trampoline marks: clipped to the shape.
  function decorate(g, s, t) {
    if (!s.st.top && s.kind !== 'noGrab' && s.kind !== 'helper') return;
    g.save();
    g.clip(s.fillPath);
    g.translate(s.cx, s.cy);
    g.rotate(s.angle);
    const hw = s.w / 2, hh = s.h / 2;
    if (s.kind === 'noGrab' || s.kind === 'helper') {
      g.strokeStyle = s.kind === 'helper' ? '#3a3a48' : 'rgba(215,208,192,0.8)';
      g.lineWidth = s.kind === 'helper' ? 8 : 6;
      g.beginPath();
      for (let x = -hw - s.h; x < hw + s.h; x += 26) { g.moveTo(x, hh + 4); g.lineTo(x + s.h + 8, -hh - 4); }
      g.stroke();
    } else {
      const band = Math.min(13, s.h * 0.35);
      g.fillStyle = s.st.top;
      g.globalAlpha = s.kind === 'ice' ? 0.75 : 1;
      g.fillRect(-hw - 12, -hh - 12, s.w + 24, 12 + band);
      g.globalAlpha = 1;
      if (s.kind === 'ice') {
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4; g.lineCap = 'round';
        for (let x = -hw + 30; x < hw - 20; x += 90) { g.beginPath(); g.moveTo(x, hh - 10); g.lineTo(x + 18, -hh + band + 8); g.stroke(); }
      } else if (s.kind === 'trampoline') {
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
        g.beginPath();
        for (let x = -hw + 10; x < hw - 6; x += 16) { g.moveTo(x, hh - 8); g.lineTo(x + 8, -hh + band + 6); }
        g.stroke();
      }
    }
    g.restore();
  }

  function tileKey(i, j) { return i + ',' + j; }
  function hasContent(L, x0, y0, x1, y1) {
    const hit = (bb) => bb.x1 > x0 && bb.x0 < x1 && bb.y1 > y0 && bb.y0 < y1;
    return L.shapes.some((s) => hit(s.bbox)) || L.spikes.some((s) => hit(s.bbox)) || L.scenery.some((s) => hit(s.bbox));
  }

  function renderTile(L, i, j) {
    const x0 = i * TILE - MARGIN, y0 = j * TILE - MARGIN, size = TILE + 2 * MARGIN;
    const px = Math.ceil(size * L.res);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const g = canvas.getContext('2d');
    g.setTransform(L.res, 0, 0, L.res, -x0 * L.res, -y0 * L.res);
    paint(g, L, x0, y0, x0 + size, y0 + size, true);
    L.rendered++;
    return { canvas, x0, y0, size, bytes: px * px * 4 };
  }

  function evict(L) {
    for (const [k, tile] of L.tiles) {
      if (L.bytes <= MEM_CAP) break;
      if (!tile || tile.pinned) continue;
      L.bytes -= tile.bytes;
      tile.canvas.width = tile.canvas.height = 0;   // release pixels now, not at GC time
      L.tiles.delete(k);
    }
  }

  // Draw the tiles covering the view (world rect), rendering missing ones within budget.
  function draw(ctx, L, vx0, vy0, vx1, vy1, force) {
    let budget = force ? Infinity : BUDGET;
    const i0 = Math.floor(vx0 / TILE), i1 = Math.floor(vx1 / TILE);
    const j0 = Math.floor(vy0 / TILE), j1 = Math.floor(vy1 / TILE);
    for (let j = j0 - 1; j <= j1 + 1; j++) {
      for (let i = i0 - 1; i <= i1 + 1; i++) {
        const visible = i >= i0 && i <= i1 && j >= j0 && j <= j1;
        const k = tileKey(i, j);
        let tile = L.tiles.get(k);
        if (tile === undefined) {
          const x0 = i * TILE, y0 = j * TILE;
          if (!hasContent(L, x0, y0, x0 + TILE, y0 + TILE)) { L.tiles.set(k, null); continue; }
          if (budget > 0) { tile = renderTile(L, i, j); budget--; L.tiles.set(k, tile); L.bytes += tile.bytes; }
        } else if (tile) { L.tiles.delete(k); L.tiles.set(k, tile); }   // mark recently used
        if (!visible) continue;
        if (tile) ctx.drawImage(tile.canvas, tile.x0, tile.y0, tile.size, tile.size);
        else if (tile === undefined) {
          const x0 = i * TILE, y0 = j * TILE;
          ctx.save();
          ctx.beginPath(); ctx.rect(x0, y0, TILE, TILE); ctx.clip();
          paint(ctx, L, x0, y0, x0 + TILE, y0 + TILE, false);
          ctx.restore();
        }
      }
    }
    if (L.bytes > MEM_CAP) evict(L);
  }

  function dispose(L) {
    if (!L) return;
    for (const tile of L.tiles.values()) if (tile) tile.canvas.width = tile.canvas.height = 0;
    L.tiles.clear();
    for (const s of L.sprites.values()) s.canvas.width = s.canvas.height = 0;
    L.sprites.clear();
    L.bytes = 0;
  }

  // Sprite for a moving platform or crate (built once per body per theme, drawn at its pose).
  function spriteFor(L, body) {
    let s = L.sprites.get(body.id);
    if (s) return s;
    const w = body.dg.size.w, h = body.dg.size.h, pad = 10;
    const t = L.theme;
    const crate = body.dg.kind === 'crate';
    const st = crate ? { fill: '#d9a15c', edge: '#8a5a2b', top: null } : styleFor(body.dg.kind, t);
    s = C().sprite(w + 2 * pad, h + 2 * pad, L.res, (g) => {
      g.translate(pad, pad);
      const path = C().toPath(C().wobble(C().rectPts(0, 0, w, h), body.id * 97 + 5, { amp: 1.4, radius: crate ? 5 : 8 }));
      g.strokeStyle = st.edge; g.lineWidth = 8; g.lineJoin = 'round'; g.stroke(path);
      g.fillStyle = st.fill; g.fill(path);
      g.save(); g.clip(path);
      if (crate) {
        g.strokeStyle = st.edge; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.moveTo(w - 8, 8); g.lineTo(8, h - 8); g.stroke();
        g.strokeRect(6, 6, w - 12, h - 12);
      } else if (st.top) { g.fillStyle = st.top; g.fillRect(-4, -8, w + 8, 8 + Math.min(12, h * 0.35)); }
      g.restore();
      C().grain(g, -pad, -pad, w + 2 * pad, h + 2 * pad, 1);
    });
    s.pad = pad;
    L.sprites.set(body.id, s);
    return s;
  }

  // Far layer: a few pale shapes per theme (hills, peaks or clouds) in "far space", drawn with parallax.
  const FAR_BASE = 180;          // far-space y of the hills' baseline (just below ground level in view)
  function buildFar(t, ext, themeId) {
    const kind = { frozen: 'peaks', ember: 'peaks', clock: 'peaks', sky: 'clouds', salt: 'dunes' }[themeId] || 'hills';
    const rnd = C().rng(themeId.length * 977 + 3);
    const shapes = [];
    const x0 = (isFinite(ext.x0) ? ext.x0 : -2000) * 0.35 - 1600;
    const x1 = (isFinite(ext.x1) ? ext.x1 : 4000) * 0.35 + 1600;
    for (let x = x0; x < x1; x += 260 + rnd() * 380) {
      const p = new Path2D();
      if (kind === 'peaks') {
        const w = 260 + rnd() * 260, h = 200 + rnd() * 260;
        p.moveTo(x - w, FAR_BASE); p.lineTo(x - w * 0.15, FAR_BASE - h); p.lineTo(x + w * 0.1, FAR_BASE - h * 0.92); p.lineTo(x + w, FAR_BASE); p.closePath();
      } else if (kind === 'clouds') {
        const y = FAR_BASE - 520 + rnd() * 300, r = 40 + rnd() * 50;
        for (let k = 0; k < 4; k++) p.arc(x + k * r * 0.8, y + (k % 2 ? -r * 0.35 : 0), r * (k % 2 ? 1 : 0.8), 0, Math.PI * 2);
      } else {
        const w = 300 + rnd() * 380, h = (kind === 'dunes' ? 70 : 130) + rnd() * 140;
        p.moveTo(x - w, FAR_BASE); p.quadraticCurveTo(x, FAR_BASE - h * 2, x + w, FAR_BASE); p.closePath();
      }
      shapes.push(p);
    }
    return { shapes, color: t.far, ground: kind !== 'clouds' };
  }

  // Parallax: far space scrolls at 35% of the camera and zooms less.
  function drawFar(ctx, L, cam, viewW, viewH, dpr) {
    const k = 0.35, zs = 0.55 + 0.45 * cam.scale;
    ctx.setTransform(zs * dpr, 0, 0, zs * dpr, (viewW / 2 - cam.x * k * zs) * dpr, (viewH / 2 - cam.y * k * zs + 120 * zs) * dpr);
    ctx.fillStyle = L.far.color;
    for (const p of L.far.shapes) ctx.fill(p);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = L.far.color;
    const horizon = viewH / 2 - (cam.y * k - FAR_BASE) * zs + 120 * zs;
    if (L.far.ground && horizon < viewH) ctx.fillRect(0, Math.max(0, horizon), viewW, viewH - Math.max(0, horizon));
  }

  // Far layer only (menus): cached per theme.
  const farCache = {};
  function farOnly(themeId) {
    if (!farCache[themeId]) {
      const theme = Dangle.Themes.get(themeId);
      farCache[themeId] = { theme, far: buildFar(theme, { x0: -6000, x1: 6000, y0: 0, y1: 0 }, themeId) };
    }
    return farCache[themeId];
  }

  Dangle.LevelLayer = { build, draw, dispose, spriteFor, drawFar, farOnly, TILE };
})();
