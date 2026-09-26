// Solvability evidence for the linter's gap limits: scripted players cross gaps at the limit.
//   node tools/gap-bots.js
// A bot is a deliberately simple player (no lookahead); if it can cross, a person can. If a limit in
// config.LINT is raised, this is where to check it. Plain gap: reach across, grab, mantle. Rope gap:
// grab the rope, let go on the forward swing, reach for the far edge, mantle.
const path = require('path');
global.window = global;
global.Matter = require('../js/lib/matter.min.js');
for (const f of ['config', 'core/loop', 'physics/world', 'physics/grab', 'physics/player', 'physics/surfaces', 'physics/hazards',
  'levels/builder', 'levels/segments', 'levels/levels', 'levels/themes', 'levels/loader']) require(path.join('..', 'js', f + '.js'));
const D = global.Dangle;
const cfg = D.config;
const vx = (b) => D.Player.velX(b);
const vy = (b) => D.Player.velY(b);

// Build a one-gap level and put a player at the edge of the gap.
function setup(gapOpts) {
  const def = { id: 'bot', name: 'bot', theme: 'meadow', direction: 'right', seed: 1, segments: [['start', {}], ['ledge', {}], ['gap', gapOpts], ['ledge', { len: 4 }], ['goal', {}]] };
  const spec = D.Levels.compile(def);
  const W = D.Level.load(spec, 1);
  const p = W.players[0];
  const g = spec.gaps[0];
  p.spawn = { x: g.x0 - 14, y: -27 };
  D.Player.respawn(W, p);
  for (let i = 0; i < 60; i++) D.World.step(W);
  return { W, p, g };
}

// Returns seconds to cross, or -1.
function plainBot(w) {
  const { W, p, g } = setup({ w });
  let phase = 'reach';
  for (let i = 0; i < 10 * 120; i++) {
    const t = i / 120;
    const hand = p.hands[1];
    const pinned = !!p.grab[1].pin;
    const inp = p.input;
    if (phase === 'reach') { inp.aimX = 1; inp.aimY = 0.14; inp.grab[1] = hand.position.x > g.x1 - 25; if (pinned) phase = 'pull'; }
    else if (phase === 'pull') { inp.aimX = -0.7; inp.aimY = 0.7; inp.grab[1] = true; if (!pinned && p.head.position.x < g.x0 - 30) phase = 'reach'; }
    D.World.step(W);
    if (p.dead) return -1;
    if (p.head.position.x > g.x1 + 30 && p.head.position.y > -40) return t;
  }
  return -1;
}

function ropeBot(w, relX, relMinSpeed) {
  const { W, p, g } = setup({ w, aid: 'rope' });
  let phase = 'grab';
  for (let i = 0; i < 25 * 120; i++) {
    const t = i / 120;
    const H = p.head;
    const hand = p.hands[1];
    const tgt = p.grab[1].pin && p.grab[1].target.dg.kind;
    const inp = p.input;
    if (phase === 'grab') { inp.aimX = 1; inp.aimY = 0; inp.grab[1] = true; if (tgt === 'ropeSeg') phase = 'pump'; }
    else if (phase === 'pump') {
      const v = Math.hypot(vx(H), vy(H));
      const dx = hand.position.x - H.position.x, dy = hand.position.y - H.position.y, d = Math.hypot(dx, dy) || 1;
      if (v < 30) { inp.aimX = 1; inp.aimY = 0; }
      else { const ax = -vx(H) / v + dx / d, ay = -vy(H) / v + dy / d, m = Math.hypot(ax, ay) || 1; inp.aimX = ax / m; inp.aimY = ay / m; }
      inp.grab[1] = true;
      if (H.position.x > g.x1 - relX && vx(H) > 0 && v > relMinSpeed && vy(H) < 50) { phase = 'fly'; inp.grab[1] = false; }
    } else if (phase === 'fly') {
      inp.aimX = 1; inp.aimY = 0.14; inp.grab[1] = hand.position.x > g.x1 - 25 && hand.position.y > -60;
      if (tgt && tgt !== 'ropeSeg') phase = 'mantle';
    } else if (phase === 'mantle') { inp.aimX = -0.7; inp.aimY = 0.7; inp.grab[1] = true; if (!p.grab[1].pin) phase = 'fly'; }
    D.World.step(W);
    if (p.dead) return -1;
    if (p.head.position.x > g.x1 + 30 && p.head.position.y > -40 && phase !== 'pump') return t;
  }
  return -1;
}

// Tries release points until one works (a player would feel for it too).
function ropeCross(w) {
  for (const relX of [40, 90, 140, 190, 240]) for (const ms of [200, 350, 500]) { const t = ropeBot(w, relX, ms); if (t > 0) return t; }
  return -1;
}

let fails = 0;
const R = cfg.REACH;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
const plainMax = cfg.LINT.GAP_PLAIN_MAX;
const ropeMax = cfg.LINT.GAP_ROPE_MAX;
for (const w of [0.6, 0.8, plainMax]) { const t = plainBot(w); check(t > 0, `plain gap ${w.toFixed(2)}R crossed${t > 0 ? ` in ${t.toFixed(1)} s` : ''}`); }
for (const w of [1.7, 1.85, ropeMax]) { const t = ropeCross(w); check(t > 0, `rope gap ${w.toFixed(2)}R crossed${t > 0 ? ` in ${t.toFixed(1)} s` : ''}`); }
console.log(`(info) plain 1.0R: ${plainBot(1.0) > 0 ? 'crossed' : 'not crossed'}, rope 2.4R: ${ropeCross(2.4) > 0 ? 'crossed' : 'not crossed'}`);
console.log(fails ? `${fails} failed` : 'gap limits verified');
process.exit(fails ? 1 : 0);
