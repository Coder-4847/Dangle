// Dynamic world objects: moving platforms and crates (cached crayon sprites drawn at their
// interpolated pose) and ropes (a soft two-tone crayon line through the segments).
// Static geometry is pre-rendered by level-layer.js.
window.Dangle = window.Dangle || {};

(function () {
  const pose = { x: 0, y: 0, a: 0 };
  const pts = new Float32Array(64);

  function drawRope(ctx, r, alpha, t) {
    const n = Math.min(r.bodies.length, 30);
    pts[0] = r.anchor.x; pts[1] = r.anchor.y;
    for (let i = 0; i < n; i++) {
      Dangle.World.pose(r.bodies[i], alpha, pose);
      pts[2 * i + 2] = pose.x; pts[2 * i + 3] = pose.y;
    }
    // Smooth curve through the segment midpoints.
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < n; i++) {
      const mx = (pts[2 * i] + pts[2 * i + 2]) / 2, my = (pts[2 * i + 1] + pts[2 * i + 3]) / 2;
      ctx.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], mx, my);
    }
    ctx.lineTo(pts[2 * n], pts[2 * n + 1]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = Dangle.Crayon.shade(t.post, -0.25); ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = t.post; ctx.lineWidth = 6.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
    // Knot at the tail, peg at the pivot.
    ctx.fillStyle = t.post;
    ctx.beginPath(); ctx.arc(pts[2 * n], pts[2 * n + 1], 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Dangle.Crayon.shade(t.post, -0.35);
    ctx.beginPath(); ctx.arc(r.anchor.x, r.anchor.y, 9, 0, Math.PI * 2); ctx.fill();
  }

  function sprite(ctx, b, alpha, layer) {
    const s = Dangle.LevelLayer.spriteFor(layer, b);
    Dangle.World.pose(b, alpha, pose);
    ctx.save();
    ctx.translate(pose.x, pose.y);
    if (pose.a) ctx.rotate(pose.a);
    ctx.drawImage(s.canvas, -b.dg.size.w / 2 - s.pad, -b.dg.size.h / 2 - s.pad, s.w, s.h);
    ctx.restore();
  }

  // Co-op gates and lifts slide into the ground: drawn BEFORE the static level layer, so the ground hides them.
  function devices(ctx, W, alpha, layer) {
    if (!W.level) return;
    for (const d of W.level.devices) sprite(ctx, d.body, alpha, layer);
  }

  function draw(ctx, W, alpha, layer) {
    for (const b of W.drawables) {
      if (b.dg.kind !== 'crate' && !b.dg.mover) continue;
      if (b.dg.mover && b.dg.mover.driven && !b.dg.heavy) continue;     // devices(): behind the ground
      const s = Dangle.LevelLayer.spriteFor(layer, b);
      Dangle.World.pose(b, alpha, pose);
      ctx.save();
      ctx.translate(pose.x, pose.y);
      if (pose.a) ctx.rotate(pose.a);
      ctx.drawImage(s.canvas, -b.dg.size.w / 2 - s.pad, -b.dg.size.h / 2 - s.pad, s.w, s.h);
      ctx.restore();
    }
    if (W.ropes) for (const r of W.ropes) drawRope(ctx, r, alpha, layer.theme);
  }

  Dangle.DrawWorld = { draw, devices };
})();
