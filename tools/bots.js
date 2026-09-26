// Scripted one-player "bots": deliberately simple policies (no lookahead) that cross one kind of obstacle.
// If a bot can do it, a person can. Shared by tools/segment-bots.js (each obstacle alone, at its limits)
// and tools/level-bot.js (whole levels, obstacle after obstacle).
// Every policy is a generator: it sets the player's inputs, `yield`s once per physics step, and returns
// true (done) or false (gave up). `run` drives one against a world.
const path = require('path');
global.window = global;
global.Matter = require('../js/lib/matter.min.js');
for (const f of ['config', 'core/characters', 'core/loop', 'physics/world', 'physics/grab', 'physics/player', 'physics/surfaces', 'physics/hazards',
  'levels/builder', 'levels/segments', 'levels/levels', 'levels/themes', 'levels/loader']) require(path.join('..', 'js', f + '.js'));
const D = global.Dangle;
const R = D.config.REACH;
const vx = (b) => D.Player.velX(b);
const vy = (b) => D.Player.velY(b);
const speed = (b) => Math.hypot(vx(b), vy(b));
const set = (p, ax, ay, l, r) => { p.input.aimX = ax; p.input.aimY = ay; p.input.grab[0] = !!l; p.input.grab[1] = !!r; };
const STEPS = 120;                                    // physics steps per second

// A level of start + the segments under test + goal; the player stands `back` px before the first
// tested segment (on the start ledge).
function setup(segs, back) {
  const def = { id: 'bot', name: 'bot', theme: 'meadow', direction: 'right', seed: 1, segments: [['start', { len: 4 }]].concat(segs, [['goal', {}]]) };
  const spec = D.Levels.compile(def);
  const W = D.Level.load(spec, 1);
  const p = W.players[0];
  const x0 = spec.segments[1].p0;
  p.spawn = { x: x0 - back, y: -27 };
  D.Player.respawn(W, p);
  for (let i = 0; i < 60; i++) D.World.step(W);
  return { W, p, spec, x0, x1: spec.segments[spec.segments.length - 2].p1 };
}

// Drive a policy to the end: returns its result, or false on death / after maxSec of game time.
function run(W, p, gen, maxSec) {
  for (let n = 0; n < (maxSec || 60) * STEPS; n++) {
    const r = gen.next();
    if (r.done) return { ok: r.value, t: n / STEPS };
    D.World.step(W);
    if (p.dead) return { ok: false, t: n / STEPS, dead: true };
  }
  return { ok: false, t: maxSec || 60 };
}

// ---- input policies (one step at a time) -------------------------------------------------------------------------

// Hand over hand up a face at wx to a lip at topY (dir +1: the wall is to the right, -1: to the left).
function climbStep(p, s, wx, topY, lean, dir, pull, tune) {
  dir = dir || 1;
  const T = tune || {};
  const mOff = T.mantleOff === undefined ? 22 : T.mantleOff, gOff = T.grabOff === undefined ? 8 : T.grabOff;
  if (pull === undefined) pull = lean;
  const g = p.grab, H = p.head.position;
  if (s.top) { set(p, 0.5 * dir, 0); return; }
  if (H.y < topY - 4 && (H.x - wx) * dir > 8) { s.top = true; set(p, 0.5 * dir, 0); return; }
  // A grip near the lip: shove down-away so the gripping arms throw the head up and over it.
  if ((g[0].pin && p.hands[0].position.y < topY + mOff || g[1].pin && p.hands[1].position.y < topY + mOff) && H.y < topY + 90) { set(p, -0.7 * dir, 0.7, g[0].pin, g[1].pin); return; }
  if (s.holder === undefined) {
    const up = (h) => h.position.y < H.y - 60 || h.position.y < topY - gOff;      // well above the head, or resting on the lip surface
    // First reach: up along the face (for a low step, to just above the lip); the grip then heaves the head over.
    const above = Math.min(p.hands[0].position.y, p.hands[1].position.y) < topY - 20;    // a hand is over the lip: reach onto the top
    const overshoot = above ? Math.max(0, topY - 12 - Math.min(p.hands[0].position.y, p.hands[1].position.y)) : 0;   // the hand hovers above the top: aim lower
    const tx = (above ? wx + 20 * dir : wx - 8 * dir) - H.x, ty = (above ? topY - 12 + 1.5 * overshoot : Math.max(topY - 40, H.y - 110)) - H.y;
    const d = Math.hypot(tx, ty) || 1, mag = D.config.AIM_DEADZONE + (1 - D.config.AIM_DEADZONE) * Math.min(1, d / R);   // stick length = reach
    set(p, tx / d * mag, ty / d * mag, up(p.hands[0]), up(p.hands[1]));
    if (g[0].pin || g[1].pin) s.holder = g[0].pin ? 0 : 1;
    return;
  }
  const h = s.holder, r = 1 - h;
  const higher = p.hands[r].position.y < p.hands[h].position.y - 18;
  const grabs = [false, false];
  grabs[h] = true; grabs[r] = higher;
  set(p, pull * dir, -1, grabs[0], grabs[1]);
  if (g[r].pin && higher) s.holder = r;
  if (!g[h].pin) s.holder = undefined;
}

