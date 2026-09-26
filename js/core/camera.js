// Smooth follow camera that frames all targets. Works in render time with exponential
// smoothing, so it is identical at any refresh rate. (Phase 3 adds bounds/lookahead.)
window.Dangle = window.Dangle || {};

(function () {
  const cam = { x: 0, y: 0, scale: 1, ready: false };

  function fit(targets, viewW, viewH) {
    const c = Dangle.config;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of targets) {
      minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
    }
    const needW = Math.max(c.CAM_MIN_W, maxX - minX + c.CAM_MARGIN * 2);
    const needH = Math.max(c.CAM_MIN_H, maxY - minY + c.CAM_MARGIN * 2);
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      scale: Math.min(viewW / needW, viewH / needH),
    };
  }

  function update(dt, targets, viewW, viewH) {
    if (!targets.length) return;
    const goal = fit(targets, viewW, viewH);
    if (!cam.ready) { cam.x = goal.x; cam.y = goal.y; cam.scale = goal.scale; cam.ready = true; return; }
    const k = 1 - Math.exp(-Dangle.config.CAM_SMOOTH * dt);
    cam.x += (goal.x - cam.x) * k;
    cam.y += (goal.y - cam.y) * k;
    cam.scale += (goal.scale - cam.scale) * k;
  }

  // Set the 2D context so world coordinates draw in the right place.
  function apply(ctx, viewW, viewH, dpr) {
    const s = cam.scale * dpr;
    ctx.setTransform(s, 0, 0, s, (viewW / 2 - cam.x * cam.scale) * dpr, (viewH / 2 - cam.y * cam.scale) * dpr);
  }

  function worldToScreen(x, y, viewW, viewH, out) {
    out.x = viewW / 2 + (x - cam.x) * cam.scale;
    out.y = viewH / 2 + (y - cam.y) * cam.scale;
    return out;
  }

  function reset() { cam.ready = false; }

  Dangle.Camera = { cam, update, apply, worldToScreen, reset };
})();
