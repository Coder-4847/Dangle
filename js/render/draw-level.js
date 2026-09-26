// Live-drawn level rule objects: wind, liquids and tides, checkpoint flags, the goal, and the
// Lantern Caves darkness. (Spikes and static geometry are in the pre-rendered level layer.)
window.Dangle = window.Dangle || {};

(function () {
  const INK = '#3a3a48';
  let dark = null;       // offscreen canvas for the darkness mask (half resolution: it is soft anyway)
  const flagAge = [];    // per checkpoint: seconds since it was reached (drives the flourish)

  function liquid(ctx, x0, x1, top, bottom, color, alpha, t) {
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    ctx.lineTo(x0, top);
    for (let x = x0; x <= x1; x += 18) ctx.lineTo(x, top + Math.sin(x * 0.045 + t * 2.2) * 4);
    ctx.lineTo(x1, top);
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = x0 + 10; x < x1 - 10; x += 60) {
      const y = top + 9 + Math.sin(x * 0.045 + t * 2.2) * 4;
      ctx.moveTo(x, y); ctx.lineTo(x + 18, y);
    }
    ctx.stroke();
  }

  function wind(ctx, z, t) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = 'rgba(90,110,130,0.35)';
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    const dir = z.ay < 0 ? -1 : 1;
    for (let cx = z.x + 35; cx < z.x + z.w; cx += 64) {
      for (let k = 0; k < 4; k++) {
        const u = ((t * 0.45 + k / 4 + cx * 0.013) % 1 + 1) % 1;
        const y = dir < 0 ? z.y + z.h - u * z.h : z.y + u * z.h;
        const sway = Math.sin(t * 2 + cx) * 4;
        ctx.beginPath(); ctx.moveTo(cx - 10 + sway, y + dir * 9); ctx.lineTo(cx + sway, y); ctx.lineTo(cx + 10 + sway, y + dir * 9); ctx.stroke();
      }
    }
  }

  // Pennant: waves gently; just after it is reached it pops up and flutters harder.
  function flag(ctx, x, y, h, color, t, lift) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 2.5, y - h, 5, h);
    ctx.beginPath(); ctx.arc(x, y - h, 4, 0, Math.PI * 2); ctx.fill();
    const w = h * 0.5, top = y - h + 4 - lift * 8;
    const amp = 3 + lift * 5;
    ctx.beginPath();
    ctx.moveTo(x + 2, top);
    ctx.quadraticCurveTo(x + w * 0.5, top + Math.sin(t * 5) * amp, x + w, top + h * 0.15 + Math.sin(t * 5 + 1) * amp);
    ctx.quadraticCurveTo(x + w * 0.5, top + h * 0.28 + Math.sin(t * 5 + 2) * amp * 0.5, x + 2, top + h * 0.3);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  }

  // Goal: a tall pole with a checkered pennant over a soft glowing patch.
  function goalFlag(ctx, g, t, accent) {
    const x = g.x + g.w / 2, y = g.y + g.h, h = g.h * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(x, y - 4, g.w * 0.55, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(x - 3, y - h, 6, h);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, y - h, 6, 0, Math.PI * 2); ctx.fill();
    const cols = 5, rows = 3, cw = 11, top = y - h + 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wave = Math.sin(t * 4 - c * 0.9) * (c / cols) * 5;
        ctx.fillStyle = (r + c) % 2 ? '#ffffff' : INK;
        ctx.fillRect(x + 3 + c * cw, top + r * cw + wave, cw + 0.5, cw + 0.5);
      }
    }
  }

  function back(ctx, W) {
    const L = W.level;
    if (!L) return;
    const theme = Dangle.Themes.get(W.themeId);
    for (const z of L.winds) wind(ctx, z, L.t);
    for (const r of L.risers) {       // tides behind the ground, so they only show above it
      const top = Dangle.Hazards.tideTop(L, r);
      liquid(ctx, r.x0, r.x1, top, r.startY + 20, r.type === 'lava' ? theme.hazard : theme.water, r.type === 'lava' ? 0.92 : 0.6, L.t);
    }
  }

  function front(ctx, W, dt) {
    const L = W.level;
    if (!L) return;
    const theme = Dangle.Themes.get(W.themeId);
    for (const h of L.hazards) {
      if (h.type === 'lava') liquid(ctx, h.x, h.x + h.w, h.y, h.y + h.h, theme.hazard, 0.95, L.t);
      else if (h.type === 'water') liquid(ctx, h.x, h.x + h.w, h.y, h.y + h.h, theme.water, 0.6, L.t);
    }
    L.spec.checkpoints.forEach((c, i) => {
      const on = i <= L.checkpoint;
      flagAge[i] = on ? (flagAge[i] || 0) + dt : 0;
      const lift = on ? Math.max(0, 1 - flagAge[i] / 0.6) : 0;
      flag(ctx, c.x, c.y, 88, on ? theme.accent : '#c9bfae', L.t, lift);
    });
    goalFlag(ctx, L.spec.goal, L.t, theme.accent);
  }

  function resetFlags() { flagAge.length = 0; }

  // Darkness: a dim veil with soft holes around players, lanterns, flags and the goal.
  function darkness(ctx, W, layer, cam, viewW, viewH, dpr) {
    if (!layer.theme.dark) return;
    const s = 0.5;
    const w = Math.ceil(viewW * s), h = Math.ceil(viewH * s);
    if (!dark) dark = document.createElement('canvas');
    if (dark.width !== w || dark.height !== h) { dark.width = w; dark.height = h; }
    const g = dark.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(24,18,38,0.9)';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => {
      const sx = (viewW / 2 + (x - cam.x) * cam.scale) * s, sy = (viewH / 2 + (y - cam.y) * cam.scale) * s, sr = r * cam.scale * s;
      if (sx < -sr || sx > w + sr || sy < -sr || sy > h + sr) return;
      const gr = g.createRadialGradient(sx, sy, sr * 0.25, sx, sy, sr);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    };
    const R = Dangle.config.REACH;
    for (const p of W.players) if (!p.dead) hole(p.head.position.x, p.head.position.y, 2.8 * R);
    for (const l of layer.lights) hole(l.x, l.y, l.r);
    if (W.level) {
      for (const c of W.level.spec.checkpoints) hole(c.x, c.y - 50, 1.3 * R);
      const gl = W.level.spec.goal;
      hole(gl.x + gl.w / 2, gl.y + gl.h / 2, 1.8 * R);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(dark, 0, 0, viewW, viewH);
  }

  Dangle.DrawLevel = { back, front, darkness, resetFlags };
})();
