// Camera checks (pure maths, no DOM): node tools/camera-test.js
global.window = global;
require('../js/config.js');
require('../js/core/camera.js');
const D = global.Dangle;
const C = D.Camera;
const cfg = D.config;
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
const T = (index, x, y, vx = 0, vy = 0) => ({ index, x, y, vx, vy });
const run = (secs, targets, w = 1200, h = 700, skip = false) => { for (let i = 0; i < secs * 60; i++) C.update(1 / 60, targets, w, h, skip); };

// One player: centred, at the minimum zoom-out.
C.setLevel(null);
run(1, [T(0, 500, 300)]);
check(Math.abs(C.cam.x - 500) < 1 && Math.abs(C.cam.y - 300) < 1, 'single player is centred');
check(Math.abs(C.cam.scale - Math.min(1200 / cfg.CAM_MIN_W, 700 / cfg.CAM_MIN_H)) < 1e-6, 'single player zoom = minimum framing');

// Two players close together fit; far apart hits the zoom-out cap and arrows appear.
C.setLevel(null);
run(2, [T(0, 0, 0), T(1, 900, 0)]);
check(C.arrows.length === 0, 'two players 900 px apart both fit, no arrows');
C.setLevel(null);
run(3, [T(0, -2000, 0), T(1, 2000, 0)]);
check(Math.abs(C.cam.scale - Math.min(1200 / cfg.CAM_MAX_W, 700 / cfg.CAM_MIN_H)) < 0.02, 'zoom is clamped at the co-op limit');
check(C.arrows.length === 2 && C.arrows[0].x < 600 && C.arrows[1].x > 600, 'off-screen players get edge arrows pointing outward');
check(Math.abs(C.arrows[0].angle) > 3 && Math.abs(C.arrows[1].angle) < 0.2, 'arrow angles point left / right');

// Level bounds: the view never shows outside them; a level narrower than the view is centred.
const level = { bounds: { minX: 0, maxX: 5000, minY: -1000, maxY: 400 }, goal: { x: 4800, y: 100, w: 200, h: 260 }, direction: 'right' };
C.setLevel(level);
run(5, [T(0, 20, 300)]);
const hw = 1200 / (2 * C.cam.scale);
check(C.cam.x - hw >= -1e-6, `view stays inside the left bound (left edge ${(C.cam.x - hw).toFixed(1)})`);
C.setLevel({ bounds: { minX: 0, maxX: 600, minY: -1000, maxY: 400 }, goal: { x: 300, y: 0, w: 100, h: 100 }, direction: 'right' });
run(5, [T(0, 100, 300)]);
check(Math.abs(C.cam.x - 300) < 1, 'level narrower than the view is centred');

// Intro: starts on the goal, glides to the players, and can be skipped by input.
C.setLevel(level);
C.update(1 / 60, [T(0, 2500, 300)], 1200, 700, false);
check(C.cam.x > 4000 && C.cam.introOn, `intro opens looking at the goal (x ${C.cam.x.toFixed(0)}, clamped inside the level)`);
run(cfg.CAM_INTRO_HOLD + cfg.CAM_INTRO_PAN + 0.3, [T(0, 2500, 300)]);
check(!C.cam.introOn && Math.abs(C.cam.x - 2500) < 60, 'intro ends on the players');
C.setLevel(level);
run(1, [T(0, 300, 300)], 1200, 700, true);
check(!C.cam.introOn, 'input skips the intro (after the first half second)');

// Lookahead leads the motion; vertical levels look up.
C.setLevel({ bounds: { minX: -9000, maxX: 9000, minY: -9000, maxY: 9000 }, goal: null, direction: 'right' });
run(4, [T(0, 0, 0, 900, 0)]);
check(C.cam.x > 100, `lookahead leads a fast player (${C.cam.x.toFixed(0)} px ahead)`);
C.setLevel({ bounds: { minX: -9000, maxX: 9000, minY: -9000, maxY: 9000 }, goal: null, direction: 'up' });
run(4, [T(0, 0, 0, 0, -900)]);
check(C.cam.y < -100 && Math.abs(C.cam.x) < 1, 'vertical levels look ahead upward only');

console.log(fails ? `${fails} failed` : 'camera ok');
process.exit(fails ? 1 : 0);
