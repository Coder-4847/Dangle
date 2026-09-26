// Player drawing: tapered, slightly curved arms that thin as they stretch; a head sprite with
// squash-and-stretch and a live face (eyes track what you reach for, expressions for strain, fall,
// grab and win, blinking); big colour-coded gloves that close and glow while gripping.
// All cosmetic state lives here (a WeakMap keyed by player): nothing is written back to physics.
window.Dangle = window.Dangle || {};

(function () {
  const INK = '#2c2430';
  const fx = new WeakMap();
  const ph = { x: 0, y: 0, a: 0 };
  const hp = [{ x: 0, y: 0, a: 0 }, { x: 0, y: 0, a: 0 }];
  const edge = new Float32Array(44);     // arm outline points (reused every frame, no allocation)
  let res = 2;

  function charOf(p) { return p.look && p.look.id ? p.look : Dangle.Characters.get(p.index); }

  function state(p) {
    let s = fx.get(p);
    if (!s) {
      s = { q: 0, qv: 0, prevVy: 0, lookX: 0.4, lookY: 0.3, blinkT: 1 + (p.index * 1.7) % 3, blink: 0, face: 'idle' };
      fx.set(p, s);
    }
    return s;
  }

  function setResolution(dpr) { res = Math.min(3, Math.max(2, Math.round(dpr * 1.6 * 2) / 2)); }

  // Once per rendered frame with the frame's dt: springs, blinking, gaze, expression, landings.
  function update(W, dt) {
    const c = Dangle.config;
    const P = Dangle.Player;
    for (const p of W.players) {
      if (p.dead) continue;
      const s = state(p);
      const vx = P.velX(p.head), vy = P.velY(p.head);
      // Landing: a sharp stop in falling speed while standing on something = squash + dust.
      const impact = s.prevVy - vy;
      if (s.prevVy > 380 && impact > 320 && Dangle.Hazards.grounded(W, p)) {
        s.qv += Math.min(4.2, impact / 240);
        if (Dangle.Fx) Dangle.Fx.land(p.head.position.x, p.head.position.y + c.HEAD_RADIUS, impact);
      }
      s.prevVy = vy;
      // Squash spring (stable in small substeps whatever the frame rate).
      for (let t = dt; t > 0; t -= 1 / 240) {
        const h = Math.min(t, 1 / 240);
        s.qv += (-320 * s.q - 16 * s.qv) * h;
        s.q += s.qv * h;
      }
      s.q = Math.max(-0.25, Math.min(0.35, s.q));
      // Gaze: aim, else the gripping hand, else a nearby partner, else where we're going.
      let lx = 0.35, ly = 0.25;
      const sp = Math.hypot(vx, vy);
      if (p.aim.m > 0) { lx = p.aim.dx; ly = p.aim.dy; }
      else if (p.grab[0].pin || p.grab[1].pin) {
        const h = p.grab[0].pin ? p.hands[0] : p.hands[1];
        const dx = h.position.x - p.head.position.x, dy = h.position.y - p.head.position.y, d = Math.hypot(dx, dy) || 1;
        lx = dx / d; ly = dy / d;
      } else {
        const q = W.players.find((o) => o !== p && !o.dead);
        const dx = q ? q.head.position.x - p.head.position.x : 0, dy = q ? q.head.position.y - p.head.position.y : 0;
        const d = Math.hypot(dx, dy);
        if (q && d < 6 * c.REACH && d > 1) { lx = dx / d; ly = dy / d; }
        else if (sp > 150) { lx = vx / sp; ly = vy / sp; }
      }
      const k = 1 - Math.exp(-12 * dt);
      s.lookX += (lx - s.lookX) * k;
      s.lookY += (ly - s.lookY) * k;
      // Blink every few seconds.
      s.blinkT -= dt;
      if (s.blinkT <= 0) { s.blink = 0.14; s.blinkT = 2.2 + ((p.index * 7 + W.time * 13) % 3); }
      if (s.blink > 0) s.blink = Math.max(0, s.blink - dt);
      // Expression.
      const gripping = !!(p.grab[0].pin || p.grab[1].pin);
      const stretch = Math.max(p.stretch[0], p.stretch[1]);
      if (W.level && W.level.complete) s.face = 'win';
      else if (p.popT > 0) s.face = 'pop';
      else if (!gripping && vy > 520) s.face = 'fall';
      else if (gripping && (stretch > 0.8 || p.aim.m > 0.7)) s.face = 'strain';
      else if (gripping) s.face = 'grab';
      else s.face = 'idle';
    }
  }

  // Tapered arm along a quadratic curve that sags a little when slack.
  function drawArm(ctx, hx, hy, gx, gy, stretch, ch, r) {
    let dx = gx - hx, dy = gy - hy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const sx = hx + dx * r * 0.55, sy = hy + dy * r * 0.55;         // shoulder: inside the head edge
    const ex = gx - dx * 8, ey = gy - dy * 8;                        // wrist: under the cuff
    let nx = -dy, ny = dx;
    if (ny < 0) { nx = -nx; ny = -ny; }                              // sag downward
    const bow = (1 - stretch) * Math.min(20, len * 0.28);
    const cx = (sx + ex) / 2 + nx * bow, cy = (sy + ey) / 2 + ny * bow;
    const w0 = 6.2 * (1 - 0.4 * stretch), w1 = 4.2 * (1 - 0.3 * stretch);
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const px = u * u * sx + 2 * u * t * cx + t * t * ex;
      const py = u * u * sy + 2 * u * t * cy + t * t * ey;
      const tx = 2 * u * (cx - sx) + 2 * t * (ex - cx), ty = 2 * u * (cy - sy) + 2 * t * (ey - cy);
      const tl = Math.hypot(tx, ty) || 1;
      const w = w0 + (w1 - w0) * t;
      edge[2 * i] = px - ty / tl * w; edge[2 * i + 1] = py + tx / tl * w;
      edge[42 - 2 * i] = px + ty / tl * w; edge[43 - 2 * i] = py - tx / tl * w;
    }
    ctx.beginPath();
    ctx.moveTo(edge[0], edge[1]);
    for (let i = 2; i < 44; i += 2) ctx.lineTo(edge[i], edge[i + 1]);
    ctx.closePath();
    ctx.fillStyle = ch.arm;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ch.dark;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function eye(ctx, x, y, s, look, face) {
    if (face === 'win') {
      ctx.beginPath(); ctx.moveTo(x - 5, y + 1); ctx.quadraticCurveTo(x, y - 7, x + 5, y + 1); ctx.stroke();
      return;
    }
    const open = s.blink > 0 ? 0.12 : face === 'strain' ? 0.55 : 1;
    const big = face === 'fall' || face === 'pop' ? 1.2 : 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(x, y, 6.4 * big, 7.4 * big * open, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.6; ctx.stroke();
    if (open > 0.3) {
      const pr = face === 'fall' || face === 'pop' ? 2.4 : 3.4;
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x + look.x * 2.6, y + look.y * 2.8 * open, pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  const look = { x: 0, y: 0 };
  function drawFace(ctx, s, tilt, r) {
    const cs = Math.cos(-tilt), sn = Math.sin(-tilt);
    look.x = s.lookX * cs - s.lookY * sn;
    look.y = s.lookX * sn + s.lookY * cs;
    const f = s.face;
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ex = r * 0.34, ey = -r * 0.14;
    eye(ctx, -ex, ey, s, look, f);
    eye(ctx, ex, ey, s, look, f);
    ctx.lineWidth = 2.6;
    // Brows only when they say something.
    if (f === 'strain' || f === 'grab' || f === 'fall' || f === 'pop') {
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const x = side * ex, y = ey - 10;
        if (f === 'strain') { ctx.moveTo(x - side * 6, y - 3); ctx.lineTo(x + side * 5, y + 2); }
        else if (f === 'grab') { ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); }
        else { ctx.moveTo(x - 5, y - 2); ctx.quadraticCurveTo(x, y - 7, x + 5, y - 2); }
      }
      ctx.stroke();
    }
    // Mouth.
    const my = r * 0.36;
    ctx.beginPath();
    if (f === 'win') {
      ctx.moveTo(-8, my - 3); ctx.quadraticCurveTo(0, my + 10, 8, my - 3); ctx.closePath();
      ctx.fillStyle = INK; ctx.fill();
      ctx.fillStyle = '#f07f8a'; ctx.beginPath(); ctx.ellipse(0, my + 3, 3.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (f === 'fall' || f === 'pop') {
      ctx.ellipse(0, my + 1, 3.6, 4.6, 0, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    } else if (f === 'strain') {
      ctx.rect(-7, my - 3, 14, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, my + 0.5); ctx.lineTo(7, my + 0.5); ctx.moveTo(-2.3, my - 3); ctx.lineTo(-2.3, my + 4); ctx.moveTo(2.3, my - 3); ctx.lineTo(2.3, my + 4);
      ctx.lineWidth = 1.2; ctx.stroke();
    } else if (f === 'grab') {
      ctx.moveTo(-5, my + 1); ctx.quadraticCurveTo(0, my + 3, 5, my); ctx.lineWidth = 2.4; ctx.stroke();
    } else {
      ctx.moveTo(-6, my - 1); ctx.quadraticCurveTo(0, my + 5, 6, my - 1); ctx.lineWidth = 2.4; ctx.stroke();
    }
  }

  function drawPlayer(ctx, W, p, alpha) {
    const c = Dangle.config;
    const ch = charOf(p);
    const s = state(p);
    const r = Dangle.CharArt.visualR();
    Dangle.World.pose(p.head, alpha, ph);
    Dangle.World.pose(p.hands[0], alpha, hp[0]);
    Dangle.World.pose(p.hands[1], alpha, hp[1]);

    let pop = 1;
    if (p.popT > 0) { const t = 1 - p.popT / 0.4; pop = t < 0.6 ? 0.3 + t / 0.6 * 0.9 : 1.2 - (t - 0.6) / 0.4 * 0.2; }

    // Grip glow under everything.
    for (let i = 0; i < 2; i++) {
      if (!p.grab[i].pin) continue;
      ctx.fillStyle = i === 0 ? 'rgba(74,143,224,0.28)' : 'rgba(232,84,74,0.28)';
      ctx.beginPath(); ctx.arc(hp[i].x, hp[i].y, c.HAND_RADIUS + 9 + Math.sin(W.time * 9) * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 2; i++) drawArm(ctx, ph.x, ph.y, hp[i].x, hp[i].y, p.stretch[i], ch, r);

    // Head: landing squash (bottom stays put), stretch along the velocity, cosmetic tilt, respawn pop.
    const vx = Dangle.Player.velX(p.head), vy = Dangle.Player.velY(p.head);
    const sp = Math.hypot(vx, vy);
    const e = Math.min(0.1, sp / 8000);
    const tilt = p.tiltPrev + (p.tilt - p.tiltPrev) * alpha;
    const hs = Dangle.CharArt.headSprite(ch, res);
    ctx.save();
    ctx.translate(ph.x, ph.y + s.q * r * 0.8);
    ctx.scale(pop * (1 + s.q * 0.8), pop * (1 - s.q));
    if (e > 0.01) {
      const a = Math.atan2(vy, vx);
      ctx.rotate(a); ctx.scale(1 + e, 1 - e * 0.7); ctx.rotate(-a);
    }
    ctx.rotate(tilt);
    ctx.drawImage(hs.canvas, -hs.ox, -hs.oy, hs.w, hs.h);
    drawFace(ctx, s, tilt, r);
    ctx.restore();

    // Gloves, thumbs kept up whichever way the arm points.
    for (let i = 0; i < 2; i++) {
      const g = Dangle.CharArt.gloveSprite(i, !!p.grab[i].pin, res);
      const a = Math.atan2(hp[i].y - ph.y, hp[i].x - ph.x);
      ctx.save();
      ctx.translate(hp[i].x, hp[i].y);
      ctx.rotate(a);
      if (Math.cos(a) < 0) ctx.scale(1, -1);
      ctx.scale(pop, pop);
      ctx.drawImage(g.canvas, -g.ox, -g.oy, g.w, g.h);
      ctx.restore();
    }
  }

  function draw(ctx, W, alpha) {
    for (const p of W.players) if (!p.dead) drawPlayer(ctx, W, p, alpha);
  }

  function faceOf(p) { const s = fx.get(p); return s ? s.face : 'idle'; }

  // ---- puppets: the same character art without physics (title, menus, character select) ----------
  function newPuppet(seed) { return { lookX: 0.4, lookY: 0.3, blinkT: 1 + (seed % 3), blink: 0, face: 'idle', q: 0 }; }
  function puppetUpdate(s, dt) {
    s.blinkT -= dt;
    if (s.blinkT <= 0) { s.blink = 0.14; s.blinkT = 2 + Math.random() * 2.5; }
    if (s.blink > 0) s.blink = Math.max(0, s.blink - dt);
  }
  // opts: scale, tilt, stretch (0..1 arm tension), hands [{x,y},{x,y}] (world/screen coords like x,y).
  function drawPuppet(ctx, ch, s, x, y, hands, opts) {
    opts = opts || {};
    const r = Dangle.CharArt.visualR();
    const sc = opts.scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    if (hands) for (let i = 0; i < 2; i++) drawArm(ctx, 0, 0, hands[i].x, hands[i].y, opts.stretch || 0, ch, r);
    ctx.save();
    ctx.rotate(opts.tilt || 0);
    const hs = Dangle.CharArt.headSprite(ch, Math.max(res, 3));
    ctx.drawImage(hs.canvas, -hs.ox, -hs.oy, hs.w, hs.h);
    drawFace(ctx, s, opts.tilt || 0, r);
    ctx.restore();
    if (hands) {
      for (let i = 0; i < 2; i++) {
        const g = Dangle.CharArt.gloveSprite(i, !!opts.closed, Math.max(res, 3));
        const a = Math.atan2(hands[i].y, hands[i].x);
        ctx.save();
        ctx.translate(hands[i].x, hands[i].y);
        ctx.rotate(a);
        if (Math.cos(a) < 0) ctx.scale(1, -1);
        ctx.drawImage(g.canvas, -g.ox, -g.oy, g.w, g.h);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  Dangle.DrawPlayer = { update, draw, setResolution, faceOf, newPuppet, puppetUpdate, drawPuppet };
})();
