// How often can ONE player cross a chain gap by swinging off the near lip? (evidence for config.LINT.CHAIN_MIN)
// Hangs from the lip, pumps, lets go on one of 80 release timings, catches the far lip. Used by coop-bots.js --probe.
//   node tools/coop-solo-swing.js [widthInREACH]
const B = require('./bots.js');
const { D, set, vx, vy, speed } = B;

function attempt(w, relX, relV, relVy) {
  const def = { id: 'sw', name: 'sw', theme: 'meadow', direction: 'right', coop: true, seed: 1, segments: [['start', { len: 4 }], ['gap', { w, aid: 'chain', land: 3 }], ['goal', {}]] };
  const spec = D.Levels.compile(def); const W = D.Level.load(spec, 1); const a = W.players[0]; const g = spec.gaps[0];
  a.spawn = { x: g.x0 - 14, y: -27 }; D.Player.respawn(W, a);
  for (let i = 0; i < 60; i++) D.World.step(W);
  let ph = 'grip', ok = false;
  for (let i = 0; i < 25 * 120 && !ok; i++) {
    const H = a.head;
    if (ph === 'grip') { set(a, 0.2, 0.45, false, true); if (a.grab[1].pin) ph = 'pump'; }
    else if (ph === 'pump') {
      const hand = a.hands[1], v = speed(H);
      const dx = hand.position.x - H.position.x, dy = hand.position.y - H.position.y, d = Math.hypot(dx, dy) || 1;
      if (v < 30) set(a, -1, 0, false, true);
      else { const ax = -vx(H) / v + dx / d, ay = -vy(H) / v + dy / d, m = Math.hypot(ax, ay) || 1; set(a, ax / m, ay / m, false, true); }
      if (i > 120 && H.position.x > g.x0 + relX && vx(H) > relV && vy(H) < relVy) ph = 'fly';
    } else if (ph === 'fly') {
      set(a, 1, -0.3, a.hands[0].position.x > g.x1 - 25, a.hands[1].position.x > g.x1 - 25);
      if (a.grab[0].pin || a.grab[1].pin) ph = 'mantle';
    } else { set(a, -0.7, 0.7, a.grab[0].pin, a.grab[1].pin); if (!a.grab[0].pin && !a.grab[1].pin) ph = 'fly'; }
    D.World.step(W);
    if (a.dead || H.position.y > 300) break;
    if (H.position.x > g.x1 + 20 && H.position.y < -10) ok = true;
  }
  D.Level.unload(W);
  return ok;
}

function successes(w) {
  let n = 0;
  for (const relX of [0, 30, 60, 90, 120]) for (const relV of [100, 250, 400, 550]) for (const relVy of [-300, -100, 50, 200]) if (attempt(w, relX, relV, relVy)) n++;
  return n;
}

module.exports = { successes };
if (require.main === module) {
  const w = +process.argv[2] || 2;
  console.log(`solo lip swing across ${w}R: ${successes(w)} of 80 release timings`);
}