// Hand over hand along a direction (dx, dy unit vector): one hand holds, the other reaches past and grabs,
// then they swap. Flat ground, slopes, beams: anything with no lip to mantle.
function crawlStep(p, s, dx, dy, aimX, aimY, noFan) {
  const g = p.grab, H = p.head.position;
  const proj = (h) => (h.position.x - H.x) * dx + (h.position.y - H.y) * dy;
  if (s.holder === undefined) {
    set(p, aimX, aimY, proj(p.hands[0]) > 50, proj(p.hands[1]) > 50);
    if (g[0].pin || g[1].pin) s.holder = g[0].pin ? 0 : 1;
    return;
  }
  const h = s.holder, r = 1 - h;
  const ahead = (p.hands[r].position.x - p.hands[h].position.x) * dx + (p.hands[r].position.y - p.hands[h].position.y) * dy > 20;
  const grabs = [false, false];
  grabs[h] = true; grabs[r] = ahead;
  // The two hands fan apart by ARM_SPREAD around the aim (left up, right down): aim so the FREE hand goes where wanted.
  const m = Math.hypot(aimX, aimY) || 1;
  const ang = Math.atan2(aimY, aimX) - (noFan ? 0 : (r === 1 ? 1 : -1) * D.config.ARM_SPREAD);
  set(p, Math.cos(ang) * m, Math.sin(ang) * m, grabs[0], grabs[1]);
  if (g[r].pin && ahead) s.holder = r;
  if (!g[h].pin) s.holder = undefined;
}

// ---- policies (generators) -------------------------------------------------------------------------------------

// Crawl along flat ground until the head is past x (about 60 px/s).
function* crawlTo(ctx, x, maxSec) {
  const s = {};
  for (let i = 0; i < (maxSec || 90) * STEPS; i++) {
    if (ctx.p.head.position.x >= x) return true;
    crawlStep(ctx.p, s, 1, 0, 1, 0.1);
    yield;
  }
  return false;
}

// Crawl up to a wall's foot: done when the head is within 90 px, or a hand grips the ground at the wall.
function* toWall(ctx, wx) {
  const p = ctx.p, g = p.grab;
  const s = {};
  for (let i = 0; i < 90 * STEPS; i++) {
    const gripping = p.head.position.x >= wx - 100 && ((g[0].pin && p.hands[0].position.x > wx - 30) || (g[1].pin && p.hands[1].position.x > wx - 30));   // a grip at the wall's foot holds the head back ~57 px
    if (p.head.position.x >= wx - 85 || gripping) return true;
    crawlStep(p, s, 1, 0, 1, 0.1);
    yield;
  }
  return false;
}

