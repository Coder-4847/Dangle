// Cosmetic particles and screen shake, driven by the level's event queue (deaths, respawns,
// checkpoints, bounces, completion) and by landings seen in draw-player.js. A fixed pool: nothing is
// allocated while playing. Integrated with the frame's dt, so it looks the same at any refresh rate.
window.Dangle = window.Dangle || {};

(function () {
  const MAX = 600;
  const DUST = 0, SPARKLE = 1, CONFETTI = 2, RING = 3, PUFF = 4;
  const pool = [];
  for (let i = 0; i < MAX; i++) pool.push({ on: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 1, rot: 0, vr: 0, color: '#fff' });
  let next = 0;
  let shakeAmt = 0;
  let shakeT = 0;
  const CONF_COLORS = ['#f26b8a', '#f4d35e', '#4a8fe0', '#6fbf5a', '#f2a03d', '#ae8ddb'];

  function spawn(type, x, y, vx, vy, life, size, color) {
    const p = pool[next];
    next = (next + 1) % MAX;              // oldest particle is recycled if the pool is full
    p.on = true; p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.t = 0; p.life = life; p.size = size; p.color = color;
    p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 12;
  }

  function burst(type, x, y, n, speed, life, size, color, up) {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      spawn(type, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6),
        color || CONF_COLORS[i % CONF_COLORS.length]);
    }
  }

  function shake(amount) {
    if (!Dangle.config.SCREEN_SHAKE) return;
    shakeAmt = Math.max(shakeAmt, amount);
  }

  // Dust kicked up on landing; big landings also nudge the camera.
  function land(x, y, impact) {
    const n = Math.min(10, Math.round(impact / 140));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      spawn(DUST, x + side * 10, y - 4, side * (60 + Math.random() * 90), -20 - Math.random() * 50, 0.5 + Math.random() * 0.3, 6 + Math.random() * 5, 'rgba(150,130,110,1)');
    }
    if (impact > 1100) shake(Math.min(9, (impact - 1100) / 90));
  }

  function consume(W) {
    const L = W.level;
    if (!L) return;
    const colorOf = (i) => { const p = W.players[i]; return p && p.look && p.look.body ? p.look.body : '#f2a03d'; };
    for (const e of L.events) {
      if (e.type === 'death') { burst(PUFF, e.x, e.y, 14, 260, 0.55, 9, colorOf(e.player)); burst(DUST, e.x, e.y, 6, 120, 0.6, 8, 'rgba(120,110,100,1)'); shake(5); }
      else if (e.type === 'revive') { spawn(RING, e.x, e.y, 0, 0, 0.45, 8, colorOf(e.player)); burst(SPARKLE, e.x, e.y, 8, 160, 0.5, 5, '#ffffff'); }
      else if (e.type === 'checkpoint') { burst(SPARKLE, e.x + 20, e.y - 70, 16, 220, 0.8, 6, Dangle.Themes.get(W.themeId).accent); spawn(RING, e.x, e.y - 60, 0, 0, 0.5, 10, '#ffffff'); }
      else if (e.type === 'bounce') { burst(DUST, e.x, e.y - 2, 5, 110, 0.4, 6, 'rgba(255,255,255,1)', true); }
      else if (e.type === 'complete') {
        const g = L.spec.goal;
        burst(CONFETTI, g.x + g.w / 2, g.y + g.h * 0.2, 70, 620, 2.2, 7, null, true);
        burst(SPARKLE, g.x + g.w / 2, g.y + g.h * 0.4, 18, 260, 0.9, 7, '#fff3c4');
      }
    }
  }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life) { p.on = false; continue; }
      let drag = 3, grav = 0;
      if (p.type === CONFETTI) { drag = 2.2; grav = 700; }
      else if (p.type === DUST) { drag = 4; grav = -60; }
      else if (p.type === PUFF) { drag = 5; grav = 120; }
      else if (p.type === SPARKLE) { drag = 3.5; grav = 90; }
      const k = Math.exp(-drag * dt);
      p.vx *= k; p.vy = p.vy * k + grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    shakeT += dt;
    shakeAmt *= Math.exp(-9 * dt);
    if (shakeAmt < 0.05) shakeAmt = 0;
  }

  // Screen-space offset for the camera this frame.
  const off = { x: 0, y: 0 };
  function shakeOffset() {
    off.x = shakeAmt * Math.sin(shakeT * 61);
    off.y = shakeAmt * Math.cos(shakeT * 47);
    return off;
  }

  function star(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = rot + k * Math.PI / 4, rr = k % 2 ? r * 0.35 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function draw(ctx) {
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.on) continue;
      const u = p.t / p.life;
      ctx.globalAlpha = p.type === CONFETTI ? Math.min(1, (1 - u) * 3) : 1 - u;
      ctx.fillStyle = p.color;
      if (p.type === DUST) { ctx.globalAlpha *= 0.45; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + u * 1.4), 0, Math.PI * 2); ctx.fill(); }
      else if (p.type === PUFF) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - u * 0.6), 0, Math.PI * 2); ctx.fill(); }
      else if (p.type === SPARKLE) star(ctx, p.x, p.y, p.size * (1 - u * 0.5), p.rot);
      else if (p.type === CONFETTI) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size * 0.3 * Math.abs(Math.cos(p.rot * 1.7)) - 1, p.size, p.size * 0.6 * Math.abs(Math.cos(p.rot * 1.7)) + 2);
        ctx.restore();
      } else if (p.type === RING) {
        ctx.strokeStyle = p.color; ctx.lineWidth = 4 * (1 - u);
        ctx.beginPath(); ctx.arc(p.x, p.y, 18 + u * 50, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function reset() { for (const p of pool) p.on = false; shakeAmt = 0; }
  function count() { let n = 0; for (const p of pool) if (p.on) n++; return n; }

  Dangle.Fx = { consume, update, draw, land, shake, shakeOffset, reset, count };
})();
