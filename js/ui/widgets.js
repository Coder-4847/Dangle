// Menu drawing toolkit, in virtual 1280x720 coordinates: wobbly crayon panels/buttons (rendered once
// into cached sprites), icons, easing helpers. Screens compose these; nothing here knows about game state.
window.Dangle = window.Dangle || {};

(function () {
  const VW = 1280;
  const VH = 720;
  const INK = '#3a3a48';
  const cache = new Map();
  const CAP = 260;
  let res = 2;

  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function approach(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function setResolution(dpr) { res = Math.min(3, Math.max(2, Math.ceil(dpr * 1.25))); cache.clear(); }
  function shade(c, a) { return Dangle.Crayon.shade(c, a); }

  // A wobbly rounded panel as a cached sprite: fill, outline, a lighter top edge, grain.
  function panelSprite(w, h, fill, edge, seed, radius) {
    const key = `${w}|${h}|${fill}|${edge}|${seed}|${radius}|${res}`;
    let s = cache.get(key);
    if (s) return s;
    const pad = 10;
    s = Dangle.Crayon.sprite(w + 2 * pad, h + 2 * pad, res, (g) => {
      g.translate(pad, pad);
      const path = Dangle.Crayon.toPath(Dangle.Crayon.wobble(Dangle.Crayon.rectPts(0, 0, w, h), seed, { amp: 1.5, radius: radius === undefined ? 14 : radius, step: 16 }));
      g.fillStyle = fill; g.fill(path);
      g.save(); g.clip(path);
      g.fillStyle = shade(fill, 0.22); g.globalAlpha = 0.55; g.fillRect(0, 0, w, Math.min(10, h * 0.16)); g.globalAlpha = 1;
      g.restore();
      Dangle.Crayon.grain(g, -pad, -pad, w + 2 * pad, h + 2 * pad, 0.9);
      Dangle.Crayon.outline(g, path, edge, 4);
    });
    s.pad = pad;
    if (cache.size > CAP) cache.delete(cache.keys().next().value);
    cache.set(key, s);
    return s;
  }

  // Draw a panel with its top-left at (x, y), optionally scaled/rotated about its centre.
  function panel(ctx, x, y, w, h, fill, edge, seed, opts) {
    opts = opts || {};
    const s = panelSprite(Math.round(w), Math.round(h), fill, edge, seed || 1, opts.radius);
    const sc = opts.scale || 1;
    if (sc === 1 && !opts.rot) { ctx.drawImage(s.canvas, x - s.pad, y - s.pad, s.w, s.h); return; }
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (opts.rot) ctx.rotate(opts.rot);
    ctx.scale(sc, sc);
    ctx.drawImage(s.canvas, -w / 2 - s.pad, -h / 2 - s.pad, s.w, s.h);
    ctx.restore();
  }

  // ---- icons (drawn at centre (x, y), size s) -------------------------------------------------
  function lock(ctx, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 30, s / 30);
    ctx.strokeStyle = color || INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -6, 8, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = color || INK;
    ctx.beginPath(); ctx.moveTo(-12, -5); ctx.lineTo(12, -5); ctx.lineTo(12, 13); ctx.quadraticCurveTo(0, 16, -12, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fdf0dc'; ctx.beginPath(); ctx.arc(0, 4, 2.6, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  function star(ctx, x, y, s, fill, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * 0.42 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, s * 0.2);
    ctx.strokeStyle = fill ? shade(color || '#f2c94c', -0.45) : 'rgba(58,58,72,0.35)'; ctx.stroke();
    if (fill) { ctx.fillStyle = color || '#f2c94c'; ctx.fill(); }
    ctx.restore();
  }
  function check(ctx, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color || '#3f8f52'; ctx.lineWidth = Math.max(3, s * 0.28); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.7, 0); ctx.lineTo(-s * 0.2, s * 0.5); ctx.lineTo(s * 0.8, -s * 0.6); ctx.stroke();
    ctx.restore();
  }
  function arrow(ctx, x, y, s, dir, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(dir === 'left' ? Math.PI : dir === 'up' ? -Math.PI / 2 : dir === 'down' ? Math.PI / 2 : 0);
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, -s * 0.9); ctx.lineTo(-s * 0.35, 0); ctx.lineTo(-s * 0.7, s * 0.9); ctx.closePath();
    ctx.fillStyle = color || INK; ctx.fill();
    ctx.restore();
  }
  // Blue glove pointing right: the menu cursor.
  function cursor(ctx, x, y, t) {
    const g = Dangle.CharArt.gloveSprite(0, false, 3);
    ctx.save(); ctx.translate(x + Math.sin(t * 6) * 4, y); ctx.scale(1.5, 1.5);
    ctx.drawImage(g.canvas, -g.ox, -g.oy, g.w, g.h);
    ctx.restore();
  }

  // A focusable button/tile. it: {x,y,w,h,label,color,f (focus 0..1),locked}. Draws label centred.
  function button(ctx, it, t, opts) {
    opts = opts || {};
    const f = it.f || 0;
    const color = it.locked ? '#cfc6b4' : (it.color || '#f3c46a');
    const sc = 1 + 0.06 * f;
    panel(ctx, it.x, it.y, it.w, it.h, f > 0.5 ? shade(color, 0.16) : color, it.locked ? '#9b917f' : shade(color, -0.5), it.seed || 3, { scale: sc, rot: Math.sin(t * 5) * 0.012 * f });
    const fs = it.size || 34;
    Dangle.Type.text(ctx, it.label, it.x + it.w / 2, it.y + it.h / 2 + fs * 0.34, fs, { align: 'center', fill: it.locked ? '#8c8474' : INK, stroke: it.locked ? '#e6dfd0' : shade(color, 0.6) });
    if (it.locked) lock(ctx, it.x + it.w - 30, it.y + 28, 26, '#8c8474');
    if (f > 0.05 && !opts.noCursor) { ctx.globalAlpha = f; cursor(ctx, it.x - 34, it.y + it.h / 2, t); ctx.globalAlpha = 1; }
  }

  // Slider 0..1: track, filled part, and a round knob.
  function slider(ctx, x, y, w, v, f, color) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(58,58,72,0.28)'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    ctx.strokeStyle = color || '#4a8fe0'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * v, y); ctx.stroke();
    ctx.fillStyle = '#fff6e4'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x + w * v, y, 13 + 3 * f, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // On/off pill.
  function toggle(ctx, x, y, on, f) {
    const w = 78, h = 38;
    ctx.fillStyle = on ? '#6fbf5a' : '#c9bfae'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff6e4';
    ctx.beginPath(); ctx.arc(x + (on ? w - h / 2 : h / 2), y, h / 2 - 5 + f * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Virtual-space transform for a canvas of viewW x viewH CSS px (letterboxed to 16:9). Returns {s, ox, oy}.
  function fit(viewW, viewH, out) {
    const s = Math.min(viewW / VW, viewH / VH);
    out.s = s; out.ox = (viewW - VW * s) / 2; out.oy = (viewH - VH * s) / 2;
    return out;
  }

  Dangle.Ui = { VW, VH, INK, ease, clamp01, approach, panel, panelSprite, lock, star, check, arrow, cursor, button, slider, toggle, fit, setResolution, shade };
})();
