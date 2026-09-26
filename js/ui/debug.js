// Debug overlay: FPS, physics cost, body/constraint counts and per-player grab state.
window.Dangle = window.Dangle || {};

(function () {
  let fps = 60;
  let stepMs = 0;

  function tick(dt, W) {
    fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05;
    stepMs += (W.stepMs - stepMs) * 0.05;
  }

  function draw(ctx, W, x, y) {
    const M = Matter;
    const lines = [
      `${fps.toFixed(0)} fps   physics ${stepMs.toFixed(2)} ms/step`,
      `bodies ${M.Composite.allBodies(W.mworld).length}   constraints ${M.Composite.allConstraints(W.mworld).length}`,
    ];
    if (W.level) {
      const L = W.level;
      const cam = Dangle.Camera.cam;
      lines.push(`${L.id}  checkpoint ${L.checkpoint + 1}/${L.spec.checkpoints.length}  t ${L.started ? (L.t - L.startT).toFixed(1) : '-'}s  ${L.complete ? 'COMPLETE' : ''}  cam x${cam.scale.toFixed(2)}`);
    }
    for (const p of W.players) {
      const sp = Math.hypot(Dangle.Player.velX(p.head), Dangle.Player.velY(p.head));
      if (p.dead) { lines.push(`P${p.index + 1}  dead, back in ${Math.max(0, p.deadT).toFixed(1)}s  (deaths ${p.deaths})`); continue; }
      lines.push(`P${p.index + 1}  L:${Dangle.Grab.describe(p.grab[0])}  R:${Dangle.Grab.describe(p.grab[1])}  speed ${sp.toFixed(0)}  arms ${p.stretch[0].toFixed(2)}/${p.stretch[1].toFixed(2)}  deaths ${p.deaths}`);
    }
    ctx.font = '12px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'top';
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
    ctx.fillStyle = 'rgba(30,30,40,0.72)';
    ctx.fillRect(x, y, w, lines.length * 16 + 10);
    ctx.fillStyle = '#f5ecd8';
    lines.forEach((l, i) => ctx.fillText(l, x + 8, y + 6 + i * 16));
  }

  Dangle.Debug = { tick, draw };
})();
