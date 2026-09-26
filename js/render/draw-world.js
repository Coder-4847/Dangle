// Placeholder flat-color world drawing (Phase 4 replaces this with the crayon renderer).
window.Dangle = window.Dangle || {};

(function () {
  const COLORS = {
    ground: ['#8fc17e', '#4d7f4a'],
    crate: ['#d9a15c', '#8a5a2b'],
    noGrab: ['#454552', '#22222b'],
  };
  const pose = { x: 0, y: 0, a: 0 };

  function poly(ctx, b) {
    const v = b.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
  }

  function drawStatic(ctx, b) {
    const col = COLORS[b.dg.kind] || COLORS.ground;
    poly(ctx, b);
    ctx.fillStyle = col[0];
    ctx.fill();
    if (b.dg.kind === 'noGrab') {
      // Diagonal warning stripes tell the player "hands slide off this".
      ctx.save();
      poly(ctx, b);
      ctx.clip();
      ctx.strokeStyle = '#d9d2c0';
      ctx.lineWidth = 6;
      ctx.beginPath();
      const bb = b.bounds;
      for (let x = bb.min.x - (bb.max.y - bb.min.y); x < bb.max.x; x += 28) {
        ctx.moveTo(x, bb.max.y);
        ctx.lineTo(x + (bb.max.y - bb.min.y), bb.min.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    poly(ctx, b);
    ctx.lineWidth = 4;
    ctx.strokeStyle = col[1];
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawCrate(ctx, b, alpha) {
    Dangle.World.pose(b, alpha, pose);
    const s = b.dg.size.w;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.a);
    ctx.fillStyle = COLORS.crate[0];
    ctx.strokeStyle = COLORS.crate[1];
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.beginPath();
    ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2);
    ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawRope(ctx, r, alpha) {
    ctx.beginPath();
    ctx.moveTo(r.anchor.x, r.anchor.y);
    for (const b of r.bodies) {
      Dangle.World.pose(b, alpha, pose);
      ctx.lineTo(pose.x, pose.y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#6d4a2f';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = '#4a3220';
    ctx.beginPath();
    ctx.arc(r.anchor.x, r.anchor.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(ctx, W, alpha) {
    for (const b of W.drawables) {
      const k = b.dg.kind;
      if (k === 'head' || k === 'hand') continue;          // drawn by draw-player
      if (k === 'crate') drawCrate(ctx, b, alpha);
      else if (b.isStatic) drawStatic(ctx, b);
    }
    if (W.ropes) for (const r of W.ropes) drawRope(ctx, r, alpha);
  }

  Dangle.DrawWorld = { draw };
})();