// Get the head to standoff px before an edge at xe (negative: past it). Crawling only gets the head to about 57 px
// behind the hand that grips the edge, so then push off: grip, stick BACK: the head is driven to the far side of the grip.
function* toEdge(ctx, xe, standoff, strong) {
  const p = ctx.p, g = p.grab, H = p.head.position;
  const s = {};
  for (let i = 0; i < 90 * STEPS; i++) {
    if (H.x >= xe - standoff) return true;
    if ((g[0].pin && p.hands[0].position.x > xe - 45) || (g[1].pin && p.hands[1].position.x > xe - 45)) break;
    crawlStep(p, s, 1, 0, 1, 0.1);
    yield;
  }
  for (let i = 0; i < 8 * STEPS; i++) {
    if (H.x >= xe - standoff) { set(p, 0, 0, false, false); return true; }
    const front = g[0].pin && (!g[1].pin || p.hands[0].position.x > p.hands[1].position.x) ? 0 : 1;   // keep only the grip nearest the edge
    set(p, -Math.min(1, 0.3 + (strong ? 0.4 : 0.08) * i / STEPS), 0.05, front === 0 && g[0].pin, front === 1 && g[1].pin);   // ramp the push up until the head starts to slide
    yield;
  }
  return false;
}

// Put the player at rest at x, standing on floor fy (what the game itself does at a checkpoint respawn). The rope search
// and the level bot both start a swing from exactly this stance: rope swings are chaotic, so a search result only holds
// from the stance it was found in.
function* placeAt(ctx, x, fy) {
  ctx.p.spawn = { x, y: fy - 27 };
  D.Player.respawn(ctx.W, ctx.p);
  for (let i = 0; i < 60; i++) { set(ctx.p, 0, 0, false, false); yield; }
  return true;
}

// Let go of everything for a few steps (a policy starts from a clean grip).
function* letGo(ctx, steps) { for (let i = 0; i < (steps || 8); i++) { set(ctx.p, 0, 0, false, false); yield; } }

// Let go and wait until the head is at rest on ground at y (the floor level the head should end up at).
function* settle(ctx, floorY, maxSec) {
  const p = ctx.p;
  let calm = 0;
  for (let i = 0; i < (maxSec || 8) * STEPS; i++) {
    set(p, 0, 0, false, false);
    if (speed(p.head) < 25 && Math.abs(p.head.position.y - (floorY - 24)) < 14) { if (++calm > 30) return true; } else calm = 0;
    yield;
  }
  return false;
}

// Walk off a ledge that ends at x0 and land on the floor at newFloorY.
function* dropOff(ctx, x0, newFloorY) {
  if (!(yield* toEdge(ctx, x0, -10, true))) return false;
  return yield* settle(ctx, newFloorY, 10);
}

function* climbWall(ctx, wx, topY, dir, lean, pull, margin, tune) {
  const s = {};
  const p = ctx.p;
  for (let i = 0; i < 40 * STEPS; i++) {
    climbStep(p, s, wx, topY, lean === undefined ? 0.55 : lean, dir, pull, tune);
    if (s.top && (p.head.position.x - wx) * (dir || 1) > (margin === undefined ? 12 : margin) && p.head.position.y < topY - 10 && speed(p.head) < 30) return true;
    yield;
  }
  return false;
}

// Plain pit: reach across, grab the far lip, mantle. g = spec.gaps entry, fy = floor y.
function* plainGap(ctx, g, fy) {
  const p = ctx.p;
  yield* letGo(ctx);
  let phase = 'reach';
  for (let i = 0; i < 12 * STEPS; i++) {
    const hand = p.hands[1];
    const pinned = !!p.grab[1].pin;
    const inp = p.input;
    if (phase === 'reach') { inp.aimX = 1; inp.aimY = 0.14; inp.grab[1] = hand.position.x > g.x1 - 25; if (pinned) phase = 'pull'; }
    else { inp.aimX = -0.7; inp.aimY = 0.7; inp.grab[1] = true; if (!pinned && p.head.position.x < g.x0 - 30) phase = 'reach'; }
    if (p.head.position.x > g.x1 + 30 && p.head.position.y > fy - 40) return true;
    yield;
  }
  return false;
}

