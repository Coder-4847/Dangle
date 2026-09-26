// Placeholder drawing of the level's rule objects: wind, hazards, tides, checkpoints, goal.
// Flat colors from the theme palette; Phase 4 gives them the crayon treatment.
window.Dangle = window.Dangle || {};

(function () {
  const INK = '#3a3a48';

  // Spikes: a row of triangles filling the hazard rect.
  function spikes(ctx, h, color) {
    const n = Math.max(1, Math.round(h.w / 28));
    const tw = h.w / n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(h.x + i * tw, h.y + h.h);
      ctx.lineTo(h.x + (i + 0.5) * tw, h.y);
      ctx.lineTo(h.x + (i + 1) * tw, h.y + h.h);
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // A rectangle of liquid whose surface ripples.
  function liquid(ctx, x0, x1, top, bottom, color, alpha, t) {
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    ctx.lineTo(x0, top);
    for (let x = x0; x <= x1; x += 20) ctx.lineTo(x, top + Math.sin(x * 0.045 + t * 2.2) * 4);
    ctx.lineTo(x1, top);
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function wind(ctx, z, t) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = 'rgba(58,58,72,0.35)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const dir = z.ay < 0 ? -1 : 1;
    // Chevrons drifting along the wind so the direction reads without text.
    for (let cx = z.x + 40; cx < z.x + z.w; cx += 70) {
      for (let k = 0; k < 4; k++) {
        const u = ((t * 0.5 + k / 4 + cx * 0.013) % 1 + 1) % 1;
        const y = dir < 0 ? z.y + z.h - u * z.h : z.y + u * z.h;
        ctx.beginPath();
        ctx.moveTo(cx - 12, y + dir * 10);
        ctx.lineTo(cx, y);
        ctx.lineTo(cx + 12, y + dir * 10);
        ctx.stroke();
      }
    }
  }

  function flag(ctx, x, y, h, color, checked) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 3, y - h, 6, h);
    const w = h * 0.5;
    const top = y - h;
    if (checked) {
      const n = 4;
      const s = w / n;
      for (let r = 0; r < 3; r++) for (let c = 0; c < n; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#fff' : INK;
        ctx.fillRect(x + 3 + c * s, top + r * s, s, s);
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, top, w, 3 * s);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 3, top);
      ctx.lineTo(x + 3 + w, top + h * 0.16);
      ctx.lineTo(x + 3, top + h * 0.32);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    }
  }

  // Behind the world geometry: wind columns and the goal's floor glow.
  function back(ctx, W) {
    const L = W.level;
    if (!L) return;
    for (const z of L.winds) wind(ctx, z, L.t);
    // Tides are drawn behind the ground (down to just under it), so they only show above it.
    const theme = Dangle.Themes.get(W.themeId);
    for (const r of L.risers) {
      const top = Dangle.Hazards.tideTop(L, r);
      liquid(ctx, r.x0, r.x1, top, r.startY + 20, r.type === 'lava' ? theme.hazard : theme.water, r.type === 'lava' ? 0.92 : 0.6, L.t);
    }
    const g = L.spec.goal;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }

  // In front of the world geometry, behind the players: hazards, tides, flags.
  function front(ctx, W) {
    const L = W.level;
    if (!L) return;
    const theme = Dangle.Themes.get(W.themeId);
    for (const h of L.hazards) {
      if (h.type === 'spikes') spikes(ctx, h, theme.hazard);
      else if (h.type === 'lava') liquid(ctx, h.x, h.x + h.w, h.y, h.y + h.h, theme.hazard, 0.95, L.t);
      else if (h.type === 'water') liquid(ctx, h.x, h.x + h.w, h.y, h.y + h.h, theme.water, 0.6, L.t);
    }
    L.spec.checkpoints.forEach((c, i) => flag(ctx, c.x, c.y, 88, i <= L.checkpoint ? theme.accent : '#b9b1a0', false));
    const g = L.spec.goal;
    flag(ctx, g.x + g.w / 2, g.y + g.h, g.h * 0.85, theme.accent, true);
  }

  Dangle.DrawLevel = { back, front };
})();
