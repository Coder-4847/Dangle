// Dev probe: which part of the physics step adds/removes energy in a stress scenario.
// node tools/energy-probe.js [scenario] [fromTime]
const { D } = require('./sim-test.js');
const M = Matter;
const c = D.config;
const sc = D.Stress.find(process.argv[2] || 'chain');
const from = parseFloat(process.argv[3] || '4.3');
const ss = D.Stress.session(sc);
const W = ss.W;
const all = () => W.players.flatMap((p) => p.bodies).concat((W.ropes || []).flatMap((r) => r.bodies));
const E = () => { let e = 0; for (const x of all()) { const vx = D.Player.velX(x), vy = D.Player.velY(x); e += 0.5 * x.mass * (vx * vx + vy * vy) - x.mass * c.GRAVITY * x.position.y; } return e; };
const acc = {};
let on = false;
function wrap(obj, name, label) {
  const f = obj[name];
  obj[name] = function (...args) { const e0 = on ? E() : 0; const r = f.apply(this, args); if (on) acc[label] = (acc[label] || 0) + (E() - e0); return r; };
}
wrap(D.Grab, 'update', 'grab'); wrap(D.Surfaces, 'preStep', 'movers');
wrap(M.Body, 'update', 'integrate (gravity/forces/drag)');
wrap(M.Constraint, 'solveAll', 'constraints (Matter)');
wrap(M.Constraint, 'preSolveAll', 'constraint warm start');
wrap(M.Resolver, 'solvePosition', 'contacts position'); wrap(M.Resolver, 'solveVelocity', 'contacts velocity');
wrap(D.Player, 'floorFriction', 'floorFriction'); wrap(D.Player, 'limitArms', 'limitArms safety net');
wrap(D.Surfaces, 'postStep', 'rope LRA'); wrap(D.Player, 'finish', 'finish(clamps)');
while (!ss.finished) { on = ss.time > from; ss.step(); }
const scale = all().reduce((m, x) => m + x.mass, 0) * c.GRAVITY * c.REACH;
for (const k in acc) console.log(k.padEnd(34), (acc[k] / scale).toFixed(4));
console.log(ss.result.info);