// Closed-loop release: let go when the ballistic flight from here carries the head to where the hand can catch
// the target (the far lip at ledge height, or the next rope). No tuned numbers: it works from wherever the swing is.
function ballistic(H, tx, fy, last) {
  const vxx = vx(H), vyy = vy(H), gg = D.config.GRAVITY;
  if (vxx < 60) return false;
  let above = H.position.y < fy - 28;
  for (let t = 0.03; t <= 1.2; t += 0.03) {
    const x = H.position.x + vxx * t, y = H.position.y + vyy * t + 0.5 * gg * t * t;
    if (y < fy - 28) above = true;
    if (last) { if (above && y >= fy - 28 && vyy + gg * t > 0) return x >= tx - -60; }
    else if (x >= tx - -60 && y <= fy + 40 && y >= fy - 260) return true;
  }
  return false;
}

// Rope(s) over a pit: grab, pump, let go on the forward swing, grab the next rope / the far edge, mantle.
// params[k] = [release offset before the next target, min speed] for swing k (searched by ropeSearch).
function* ropeGen(ctx, g, params, fy) {
  const p = ctx.p;
  yield* letGo(ctx, 8);                                   // arms hang loose first
  const targets = g.ropes.slice(1).concat([g.x1]);
  let k = 0, phase = 'grab', mantleT = 0;
  for (let i = 0; i < 40 * STEPS; i++) {
    const H = p.head, hand = p.hands[1];
    const tgt = p.grab[1].pin && p.grab[1].target.dg.kind;
    const inp = p.input;
    const [relX, relMinSpeed] = params ? (params[k] || [9999, 0]) : [0, 0];   // searched release points, or (params null) the closed-loop rule
    if (phase === 'grab') { inp.aimX = 1; inp.aimY = 0; inp.grab[1] = hand.position.x > g.ropes[0] - 30; if (tgt === 'ropeSeg') phase = 'pump'; }
    else if (phase === 'pump') {
      const v = speed(H);
      const dx = hand.position.x - H.position.x, dy = hand.position.y - H.position.y, d = Math.hypot(dx, dy) || 1;
      if (v < 30) { inp.aimX = 1; inp.aimY = 0; }
      else { const ax = -vx(H) / v + dx / d, ay = -vy(H) / v + dy / d, m = Math.hypot(ax, ay) || 1; inp.aimX = ax / m; inp.aimY = ay / m; }
      inp.grab[1] = true;
      if (params && !params[k] && i > 10 * STEPS) { ctx.wait = k; return false; }
      const release = params ? (H.position.x > targets[k] - relX && vx(H) > 0 && v > relMinSpeed && vy(H) < 50) : ballistic(H, targets[k], fy, k === targets.length - 1);
      if (release) { phase = 'fly'; inp.grab[1] = false; }
    } else if (phase === 'fly') {
      inp.aimX = 1; inp.aimY = p.head.position.y > fy - 10 && k === targets.length - 1 ? -0.5 : 0.14;   // hanging below the far lip: reach up for it
      inp.grab[1] = (hand.position.x > targets[k] - 25 && hand.position.y > fy - 60) || (hand.position.x > targets[k] - 60 && k < targets.length - 1);
      if (tgt === 'ropeSeg') { if (k < targets.length - 1) { k++; ctx.stage = k; phase = 'pump'; } }
      else if (tgt) phase = 'mantle';
    } else {                                            // mantle; if the grip is too low to heave from, let go and grip higher
      inp.aimX = -0.7; inp.aimY = 0.7; inp.grab[1] = ++mantleT < 200;
      if (!p.grab[1].pin || mantleT > 240) { phase = 'fly'; mantleT = 0; }
    }
    ctx.stage = k;
    if (p.head.position.y > fy + 260) return false;
    if (p.head.position.x > g.x1 + 30 && p.head.position.y > fy - 40 && phase !== 'pump') return true;
    yield;
  }
  return false;
}

