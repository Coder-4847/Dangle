// Chunky hand-lettered text with a crayon treatment, using a bundled-with-the-OS font stack (no font
// requests): thick dark-tinted outline, flat fill, grain, and a per-letter wobble that is seeded, so
// it never shimmers. Static strings are rendered once into cached sprites; per-frame numbers use plain().
window.Dangle = window.Dangle || {};

(function () {
  const FAMILY = '"Trebuchet MS", "Segoe UI", "Helvetica Neue", system-ui, sans-serif';
  const cache = new Map();
  const CAP = 300;
  let res = 2;
  const measureCtx = document.createElement('canvas').getContext('2d');

  function font(size, weight) { return `${weight || 'bold'} ${size}px ${FAMILY}`; }
  function measure(str, size) { measureCtx.font = font(size); return measureCtx.measureText(str).width; }
  function setResolution(dpr) { res = Math.min(3, Math.max(2, Math.ceil(dpr))); cache.clear(); }

  // Sprite for a string. opts: fill, stroke, wobble (px of baseline jitter, default size*0.03), grain (0..1).
  function sprite(str, size, opts) {
    const key = `${str}|${size}|${opts.fill}|${opts.stroke}|${opts.wobble}|${res}`;
    let s = cache.get(key);
    if (s) return s;
    const pad = Math.ceil(size * 0.22);
    const w = Math.ceil(measure(str, size)) + 2 * pad;
    const h = Math.ceil(size * 1.35) + 2 * pad;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
    const g = c.getContext('2d');
    g.scale(res, res);
    g.font = font(size);
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const base = pad + size * 1.0;
    const rnd = Dangle.Crayon.rng(str.length * 977 + size);
    const wob = opts.wobble === undefined ? size * 0.03 : opts.wobble;
    let x = pad;
    // Outline pass for every letter, then fill pass, so neighbouring outlines never cut into fills.
    const spots = [];
    for (const ch of str) {
      spots.push({ ch, x, y: base + (rnd() - 0.5) * 2 * wob, r: (rnd() - 0.5) * 0.08 });
      x += measure(ch, size);
    }
    const kern = (measure(str, size) - (x - pad));   // keep the overall width even with per-char measuring
    const draw = (stroke) => {
      for (const sp of spots) {
        g.save();
        g.translate(sp.x + kern * (sp.x - pad) / Math.max(1, x - pad), sp.y);
        g.rotate(sp.r);
        if (stroke) { g.strokeStyle = opts.stroke; g.lineWidth = size * 0.2; g.strokeText(sp.ch, 0, 0); }
        else { g.fillStyle = opts.fill; g.fillText(sp.ch, 0, 0); }
        g.restore();
      }
    };
    g.globalAlpha = 0.4; draw(true); g.globalAlpha = 1;
    g.save(); g.scale(1, 1); g.lineWidth = size * 0.14; draw(true); g.restore();
    draw(false);
    Dangle.Crayon.grain(g, 0, 0, w, h, opts.grain === undefined ? 0.9 : opts.grain);
    s = { canvas: c, w, h, pad, base };
    if (cache.size > CAP) cache.delete(cache.keys().next().value);
    cache.set(key, s);
    return s;
  }

  // Draw hand-lettered text. align: 'left' | 'center' | 'right'. (x, y) is the baseline start.
  function text(ctx, str, x, y, size, opts) {
    opts = opts || {};
    const s = sprite(str, size, { fill: opts.fill || '#3a3a48', stroke: opts.stroke || '#fdf0dc', wobble: opts.wobble, grain: opts.grain });
    if (!s.w || !s.h) return;                   // a zero-size window (hidden pane) has nothing to draw
    let dx = x - s.pad;
    const inner = s.w - 2 * s.pad;
    if (opts.align === 'center') dx = x - inner / 2 - s.pad;
    else if (opts.align === 'right') dx = x - inner - s.pad;
    const prev = ctx.globalAlpha;
    if (opts.alpha !== undefined) ctx.globalAlpha = prev * opts.alpha;
    ctx.drawImage(s.canvas, dx, y - s.base, s.w, s.h);
    ctx.globalAlpha = prev;
  }

  // Plain crisp text with a light halo: for values that change every frame.
  function plain(ctx, str, x, y, size, color, align, halo) {
    ctx.font = font(size);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (halo !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.22; ctx.strokeStyle = halo || 'rgba(253,240,220,0.95)'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color || '#3a3a48';
    ctx.fillText(str, x, y);
    ctx.textAlign = 'left';
  }

  Dangle.Type = { text, plain, measure, font, setResolution, FAMILY };
})();
