// Minimal HUD for Phase 3: off-screen player arrows, timer, level title, completion banner.
// Phase 5 replaces this with the real HUD (per-player tags, menus).
window.Dangle = window.Dangle || {};

(function () {
  const INK = '#3a3a48';

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }

  function label(ctx, text, x, y, size, color) {
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(253,240,220,0.9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color || INK;
    ctx.fillText(text, x, y);
  }

  function arrows(ctx, W) {
    for (const a of Dangle.Camera.arrows) {
      const p = W.players[a.index];
      if (!p) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13);
      ctx.closePath();
      ctx.fillStyle = p.look.head;
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      label(ctx, 'P' + (a.index + 1), a.x, a.y - 22, 13, INK);
    }
  }

  function draw(ctx, W, viewW, viewH) {
    ctx.textBaseline = 'alphabetic';
    if (!Dangle.Camera.cam.introOn) arrows(ctx, W);
    const L = W.level;
    if (!L) { ctx.textAlign = 'start'; return; }
    const spec = L.spec;

    // Title fades in while the camera pans, then out.
    const cam = Dangle.Camera.cam;
    if (cam.introOn) {
      const c = Dangle.config;
      const fade = Math.min(1, cam.introT / 0.4);
      ctx.globalAlpha = fade;
      label(ctx, spec.name, viewW / 2, viewH * 0.16, 32, INK);
      label(ctx, cam.introT < c.CAM_INTRO_HOLD ? 'get to the flag' : 'ready?', viewW / 2, viewH * 0.16 + 30, 16, '#6b6b7a');
      ctx.globalAlpha = 1;
    }

    // Clock (starts on the first input) and deaths.
    const t = L.complete ? L.time : L.started ? L.t - L.startT : 0;
    label(ctx, fmtTime(t), viewW / 2, 34, 22, INK);

    if (L.complete) {
      const k = Math.min(1, (L.t - L.completeT) / 0.5);
      ctx.globalAlpha = k;
      label(ctx, 'LEVEL COMPLETE', viewW / 2, viewH * 0.38, 40, INK);
      label(ctx, fmtTime(L.time), viewW / 2, viewH * 0.38 + 40, 26, '#6b6b7a');
      label(ctx, 'L: next level   R: retry', viewW / 2, viewH * 0.38 + 74, 16, '#6b6b7a');
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'start';
  }

  Dangle.Hud = { draw, fmtTime };
})();
