// Menu backdrop and title art: pale far hills (per theme), a crayon ground strip with scenery, drifting
// clouds, and the hanging DANGLE lettering with two characters swinging from ropes. All drawn, no physics.
window.Dangle = window.Dangle || {};

(function () {
  const U = () => Dangle.Ui;
  const C = () => Dangle.Crayon;
  const puppets = {};                 // cached cosmetic state per key
  const camTmp = { x: 0, y: 0, scale: 1 };
  const GROUND_Y = 610;

  function puppet(key, seed) {
    if (!puppets[key]) puppets[key] = Dangle.DrawPlayer.newPuppet(seed);
    return puppets[key];
  }
  function tickPuppets(dt) { for (const k in puppets) Dangle.DrawPlayer.puppetUpdate(puppets[k], dt); }

  // Scenery placements for a theme, fixed positions along the ground (virtual coords).
  const sceneryCache = {};
  function sceneryFor(themeId) {
    if (sceneryCache[themeId]) return sceneryCache[themeId];
    const theme = Dangle.Themes.get(themeId);
    const rnd = C().rng(themeId.length * 313 + 5);
    const items = [];
    for (let x = -500; x < 1800; x += 150 + rnd() * 190) {
      const kind = theme.scenery[Math.floor(rnd() * theme.scenery.length)];
      const back = ['bush', 'stalk', 'cactus', 'pine', 'column', 'gear', 'cloud', 'bunting'].indexOf(kind) >= 0;
      items.push({ kind, x, y: GROUND_Y + 4, s: 0.9 + rnd() * 0.5, seed: Math.floor(rnd() * 1e9), back });
    }
    return (sceneryCache[themeId] = items);
  }

  // Full-canvas backdrop. (fit = {s, ox, oy} from Ui.fit)
  function backdrop(ctx, viewW, viewH, dpr, fit, t, themeId) {
    const theme = Dangle.Themes.get(themeId);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = Dangle.config.BG_COLOR;
    ctx.fillRect(0, 0, viewW, viewH);
    camTmp.x = 400 + t * 22; camTmp.y = 0; camTmp.scale = fit.s;
    Dangle.LevelLayer.drawFar(ctx, Dangle.LevelLayer.farOnly(themeId), camTmp, viewW, viewH, dpr);

    ctx.setTransform(dpr * fit.s, 0, 0, dpr * fit.s, dpr * fit.ox, dpr * fit.oy);
    // Drifting clouds.
    for (let k = 0; k < 4; k++) {
      const x = ((k * 430 + t * (8 + k * 3)) % 1900) - 300;
      Dangle.Scenery.draw(ctx, { kind: 'cloud', x, y: 150 + (k % 2) * 90 + Math.sin(t * 0.4 + k) * 6, s: 1.5 + (k % 3) * 0.3, seed: 40 + k }, theme);
    }
    const items = sceneryFor(themeId);
    for (const it of items) if (it.back) Dangle.Scenery.draw(ctx, it, theme);
    // Ground strip: wide enough to cover the letterbox bars on any aspect ratio.
    const gw = 2600, gh = 420;
    const g = U().panelSprite(gw, gh, theme.ground[0], theme.ground[1], 5, 0);
    ctx.drawImage(g.canvas, 640 - gw / 2 - g.pad, GROUND_Y - g.pad, g.w, g.h);
    const band = U().panelSprite(gw, 16, theme.top, theme.top, 6, 0);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(band.canvas, 640 - gw / 2 - band.pad, GROUND_Y - band.pad, band.w, band.h);
    ctx.globalAlpha = 1;
    // Tall/portrait windows show far more ground than the strip covers: flat fill below it, edges hidden.
    ctx.fillStyle = theme.ground[0];
    ctx.fillRect(640 - gw / 2, GROUND_Y + gh - 40, gw, 6000);
    for (const it of items) if (!it.back) Dangle.Scenery.draw(ctx, it, theme);
  }

  // The DANGLE lettering, each letter hanging from a sagging rope by a peg.
  function logo(ctx, t, cx, top) {
    const chars = Dangle.Characters.list;
    const letters = 'DANGLE';
    const size = 168, step = 172;
    const x0 = cx - (letters.length - 1) * step / 2;
    const sag = 34;
    // Rope.
    ctx.strokeStyle = '#7a5434'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 - 130, top - 22); ctx.quadraticCurveTo(cx, top + sag * 2 - 22, x0 + (letters.length - 1) * step + 130, top - 22);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3; ctx.stroke();
    const ropeX0 = x0 - 130, ropeSpan = (letters.length - 1) * step + 260;
    for (let i = 0; i < letters.length; i++) {
      const lx = x0 + i * step;
      const u = (lx - ropeX0) / ropeSpan;                     // the quadratic rope's height at this x
      const ry = top - 22 + 4 * sag * u * (1 - u);
      const ch = chars[i % chars.length];
      const swing = Math.sin(t * 1.3 + i * 0.7) * 0.035;
      ctx.save();
      ctx.translate(lx, ry);
      ctx.rotate(swing);
      // Peg and string.
      ctx.fillStyle = '#7a5434'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#7a5434'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.stroke();
      Dangle.Type.text(ctx, letters[i], 0, 44 + size * 0.86, size, { align: 'center', fill: ch.body, stroke: ch.dark, wobble: 5 });
      ctx.restore();
    }
  }

  // Two characters swinging on short ropes from the top edge.
  // drop: rope length before the head (virtual px at scale 1).
  function dangler(ctx, t, key, ch, x, phase, scale, face, drop) {
    const st = puppet(key, key.length * 7);
    st.face = face || 'idle';
    const sway = Math.sin(t * 1.5 + phase);
    const k = 1.25 * scale;                                   // puppet size
    const px = x + sway * 60 * scale;
    const py = (drop || 250) * scale + 40;
    const hx = 14 * k, hy = -100 * k;                         // hands sit on the rope end
    ctx.strokeStyle = '#7a5434'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(px, py + hy); ctx.stroke();
    const tilt = -sway * 0.25;
    st.lookX = Math.cos(t * 0.7 + phase) * 0.6; st.lookY = 0.35;
    Dangle.DrawPlayer.drawPuppet(ctx, ch, st, px, py, [{ x: -14, y: -100 }, { x: 14, y: -100 }], { scale: k, tilt, stretch: 0.55, closed: true });
  }

  Dangle.Scene = { backdrop, logo, dangler, puppet, tickPuppets, GROUND_Y };
})();
