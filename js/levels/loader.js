// Turns a compiled level spec (plain data, see builder.js) into a running physics world,
// and takes it apart again. load() / unload() are the only way levels enter or leave memory.
window.Dangle = window.Dangle || {};

(function () {
  const S = () => Dangle.Surfaces;

  // chars: character index per player (Dangle.Characters); defaults to 0, 1.
  function load(spec, playerCount, chars) {
    const c = Dangle.config;
    const W = Dangle.World.create();
    W.killY = spec.killY;
    // Out-of-bounds guard: the level's extent plus slack (levels are far wider than the sandbox).
    W.limits = { minX: spec.bounds.minX - 1500, maxX: spec.bounds.maxX + 1500, minY: spec.bounds.minY - 2500 };
    W.themeId = spec.theme;

    for (const b of spec.blocks) S().block(W, b.x, b.y, b.w, b.h, b.kind, { angle: b.angle });
    for (const m of spec.movers) S().mover(W, m.x, m.y, m.w, m.h, { dx: m.dx, dy: m.dy, period: m.period, phase: m.phase, kind: m.kind });
    for (const r of spec.ropes) S().rope(W, r.x, r.y, r.n, r.spacing, r.mass);
    const crates = spec.crates.map((k) => S().crate(W, k.x, k.y, k.size, k.mass));
    const tramps = spec.trampolines.map((t) => S().block(W, t.x, t.y, t.w, t.h, 'trampoline'));

    W.level = {
      spec,
      id: spec.id,
      t: 0,                 // seconds since load
      started: false,       // set on the first player input; the clock starts there
      startT: 0,
      time: 0,              // final time once complete
      complete: false,
      completeT: 0,
      checkpoint: -1,       // index of the last checkpoint reached (-1 = the start)
      hazards: spec.hazards,
      risers: spec.risers.map((r) => Object.assign({ t0: null }, r)),
      winds: spec.winds,
      crates,
      trampolines: tramps,
      events: [],           // {type: death|revive|checkpoint|complete|bounce, ...}: drained by effects/audio
    };

    for (let i = 0; i < playerCount; i++) {
      const sp = spec.spawns[i % spec.spawns.length];
      Dangle.Player.create(W, i, sp.x, sp.y, Dangle.Characters.get(chars ? chars[i] : i));
    }
    return W;
  }

  // Remove everything so nothing lingers: bodies, constraints, lists and the level state.
  function unload(W) {
    if (!W) return;
    for (const p of W.players) Dangle.Grab.releaseAll(W, p);
    Matter.Composite.clear(W.mworld, false, true);
    Matter.Engine.clear(W.engine);
    W.dynamic.length = 0;
    W.drawables.length = 0;
    W.grabbables.length = 0;
    W.players.length = 0;
    if (W.ropes) W.ropes.length = 0;
    if (W.movers) W.movers.length = 0;
    W.level = null;
    W.dead = true;
  }

  // Cheap leak check: what a freshly loaded and a long-lived world should both hold.
  function census(W) {
    return {
      bodies: Matter.Composite.allBodies(W.mworld).length,
      constraints: Matter.Composite.allConstraints(W.mworld).length,
      dynamic: W.dynamic.length,
      grabbables: W.grabbables.length,
    };
  }

  Dangle.Level = { load, unload, census };
})();
