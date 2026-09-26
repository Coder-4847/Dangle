// Camera: follows the players with lookahead, frames both in co-op (zoom clamped, arrows for
// anyone off-screen), stays inside the level, and opens with a pan from the goal back to the
// start. Runs in render time with exponential smoothing, so it is identical at any refresh rate.
window.Dangle = window.Dangle || {};

(function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const cam = { x: 0, y: 0, scale: 1, ready: false, lookX: 0, lookY: 0, introT: 0, introOn: false, level: null };
  const goal = { x: 0, y: 0, scale: 1 };
  const arrows = [];   // off-screen players, for the HUD: {index, x, y, angle}

  // level: { bounds: {minX,maxX,minY,maxY}, goal: {x,y,w,h}, direction } or null (no limits, no intro)
  function setLevel(level) {
    cam.level = level;
    cam.ready = false;
    cam.lookX = cam.lookY = 0;
    cam.introT = 0;
    cam.introOn = !!(level && level.goal);
  }

  // Ideal framing for the targets: {x, y, scale}. Bigger spread = more zoom out, up to the cap.
  function fit(targets, viewW, viewH, out) {
    const c = Dangle.config;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of targets) {
      if (t.x < minX) minX = t.x; if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y; if (t.y > maxY) maxY = t.y;
    }
    const needW = clamp(maxX - minX + c.CAM_MARGIN * 2, c.CAM_MIN_W, c.CAM_MAX_W);
    const needH = clamp(maxY - minY + c.CAM_MARGIN * 2, c.CAM_MIN_H, c.CAM_MAX_H);
    out.x = (minX + maxX) / 2;
    out.y = (minY + maxY) / 2;
    out.scale = Math.min(viewW / needW, viewH / needH);
    return out;
  }

  // Keep the view inside the level; a level smaller than the view is centred.
  function clampToBounds(p, viewW, viewH) {
    const b = cam.level && cam.level.bounds;
    if (!b) return p;
    const hw = viewW / (2 * p.scale);
    const hh = viewH / (2 * p.scale);
    p.x = b.maxX - b.minX <= 2 * hw ? (b.minX + b.maxX) / 2 : clamp(p.x, b.minX + hw, b.maxX - hw);
    p.y = b.maxY - b.minY <= 2 * hh ? (b.minY + b.maxY) / 2 : clamp(p.y, b.minY + hh, b.maxY - hh);
    return p;
  }

  const want = { x: 0, y: 0, scale: 1 };
  const from = { x: 0, y: 0, scale: 1 };

  // targets: [{index, x, y, vx, vy}] (alive players, interpolated). skipIntro: any player input.
  function update(dt, targets, viewW, viewH, skipIntro) {
    const c = Dangle.config;
    if (!targets.length) return;
    fit(targets, viewW, viewH, want);

    // Lookahead leads the motion along the level's direction of travel; smoothed slowly.
    let vx = 0, vy = 0;
    for (const t of targets) { vx += t.vx; vy += t.vy; }
    vx /= targets.length; vy /= targets.length;
    const up = cam.level && cam.level.direction === 'up';
    const tx = up ? 0 : clamp(vx * 0.3, -c.CAM_LOOKAHEAD, c.CAM_LOOKAHEAD);
    const ty = up ? clamp(vy * 0.3, -c.CAM_LOOKAHEAD, c.CAM_LOOKAHEAD) : clamp(vy * 0.1, -c.CAM_LOOKAHEAD / 3, c.CAM_LOOKAHEAD / 3);
    const kl = 1 - Math.exp(-c.CAM_LOOK_SMOOTH * dt);
    cam.lookX += (tx - cam.lookX) * kl;
    cam.lookY += (ty - cam.lookY) * kl;
    want.x += cam.lookX;
    want.y += cam.lookY;
    clampToBounds(want, viewW, viewH);

    if (cam.introOn) {
      if (skipIntro && cam.introT > 0.5) cam.introT = c.CAM_INTRO_HOLD + c.CAM_INTRO_PAN;
      cam.introT += dt;
      const u = (cam.introT - c.CAM_INTRO_HOLD) / c.CAM_INTRO_PAN;
      const g = cam.level.goal;
      goal.x = g.x + g.w / 2; goal.y = g.y + g.h / 2; goal.scale = want.scale * 0.8;
      clampToBounds(goal, viewW, viewH);
      if (u >= 1) { cam.introOn = false; cam.x = want.x; cam.y = want.y; cam.scale = want.scale; }
      else {
        const e = u <= 0 ? 0 : u * u * (3 - 2 * u);
        cam.x = goal.x + (want.x - goal.x) * e;
        cam.y = goal.y + (want.y - goal.y) * e;
        cam.scale = goal.scale + (want.scale - goal.scale) * e;
        cam.ready = true;
      }
    } else if (!cam.ready) {
      cam.x = want.x; cam.y = want.y; cam.scale = want.scale; cam.ready = true;
    } else {
      const k = 1 - Math.exp(-c.CAM_SMOOTH * dt);
      cam.x += (want.x - cam.x) * k;
      cam.y += (want.y - cam.y) * k;
      cam.scale += (want.scale - cam.scale) * k;
    }

    // Anyone the zoom limit couldn't fit gets an arrow at the screen edge.
    arrows.length = 0;
    const inset = 44;
    for (const t of targets) {
      const sx = viewW / 2 + (t.x - cam.x) * cam.scale;
      const sy = viewH / 2 + (t.y - cam.y) * cam.scale;
      if (sx >= inset && sx <= viewW - inset && sy >= inset && sy <= viewH - inset) continue;
      const ang = Math.atan2(sy - viewH / 2, sx - viewW / 2);
      arrows.push({ index: t.index, x: clamp(sx, inset, viewW - inset), y: clamp(sy, inset, viewH - inset), angle: ang });
    }
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

  function reset() { setLevel(cam.level); }

  Dangle.Camera = { cam, arrows, setLevel, update, apply, worldToScreen, reset, fit, clampToBounds };
})();