// Search the release point of every swing (a person feels for it): depth first, one swing at a time.
const ropeCache = {};
function ropeSearch(gapOpts, params) {
  const key = JSON.stringify({ w: gapOpts.w, aid: gapOpts.aid, n: gapOpts.n, spacing: gapOpts.spacing });
  if (!params && key in ropeCache) return ropeCache[key];
  params = params || [];
  const k = params.length;
  let found = null;
  outer:
  for (const relX of [-20, 20, 60, 100, 140, 180, 220, 260]) for (const ms of [0, 150, 300, 450]) {   // coarse grid; a person feels for it
    const trial = params.concat([[relX, ms]]);
    const { W, p, spec } = setup([['gap', Object.assign({}, gapOpts, { land: 1.5 })]], 14);
    const g = spec.gaps[0];
    const ctx = { p };
    const r = run(W, p, ropeGen(ctx, g, trial, 0), 40);
    D.Level.unload(W);
    if (r.ok) { found = { params: trial, t: r.t }; break outer; }
    if (ctx.stage > k) { const deeper = ropeSearch(gapOpts, trial); if (deeper) { found = deeper; break outer; } }
  }
  if (params.length === 0) ropeCache[key] = found;
  return found;
}

// Cross a rope gap: the closed-loop rule first, then a searched set of release points. {t, params} or null.
function ropeCross(gapOpts) {
  return ropeSearch(gapOpts);
}

// Hang from an overhead beam (bottom at floorY - R) and go hand over hand until the head is past endX; let go.
function* beamHang(ctx, floorY, endX) {
  const p = ctx.p;
  yield* letGo(ctx);
  const beamY = floorY - R;
  const s = {};
  let phase = 'reach';
  for (let i = 0; i < 40 * STEPS; i++) {
    if (phase === 'reach') {
      set(p, 0.35, -1, p.hands[0].position.y < beamY + 40, p.hands[1].position.y < beamY + 40);
      if (p.grab[0].pin || p.grab[1].pin) phase = 'crawl';
    } else if (p.head.position.x > endX) return yield* settle(ctx, floorY, 8);
    else crawlStep(p, s, 1, 0, 1, -0.55, true);
    yield;
  }
  return false;
}

// Ice slope (3R run, rise) then its shelf: crawl along the slope, then flat.
function* iceUp(ctx, x0, len, rise, endX) {
  const p = ctx.p;
  const a = Math.atan2(-rise * R, len * R), dx = Math.cos(a), dy = Math.sin(a);
  const s = {};
  for (let i = 0; i < 90 * STEPS; i++) {
    if (p.head.position.x >= endX) return true;
    if (p.head.position.x < x0 + len * R + 20) crawlStep(p, s, dx, dy, Math.cos(a + 0.5), Math.sin(a + 0.5));
    else crawlStep(p, s, 1, 0, 1, 0.1);
    yield;
  }
  return false;
}

// A crate against the foot of a wall: climb the crate, then the wall.
function* crateWall(ctx, crate, wx, topY) {
  const p = ctx.p;
  const left = crate.position.x - 32, cTop = crate.position.y - 32;
  if (!(yield* toWall(ctx, left))) return false;
  if (!(yield* climbWall(ctx, left, cTop, 1, 0.55, undefined, 8))) return false;
  return yield* climbWall(ctx, wx, topY, 1, 0.55);
}

module.exports = { D, R, vx, vy, speed, set, setup, run, climbStep, crawlStep, crawlTo, toWall, toEdge, placeAt, settle, dropOff, climbWall, plainGap, ropeGen, ropeSearch, ropeCross, beamHang, iceUp, crateWall };
