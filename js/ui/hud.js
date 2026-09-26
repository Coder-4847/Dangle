// In-game HUD: clock, level title during the camera intro, off-screen player arrows, co-op player tags,
// the hold-R restart ring, and the visual how-to-play strip. Menus (js/ui/menus.js) are separate.
window.Dangle = window.Dangle || {};

(function () {
  const INK = '#3a3a48';
  const sc = { x: 0, y: 0 };

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }

  function label(ctx, text, x, y, size, color) {
    Dangle.Type.plain(ctx, text, x, y, size, color || INK, 'center');
  }

  function arrows(ctx, W) {
    for (const a of Dangle.Camera.arrows) {
      const p = W.players[a.index];
      if (!p) continue;
      const ch = p.look;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13);
      ctx.closePath();
      ctx.fillStyle = ch.body;
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = ch.dark; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      label(ctx, 'P' + (a.index + 1), a.x, a.y - 22, 14, ch.dark);
    }
  }

  // Small coloured marker above each head so two players can tell who is who.
  function tags(ctx, W, viewW, viewH) {
    if (W.players.length < 2) return;
    const alpha = Dangle.World.pose ? 1 : 1;
    for (const p of W.players) {
      if (p.dead) continue;
      Dangle.Camera.worldToScreen(p.head.position.x, p.head.position.y - 62, viewW, viewH, sc);
      if (sc.x < -20 || sc.x > viewW + 20 || sc.y < -20 || sc.y > viewH + 20) continue;
      const ch = p.look;
      ctx.beginPath();
      ctx.moveTo(sc.x - 10, sc.y - 12); ctx.lineTo(sc.x + 10, sc.y - 12); ctx.lineTo(sc.x, sc.y + 2);
      ctx.closePath();
      ctx.fillStyle = ch.body; ctx.globalAlpha = alpha; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = ch.dark; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.globalAlpha = 1;
      label(ctx, String(p.index + 1), sc.x, sc.y - 17, 16, ch.dark);
    }
  }

  function holdRing(ctx, viewW, viewH, k) {
    if (k <= 0) return;
    const x = viewW / 2, y = viewH * 0.22, r = 30;
    ctx.fillStyle = 'rgba(253,240,220,0.85)';
    ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(58,58,72,0.25)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#e8544a'; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    label(ctx, 'R', x, y + 8, 22, INK);
    label(ctx, 'hold to restart', x, y + r + 34, 18, INK);
  }

  // opts: { name, restartHold (0..1), pauseHint (bool), showClock (bool) }
  function draw(ctx, W, viewW, viewH, opts) {
    opts = opts || {};
    ctx.textBaseline = 'alphabetic';
    const L = W.level;
    if (!L) return;
    const cam = Dangle.Camera.cam;
    if (!cam.introOn) arrows(ctx, W);
    tags(ctx, W, viewW, viewH);

    // Title fades in while the camera pans, then out.
    if (cam.introOn && opts.introTitle !== false) {
      const c = Dangle.config;
      const fade = Math.min(1, cam.introT / 0.4);
      ctx.globalAlpha = fade;
      Dangle.Type.text(ctx, opts.name || L.spec.name, viewW / 2, viewH * 0.17, Math.round(Math.min(46, viewW / 18)), { align: 'center', fill: '#fff6e4', stroke: INK });
      Dangle.Type.text(ctx, cam.introT < c.CAM_INTRO_HOLD ? 'get everyone to the flag' : 'ready?', viewW / 2, viewH * 0.17 + 38, 22, { align: 'center', fill: '#fff6e4', stroke: INK, wobble: 0 });
      ctx.globalAlpha = 1;
    }

    // Clock (starts on the first input).
    const t = L.complete ? L.time : L.started ? L.t - L.startT : 0;
    Dangle.Type.plain(ctx, fmtTime(t), viewW / 2, 38, 26, INK, 'center');
    if (opts.pauseIcon) {   // two bars top-right; clicking it pauses
      ctx.fillStyle = 'rgba(253,240,220,0.85)'; ctx.beginPath(); ctx.arc(viewW - 34, 34, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK; ctx.fillRect(viewW - 42, 24, 6, 20); ctx.fillRect(viewW - 30, 24, 6, 20);
    }
    holdRing(ctx, viewW, viewH, opts.restartHold || 0);
    ctx.textAlign = 'start';
  }

  // ---- how to play: a visual strip, no text walls ---------------------------------------------------
  function keycap(ctx, x, y, label, lit) {
    ctx.fillStyle = lit ? '#f2c94c' : '#fff6e4';
    ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 20, y - 20, 40, 40, 8); ctx.fill(); ctx.stroke();
    Dangle.Type.plain(ctx, label, x, y + 8, 22, INK, 'center', false);
  }

  function drawHowTo(ctx, viewW, viewH, t) {
    const down = Dangle.Input.isDown;
    const y = viewH - 96;
    const s = Math.min(1, viewW / 1120);
    ctx.save();
    ctx.translate(viewW / 2, y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(253,240,220,0.88)';
    ctx.beginPath(); ctx.roundRect(-540, -78, 1080, 156, 26); ctx.fill();
    ctx.strokeStyle = '#a88a4f'; ctx.lineWidth = 4; ctx.stroke();

    // Keyboard: lights up as you press.
    keycap(ctx, -460, -38, 'W', down('KeyW') || down('ArrowUp'));
    keycap(ctx, -504, 6, 'A', down('KeyA') || down('ArrowLeft'));
    keycap(ctx, -460, 6, 'S', down('KeyS') || down('ArrowDown'));
    keycap(ctx, -416, 6, 'D', down('KeyD') || down('ArrowRight'));
    keycap(ctx, -360, -38, 'Q', down('KeyQ'));
    keycap(ctx, -316, -38, 'E', down('KeyE'));
    Dangle.Type.plain(ctx, 'aim', -460, 62, 20, '#6b6b7a', 'center', false);
    Dangle.Type.plain(ctx, 'grab', -338, 62, 20, '#6b6b7a', 'center', false);

    // The three moves, cycling: reach (arm swings out), grab (glove closes), pull (arrow back).
    const step = Math.floor(t / 1.7) % 3;
    const u = (t % 1.7) / 1.7;
    const names = ['Aim', 'Grab', 'Pull'];
    for (let i = 0; i < 3; i++) {
      const cx = -130 + i * 190;
      const on = i === step;
      ctx.globalAlpha = on ? 1 : 0.45;
      ctx.fillStyle = on ? '#fff6e4' : 'rgba(255,255,255,0.4)';
      ctx.strokeStyle = on ? '#e8a23a' : '#b8a888'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(cx - 78, -60, 156, 112, 18); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(cx, -12);
      if (i === 0) {   // arm reaching toward a wall
        ctx.strokeStyle = '#d9832b'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-48, 6); ctx.lineTo(-48 + 62 * Math.min(1, u * 1.6), 6 - 10 * Math.min(1, u * 1.6)); ctx.stroke();
        ctx.fillStyle = '#c9a27a'; ctx.fillRect(38, -30, 16, 62);
        const g = Dangle.CharArt.gloveSprite(0, false, 3);
        ctx.save(); ctx.translate(-48 + 62 * Math.min(1, u * 1.6) + 10, 6 - 10 * Math.min(1, u * 1.6)); ctx.scale(0.8, 0.8); ctx.drawImage(g.canvas, -g.ox, -g.oy, g.w, g.h); ctx.restore();
      } else if (i === 1) {   // glove closing on the wall
        ctx.fillStyle = '#c9a27a'; ctx.fillRect(28, -30, 16, 62);
        const g = Dangle.CharArt.gloveSprite(0, u > 0.45, 3);
        ctx.save(); ctx.translate(6 - (u > 0.45 ? 0 : 6), 0); ctx.scale(0.95, 0.95); ctx.drawImage(g.canvas, -g.ox, -g.oy, g.w, g.h); ctx.restore();
        if (u > 0.45) { ctx.strokeStyle = 'rgba(74,143,224,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(10, 0, 26, 0, 6.28); ctx.stroke(); }
      } else {   // head hauled toward the grip
        ctx.fillStyle = '#c9a27a'; ctx.fillRect(38, -30, 16, 62);
        const hx = -46 + 56 * Math.min(1, u * 1.3);
        ctx.strokeStyle = '#d9832b'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, 8); ctx.lineTo(34, 0); ctx.stroke();
        ctx.fillStyle = '#f2a03d'; ctx.strokeStyle = '#b3621a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(hx, 10, 20, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4a8fe0'; ctx.beginPath(); ctx.arc(36, 0, 9, 0, 6.28); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-58, 40); ctx.lineTo(-30, 40); ctx.moveTo(-58, 40); ctx.lineTo(-48, 32); ctx.moveTo(-58, 40); ctx.lineTo(-48, 48); ctx.stroke();
      }
      ctx.restore();
      Dangle.Type.plain(ctx, names[i], cx, 42, 22, INK, 'center', false);
      ctx.globalAlpha = 1;
    }
    // Gamepad hint.
    Dangle.Type.plain(ctx, 'pad: stick', 462, -22, 20, '#6b6b7a', 'center', false);
    Dangle.Type.plain(ctx, 'LB / RB', 462, 4, 20, '#6b6b7a', 'center', false);
    Dangle.Type.plain(ctx, 'Esc  back', 462, 52, 20, '#6b6b7a', 'center', false);
    ctx.restore();
  }

  Dangle.Hud = { draw, drawHowTo, fmtTime };
})();
