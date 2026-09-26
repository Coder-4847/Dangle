// Headless physics checks: node tools/sim-test.js [scenario]
// Runs the real physics files under node (no DOM) with scripted input.
const path = require('path');
global.window = global;
global.Matter = require('../js/lib/matter.min.js');
for (const f of ['config', 'physics/world', 'physics/grab', 'physics/player', 'physics/surfaces', 'levels/sandbox']) {
  require(path.join('..', 'js', f + '.js'));
}
const D = global.Dangle;
const cfg = D.config;

function stepFor(W, seconds, script) {
  const n = Math.round(seconds / cfg.STEP);
  for (let i = 0; i < n; i++) {
    if (script) script(i * cfg.STEP, i);
    D.World.step(W);
  }
}
const pos = (b) => `(${b.position.x.toFixed(0)},${b.position.y.toFixed(0)})`;
function setInput(p, ax, ay, l, r) { p.input.aimX = ax; p.input.aimY = ay; p.input.grab[0] = !!l; p.input.grab[1] = !!r; }

const scenarios = {
  // Standing still: head must settle and not jitter.
  rest() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    stepFor(W, 2);
    let maxMove = 0;
    let prev = { x: p.head.position.x, y: p.head.position.y };
    stepFor(W, 3, () => {
      maxMove = Math.max(maxMove, Math.hypot(p.head.position.x - prev.x, p.head.position.y - prev.y));
      prev = { x: p.head.position.x, y: p.head.position.y };
    });
    console.log('rest: head', pos(p.head), 'max per-step move (px):', maxMove.toFixed(4), 'stepMs', W.stepMs.toFixed(2));
  },
  // Grab the underside of the ledge, hang with neutral stick, then pull with the stick.
  hang() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    p.spawn = { x: 560, y: 570 }; D.Player.respawn(W, p);
    stepFor(W, 0.5);
    stepFor(W, 0.7, () => setInput(p, 0, -1, false, false));           // reach up first
    stepFor(W, 0.5, () => setInput(p, 0, -1, false, true));            // then grab right
    console.log('hang: grab state', D.Grab.describe(p.grab[1]), 'head', pos(p.head), 'hand', pos(p.hands[1]));
    stepFor(W, 2.0, () => setInput(p, 0, 0, false, true));             // neutral: hang
    const dist = Math.hypot(p.head.position.x - p.hands[1].position.x, p.head.position.y - p.hands[1].position.y);
    console.log('hang neutral: head', pos(p.head), 'arm len', dist.toFixed(1), 'state', D.Grab.describe(p.grab[1]), 'speed', Math.hypot(D.Player.velX(p.head), D.Player.velY(p.head)).toFixed(2));
    stepFor(W, 1.0, () => setInput(p, 0, 1, false, true));             // pull: stick away from anchor
    console.log('hang pull: head', pos(p.head), 'hand', pos(p.hands[1]));
    setInput(p, 0, 0, false, false);
    stepFor(W, 1.0);
    console.log('hang released: head', pos(p.head), 'state', D.Grab.describe(p.grab[1]));
  },
  // Scripted hand-over-hand climb of the tower's left face.
  climb() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    p.spawn = { x: 780, y: 570 }; D.Player.respawn(W, p);
    stepFor(W, 0.5);
    let cycle = 0;
    // Hand-over-hand: keep one hand pinned, reach the other higher, pull with both, swap.
    // First get any hand onto the wall.
    stepFor(W, 0.4, () => setInput(p, 0.6, -1, false, false));
    stepFor(W, 0.3, () => setInput(p, 0.6, -1, false, true));
    let pin = 1;
    for (; cycle < 16; cycle++) {
      const free = 1 - pin;
      let t = 0;
      const gr = (a, b) => [pin === 0 ? a : b, pin === 0 ? b : a];
      // reach: pinned hand holds, free hand goes up and grabs
      while (t < 1.0 && !p.grab[free].pin) {
        stepFor(W, 0.02, () => { const g = gr(true, t > 0.25); setInput(p, 0.5, -1, pin === 0 ? true : g[0], pin === 1 ? true : g[1]); });
        t += 0.02;
      }
      // pull with whatever is pinned
      stepFor(W, 0.35, () => setInput(p, -0.4, 1, !!p.grab[0].pin, !!p.grab[1].pin));
      console.log('cycle', cycle, 'pinned', D.Grab.describe(p.grab[0]) + '/' + D.Grab.describe(p.grab[1]), 'head', pos(p.head));
      // swap: let go of the lower hand
      const lower = p.hands[0].position.y > p.hands[1].position.y ? 0 : 1;
      p.input.grab[lower] = false;
      pin = 1 - lower;
      if (p.head.position.y < 230 && p.head.position.x > 830) break;
    }
    stepFor(W, 1.5);
    console.log('climb done: head', pos(p.head), 'respawns', p.respawns);
  },
  // Grab the rope from the plateau edge, pump it, and let go toward the far block.
  rope() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    p.spawn = { x: 1200, y: 224 }; D.Player.respawn(W, p);
    stepFor(W, 0.6);
    stepFor(W, 0.4, () => setInput(p, 1, 0.1, false, false));
    stepFor(W, 0.3, () => setInput(p, 1, 0.1, true, false));
    console.log('rope: grab', D.Grab.describe(p.grab[0]), 'head', pos(p.head), 'hand', pos(p.hands[0]));
    let maxX = 0, minX = 1e9, t = 0, released = false;
    for (let i = 0; i < 12 / cfg.STEP && !released; i++) {
      const vx = D.Player.velX(p.head);
      // pull opposite to the stick: stick against the swing direction to pump
      const ax = vx > 0 ? -1 : 1;
      const pump = t > 0.3;
      setInput(p, pump ? ax : 0, pump ? 0.2 : 0, true, false);
      D.World.step(W); t += cfg.STEP;
      maxX = Math.max(maxX, p.head.position.x); minX = Math.min(minX, p.head.position.x);
      if (i % 120 === 0) console.log(' t', t.toFixed(1), 'head', pos(p.head), 'vx', vx.toFixed(0), 'arm', (p.stretch[0]).toFixed(2));
      if (p.head.position.x > 1440 && vx > 0 && p.head.position.y < 250) { released = true; }
    }
    console.log('swing x range', minX.toFixed(0), maxX.toFixed(0), released ? 'released' : 'never got there');
    setInput(p, 0, 0, false, false);
    stepFor(W, 1.5);
    console.log('after release: head', pos(p.head), 'respawns', p.respawns);
  },
  // Two players chained on a rope in open space: P1 holds the rope, P2 holds P1.
  chain() {
    const W = D.World.create();
    D.Surfaces.block(W, -2000, 1000, 4000, 100, 'ground');
    D.Surfaces.rope(W, 0, 0, 10, 33, 1.2);
    const look = { head: '#fa0', dark: '#a50' };
    const a = D.Player.create(W, 0, -38, 200, look);
    const b = D.Player.create(W, 1, 300, 800, look);
    stepFor(W, 0.3, () => setInput(a, 0, -1, false, false));
    stepFor(W, 0.2, () => setInput(a, 0, -1, false, true));
    stepFor(W, 2.0, () => setInput(a, 0, 0, false, true));
    console.log('P1 hanging: head', pos(a.head), D.Grab.describe(a.grab[0]), D.Grab.describe(a.grab[1]), 'arm', a.stretch.map((x) => x.toFixed(2)).join('/'));
    b.spawn = { x: a.head.position.x, y: a.head.position.y + 100 }; D.Player.respawn(W, b);
    stepFor(W, 0.15, () => { setInput(a, 0, 0, false, true); setInput(b, 0, -1, false, false); });
    stepFor(W, 0.3, () => { setInput(a, 0, 0, false, true); setInput(b, 0, -1, true, true); });
    console.log('P2 grab', D.Grab.describe(b.grab[0]), D.Grab.describe(b.grab[1]), 'target', b.grab[0].target && b.grab[0].target.dg.kind);
    const r0 = a.respawns + b.respawns;
    let maxV = 0;
    const rope = W.ropes[0];
    for (let i = 0; i < 8 / cfg.STEP; i++) {
      const t = i * cfg.STEP;
      // pump a swing after 2 s: P1 pulls against its swing direction
      const ax = t > 2 ? (D.Player.velX(a.head) > 0 ? -1 : 1) : 0;
      setInput(a, ax, 0.2 * Math.abs(ax), false, true); setInput(b, 0, 0, true, true);
      D.World.step(W);
      maxV = Math.max(maxV, Math.hypot(D.Player.velX(b.head), D.Player.velY(b.head)));
      if (i % 120 === 0) {
        const last = rope.bodies[rope.bodies.length - 1];
        console.log(' t', t.toFixed(0), 'P1', pos(a.head), 'P2', pos(b.head), 'gap', Math.hypot(a.head.position.x - b.head.position.x, a.head.position.y - b.head.position.y).toFixed(0), 'v2', Math.hypot(D.Player.velX(b.head), D.Player.velY(b.head)).toFixed(0), 'ropeTip', pos(last));
      }
    }
    console.log('chain maxV P2', maxV.toFixed(0), 'respawns during', a.respawns + b.respawns - r0, 'stepMs', W.stepMs.toFixed(2));
  },
  // Hands must slide off the no-grab wall and never pin to it.
  nograb() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    p.spawn = { x: 2040, y: 300 }; D.Player.respawn(W, p);   // falls alongside the wall face
    const kinds = new Set();
    stepFor(W, 0.45, () => { setInput(p, 1, 0, true, true); for (const g of p.grab) if (g.pin) kinds.add(g.target.dg.kind); });
    console.log('nograb: head', pos(p.head), 'hand', pos(p.hands[1]), 'pinned kinds', [...kinds].join(',') || 'none (correct)');
  },

  // Pull up the wall then release: how fast can a heave fling the head?
  fling() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    p.spawn = { x: 770, y: 570 }; D.Player.respawn(W, p);
    stepFor(W, 0.4);
    stepFor(W, 0.5, () => setInput(p, 0.9, -0.3, false, false));
    stepFor(W, 0.2, () => setInput(p, 0.9, -0.3, true, true));
    let best = 0, bestAt = 0;
    for (let i = 0; i < 0.9 / cfg.STEP; i++) {
      setInput(p, -0.8, 0.6, !!p.grab[0].pin, !!p.grab[1].pin);
      D.World.step(W);
      const v = Math.hypot(D.Player.velX(p.head), D.Player.velY(p.head));
      if (v > best) { best = v; bestAt = i * cfg.STEP; }
    }
    console.log('fling: peak head speed while pulling', best.toFixed(0), 'px/s at', bestAt.toFixed(2), 's; head', pos(p.head));
    setInput(p, 0, 0, false, false);
    const v0 = Math.hypot(D.Player.velX(p.head), D.Player.velY(p.head));
    stepFor(W, 0.05);
    const v1 = Math.hypot(D.Player.velX(p.head), D.Player.velY(p.head));
    console.log('speed just before/after release', v0.toFixed(0), v1.toFixed(0), '(momentum kept)');
  },

  // Falling into the pit respawns at spawn.
  pit() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    p.spawn = { x: 1360, y: 400 }; D.Player.respawn(W, p); p.spawn = { x: 120, y: 560 };
    stepFor(W, 4);
    console.log('pit: respawns', p.respawns - 1, 'head', pos(p.head));
  },

  // Grab and drag the crate, then throw it.
  crate() {
    const W = D.Sandbox.build(1);
    const p = W.players[0];
    p.spawn = { x: 250, y: 570 }; D.Player.respawn(W, p);
    stepFor(W, 0.5);
    stepFor(W, 0.5, () => setInput(p, 1, -0.25, false, false));
    stepFor(W, 0.3, () => setInput(p, 1, -0.25, false, true));
    console.log('crate: grab', D.Grab.describe(p.grab[1]));
    const crate = W.drawables.find((b) => b.dg.kind === 'crate');
    const x0 = crate.position.x;
    stepFor(W, 1.2, () => setInput(p, -1, 0, false, true));
    console.log('crate moved', (crate.position.x - x0).toFixed(0), 'px toward player; head', pos(p.head), 'respawns', p.respawns - 1);
  },

  // Random button mashing by two players for a minute: nothing may go NaN, explode or respawn-loop.
  fuzz() {
    const W = D.Sandbox.build(2);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let maxSpeed = 0, maxStep = 0, bad = 0, sumStep = 0, n = 0; const steps = [];
    const state = W.players.map(() => ({ ax: 0, ay: 0, l: false, r: false, t: 0 }));
    for (let i = 0; i < 60 / cfg.STEP; i++) {
      W.players.forEach((p, k) => {
        const st = state[k];
        st.t -= cfg.STEP;
        if (st.t <= 0) {
          st.t = 0.1 + rnd() * 0.5;
          const ang = rnd() * Math.PI * 2, m = rnd() < 0.2 ? 0 : 1;
          st.ax = Math.cos(ang) * m; st.ay = Math.sin(ang) * m;
          st.l = rnd() < 0.5; st.r = rnd() < 0.5;
        }
        setInput(p, st.ax, st.ay, st.l, st.r);
      });
      D.World.step(W);
      maxStep = Math.max(maxStep, W.stepMs); sumStep += W.stepMs; n++; steps.push(W.stepMs);
      for (const p of W.players) for (const b of p.bodies) {
        if (!isFinite(b.position.x) || !isFinite(b.position.y)) bad++;
        maxSpeed = Math.max(maxSpeed, Math.hypot(D.Player.velX(b), D.Player.velY(b)));
      }
    }
    console.log('fuzz: NaN count', bad, 'max speed', maxSpeed.toFixed(0), 'step ms avg', (sumStep / n).toFixed(3), 'p99', steps.sort((a, b) => a - b)[Math.floor(n * 0.99)].toFixed(3), 'max', maxStep.toFixed(2), 'respawns', W.players.map((p) => p.respawns).join('/'), 'heads', W.players.map((p) => pos(p.head)).join(' '));
  },
  // Frame-rate independence: the loop must run ~the same number of fixed steps per second at any refresh rate.
  loop() {
    require(path.join('..', 'js', 'core', 'loop.js'));
    const results = [];
    for (const [label, dtFn] of [
      ['30 Hz', () => 1 / 30], ['60 Hz', () => 1 / 60], ['144 Hz', () => 1 / 144], ['240 Hz', () => 1 / 240],
      ['jittery 20-120 Hz', (() => { let s = 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return 1 / (20 + (s / 4294967296) * 100); }; })()],
    ]) {
      let now = 0, cb = null, steps = 0, renders = 0, maxAlpha = 0, minAlpha = 1;
      global.performance = { now: () => now * 1000 };
      global.requestAnimationFrame = (f) => { cb = f; return 1; };
      global.cancelAnimationFrame = () => {};
      D.Loop.start({ frame() {}, step() { steps++; }, render(alpha) { renders++; maxAlpha = Math.max(maxAlpha, alpha); minAlpha = Math.min(minAlpha, alpha); } });
      while (now < 10) { now += dtFn(); const f = cb; cb = null; f(now * 1000); }
      results.push(`${label}: ${steps} steps in 10 s (ideal ${Math.round(10 / cfg.STEP)}), alpha ${minAlpha.toFixed(2)}..${maxAlpha.toFixed(2)}`);
    }
    console.log('loop:\n  ' + results.join('\n  '));
    global.performance = require('perf_hooks').performance;
  },
  // Both players grab each other's heads with both hands, then thrash. Must stay finite and bounded.
  mutual() {
    const W = D.Sandbox.build(2);
    const [a, b] = W.players;
    a.spawn = { x: 200, y: 570 }; D.Player.respawn(W, a);
    b.spawn = { x: 300, y: 570 }; D.Player.respawn(W, b);
    stepFor(W, 0.4);
    stepFor(W, 0.3, () => { setInput(a, 1, 0, false, false); setInput(b, -1, 0, false, false); });
    stepFor(W, 0.3, () => { setInput(a, 1, 0, true, true); setInput(b, -1, 0, true, true); });
    console.log('mutual grabs:', a.grab.map((g) => D.Grab.describe(g)).join('/'), b.grab.map((g) => D.Grab.describe(g)).join('/'));
    let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let maxV = 0, bad = 0;
    for (let i = 0; i < 20 / cfg.STEP; i++) {
      if (i % 30 === 0) {
        for (const p of [a, b]) { const an = rnd() * 6.28; setInput(p, Math.cos(an), Math.sin(an), true, true); }
      }
      D.World.step(W);
      for (const p of W.players) for (const bd of p.bodies) {
        if (!isFinite(bd.position.x)) bad++;
        maxV = Math.max(maxV, Math.hypot(D.Player.velX(bd), D.Player.velY(bd)));
      }
    }
    console.log('mutual thrash: NaN', bad, 'max speed', maxV.toFixed(0), 'respawns', a.respawns - 1, b.respawns - 1, 'heads', pos(a.head), pos(b.head), 'gap', Math.hypot(a.head.position.x - b.head.position.x, a.head.position.y - b.head.position.y).toFixed(0));
  },
};

const which = process.argv[2];
if (require.main === module) {
  for (const [name, fn] of Object.entries(scenarios)) {
    if (!which || which === name) fn();
  }
}
module.exports = { D, stepFor, setInput, pos, scenarios };
