// Placeholder player drawing: flat colors, tapered stretchy arms, blue/red gloves.
window.Dangle = window.Dangle || {};

(function () {
  const HAND_COLORS = ['#3b82f6', '#ef4444'];   // left = blue, right = red, always
  const ph = { x: 0, y: 0, a: 0 };
  const pl = { x: 0, y: 0, a: 0 };
  const pr = { x: 0, y: 0, a: 0 };

  // Arm = polyline from head to hand drawn in short segments whose width tapers with stretch.
  function drawArm(ctx, hx, hy, gx, gy, stretch, color) {
    const dx = gx - hx;
    const dy = gy - hy;
    const len = Math.hypot(dx, dy) || 1;
    // Slack arms sag sideways a little; taut arms straighten.
    const bow = (1 - stretch) * Math.min(18, len * 0.25);
    const nx = -dy / len;
    const ny = dx / len;
    const wHead = 15 - stretch * 5;
    const wHand = 9 - stretch * 3;
    const N = 8;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    let px = hx;
    let py = hy;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const off = Math.sin(t * Math.PI) * bow;
      const x = hx + dx * t + nx * off;
      const y = hy + dy * t + ny * off;
      ctx.lineWidth = wHead + (wHand - wHead) * t;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      px = x; py = y;
    }
  }

  function drawPlayer(ctx, p, alpha) {
    const c = Dangle.config;
    Dangle.World.pose(p.head, alpha, ph);
    Dangle.World.pose(p.hands[0], alpha, pl);
    Dangle.World.pose(p.hands[1], alpha, pr);
    const hands = [pl, pr];

    // Respawn pop: a quick scale-up with a little overshoot.
    let pop = 1;
    if (p.popT > 0) { const t = 1 - p.popT / 0.4; pop = t < 0.7 ? t / 0.7 * 1.15 : 1.15 - (t - 0.7) / 0.3 * 0.15; }

    for (let i = 0; i < 2; i++) drawArm(ctx, ph.x, ph.y, hands[i].x, hands[i].y, p.stretch[i], p.look.dark);

    // Head.
    ctx.save();
    ctx.translate(ph.x, ph.y);
    ctx.scale(pop, pop);
    ctx.rotate(ph.a);
    ctx.beginPath();
    ctx.arc(0, 0, c.HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = p.look.head;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = p.look.dark;
    ctx.stroke();
    // Eyes look where the arms aim (or at the gripped surface).
    const ex = p.aim.m > 0 ? p.aim.dx : 0;
    const ey = p.aim.m > 0 ? p.aim.dy : 0.3;
    const cos = Math.cos(-ph.a);
    const sin = Math.sin(-ph.a);
    const lx = ex * cos - ey * sin;
    const ly = ex * sin + ey * cos;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s * 8, -3, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(s * 8 + lx * 2.5, -3 + ly * 2.5, 3, 0, Math.PI * 2); ctx.fill();
    }
    const strain = Math.max(p.stretch[0], p.stretch[1]);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (strain > 0.6) ctx.arc(0, 11, 4, 0, Math.PI * 2);
    else { ctx.moveTo(-5, 10); ctx.quadraticCurveTo(0, 14, 5, 10); }
    ctx.stroke();
    ctx.restore();

    // Gloves (on top of the head), glowing while gripping.
    for (let i = 0; i < 2; i++) {
      const h = hands[i];
      const gripping = !!p.grab[i].pin;
      if (gripping) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, c.HAND_RADIUS + 6, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? 'rgba(59,130,246,0.30)' : 'rgba(239,68,68,0.30)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(h.x, h.y, c.HAND_RADIUS * (gripping ? 1.08 : 1) * pop, 0, Math.PI * 2);
      ctx.fillStyle = HAND_COLORS[i];
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e1e28';
      ctx.stroke();
    }
  }

  function draw(ctx, W, alpha) {
    for (const p of W.players) drawPlayer(ctx, p, alpha);
  }

  Dangle.DrawPlayer = { draw };
})();
