// The crayon look, done cheaply: seeded wobble on outlines, one pre-rendered grain texture applied with
// 'source-atop' (so it only lands on what is already drawn), and a doubled, soft outline stroke.
// Everything here is built once (level load or first use), never per frame.
window.Dangle = window.Dangle || {};

(function () {
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour.
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // A closed polygon (array of {x,y}) turned into a hand-drawn outline: rounded corners, edges
  // resampled every `step` px and pushed in/out along the normal by a smooth seeded wobble.
  // Returns a flat array [x0, y0, x1, y1, ...].
  function wobble(pts, seed, opts) {
    opts = opts || {};
    const amp = opts.amp === undefined ? 1.6 : opts.amp;
    const step = opts.step || 20;
    const radius = opts.radius === undefined ? 7 : opts.radius;
    const rnd = rng(seed);
    const n = pts.length;
    const base = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[(i + n - 1) % n];
      const b = pts[(i + 1) % n];
      const la = Math.hypot(a.x - p.x, a.y - p.y);
      const lb = Math.hypot(b.x - p.x, b.y - p.y);
      const r = Math.min(radius, la / 2.5, lb / 2.5);
      const ax = p.x + (a.x - p.x) / la * r, ay = p.y + (a.y - p.y) / la * r;
      const bx = p.x + (b.x - p.x) / lb * r, by = p.y + (b.y - p.y) / lb * r;
      // Rounded corner: a few points on the quadratic from a via p to b.
      for (let k = 0; k <= 3; k++) {
        const t = k / 3;
        base.push((1 - t) * (1 - t) * ax + 2 * (1 - t) * t * p.x + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * p.y + t * t * by);
      }
      // Straight run to the next corner, resampled.
      const q = pts[(i + 1) % n];
      const c = pts[(i + 2) % n];
      const lq = Math.hypot(c.x - q.x, c.y - q.y);
      const rq = Math.min(radius, lb / 2.5, lq / 2.5);
      const ex = q.x + (p.x - q.x) / lb * rq, ey = q.y + (p.y - q.y) / lb * rq;
      const len = Math.hypot(ex - bx, ey - by);
      const m = Math.max(1, Math.round(len / step));
      for (let k = 1; k < m; k++) base.push(bx + (ex - bx) * k / m, by + (ey - by) * k / m);
    }
    // Smooth wobble along the perimeter (two sines with random phase + a little per-point jitter).
    const cnt = base.length / 2;
    const out = new Array(base.length);
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28;
    let s = 0;
    // Orientation (so "outward" is consistent whichever way the polygon winds).
    let area = 0;
    for (let i = 0; i < cnt; i++) { const j = (i + 1) % cnt; area += base[2 * i] * base[2 * j + 1] - base[2 * j] * base[2 * i + 1]; }
    const sign = area > 0 ? 1 : -1;
    for (let i = 0; i < cnt; i++) {
      const pi = (i + cnt - 1) % cnt, ni = (i + 1) % cnt;
      const tx = base[2 * ni] - base[2 * pi], ty = base[2 * ni + 1] - base[2 * pi + 1];
      const tl = Math.hypot(tx, ty) || 1;
      if (i > 0) s += Math.hypot(base[2 * i] - base[2 * i - 2], base[2 * i + 1] - base[2 * i - 1]);
      const off = amp * (0.6 * Math.sin(s / 14 + p1) + 0.4 * Math.sin(s / 5.9 + p2)) + (rnd() - 0.5) * amp * 0.5;
      out[2 * i] = base[2 * i] + (ty / tl) * off * sign;
      out[2 * i + 1] = base[2 * i + 1] - (tx / tl) * off * sign;
    }
    return out;
  }

  function toPath(flat) {
    const path = new Path2D();
    path.moveTo(flat[0], flat[1]);
    for (let i = 2; i < flat.length; i += 2) path.lineTo(flat[i], flat[i + 1]);
    path.closePath();
    return path;
  }

  function rectPts(x, y, w, h) { return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]; }
  function circlePts(cx, cy, r, n) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
    return pts;
  }
  // A wobbly circle path (no corners to round).
  function blobPath(cx, cy, r, seed, amp) {
    return toPath(wobble(circlePts(cx, cy, r, Math.max(12, Math.round(r * 0.8))), seed, { amp: amp === undefined ? 1 : amp, radius: 0, step: 6 }));
  }

  // Grain: speckles plus short diagonal crayon streaks, 256 px square, tiles seamlessly.
  let grainCanvas = null;
  function grainImage() {
    if (grainCanvas) return grainCanvas;
    const S = 256;
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = S;
    const g = grainCanvas.getContext('2d');
    const img = g.createImageData(S, S);
    const rnd = rng(7331);
    for (let i = 0; i < S * S; i++) {
      const v = rnd();
      const o = i * 4;
      if (v < 0.07) { img.data[o] = img.data[o + 1] = img.data[o + 2] = 40; img.data[o + 3] = 36; }
      else if (v > 0.93) { img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = 52; }
    }
    g.putImageData(img, 0, 0);
    g.lineCap = 'round';
    for (let i = 0; i < 220; i++) {
      const x = rnd() * S, y = rnd() * S, l = 4 + rnd() * 9;
      g.strokeStyle = rnd() < 0.55 ? 'rgba(255,255,255,0.16)' : 'rgba(40,30,20,0.09)';
      g.lineWidth = 1 + rnd() * 1.2;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {   // wrap so the tile has no seams
        g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + l * 0.8, y + dy - l * 0.6); g.stroke();
      }
    }
    return grainCanvas;
  }
  const patterns = new WeakMap();
  function grainPattern(ctx) {
    let p = patterns.get(ctx);
    if (!p) { p = ctx.createPattern(grainImage(), 'repeat'); patterns.set(ctx, p); }
    return p;
  }
  // Texture everything already drawn in this rect (world-anchored, since it follows the transform).
  function grain(ctx, x, y, w, h, strength) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = strength === undefined ? 1 : strength;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Soft crayon outline: a wide faint pass under a narrower solid one.
  function outline(ctx, path, color, width) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = width * 1.6;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }

  // Offscreen canvas in local units (w x h), rendered at `res` device pixels per unit.
  function sprite(w, h, res, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * res));
    c.height = Math.max(1, Math.ceil(h * res));
    const g = c.getContext('2d');
    g.scale(res, res);
    draw(g);
    return { canvas: c, w, h };
  }

  Dangle.Crayon = { rng, shade, wobble, toPath, rectPts, circlePts, blobPath, grain, grainPattern, outline, sprite };
})();
