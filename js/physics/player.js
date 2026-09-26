// Player factory and per-step arm/head physics.
// A player is a heavy head plus two light hands. Each arm is a *vector spring* that wants
// (hand - head) to equal the aimed arm vector. A free hand flies to its target; a gripping
// hand can't move, so the same spring moves the head instead: that is the "heave", no scripting.
// Every arm force is applied equally and oppositely to hand and head, so a player (or a
// chain of players) can never push itself through the air: no free energy.
window.Dangle = window.Dangle || {};

(function () {
  const M = Matter;
  const cfg = () => Dangle.config;
  const FORCE_K = Dangle.World.FORCE_K;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const LEFT = 0;
  const RIGHT = 1;

  // px/s from Verlet positions (velocity is implicit in Matter).
  function velX(b) { return (b.position.x - b.positionPrev.x) * 1000 / b.deltaTime; }
  function velY(b) { return (b.position.y - b.positionPrev.y) * 1000 / b.deltaTime; }

  // Set velocity in px/s (Matter wants px per 16.7 ms).
  function setVel(b, x, y) {
    const k = 1 / Dangle.World.PER_SEC;
    M.Body.setVelocity(b, { x: x * k, y: y * k });
  }

  function create(W, index, x, y, look) {
    const c = cfg();
    // Same negative group = a player's own head/hands never collide with each other.
    const filter = { group: -(index + 1) };
    const p = {
      index,
      look,                       // { head, dark } placeholder colors until Phase 4
      spawn: { x, y },
      input: { aimX: 0, aimY: 0, grab: [false, false] },
      aim: { m: 0, dx: 0, dy: 0 },// processed aim: magnitude 0..1 and direction
      grab: [Dangle.Grab.newState(), Dangle.Grab.newState()],
      popT: 0,                    // >0 while the respawn pop animation plays
      respawns: 0,
      dead: false, deadT: 0,      // levels: out of the world until the respawn timer runs out
      deaths: 0,
      stretch: [0, 0],            // arm stretch 0..1 (drawing + debug)
      tilt: 0, tiltPrev: 0,       // cosmetic face tilt (rad); the physics head never rotates
      tiltVel: 0,
    };
    p.head = M.Bodies.circle(x, y, c.HEAD_RADIUS, { label: 'head', collisionFilter: filter, restitution: 0 });
    p.hands = [LEFT, RIGHT].map((i) =>
      M.Bodies.circle(x + (i ? 1 : -1) * c.ARM_RELAX_X, y + c.ARM_RELAX_Y, c.HAND_RADIUS,
        { label: 'hand', collisionFilter: filter, restitution: 0 }));
    Dangle.World.register(W, p.head, 'head', { owner: p });
    p.hands.forEach((h) => Dangle.World.register(W, h, 'hand', { owner: p }));
    p.bodies = [p.head, p.hands[0], p.hands[1]];
    // Arm-length limits are one-sided (rope-like) constraints inside Matter's own solver, so
    // they resolve together with grips, rope links and other players instead of fighting them.
    p.arms = p.hands.map((h) => Dangle.World.addConstraint(W, M.Constraint.create({
      bodyA: p.head, bodyB: h, length: c.REACH, stiffness: 1, damping: 0, maxOnly: true,
    })));
    applyConfig(p);
    Dangle.World.addPlayer(W, p);
    return p;
  }

  function applyConfig(p) {
    const c = cfg();
    M.Body.setMass(p.head, c.HEAD_MASS);
    // The head body never rotates. A rolling head grips walls through Matter's static friction
    // and crawls; a sliding one gets predictable friction, and grips on heads don't twist.
    M.Body.setInertia(p.head, Infinity);
    // Matter friction is off for players: on sliding contacts it warm-starts into viscous drag
    // (a head heaved up a wall crawled at ~45 px/s). Heads use floorFriction() instead; hands
    // need none, since gripping is done by pins.
    p.head.friction = 0;
    p.head.frictionStatic = 0;
    p.head.frictionAir = c.HEAD_AIR_DRAG;
    p.hands.forEach((h) => {
      M.Body.setMass(h, c.HAND_MASS);
      h.friction = 0;
      h.frictionStatic = 0;
      h.frictionAir = c.HAND_AIR_DRAG;
    });
    p.arms.forEach((a) => { a.length = c.REACH * c.ARM_MAX_STRETCH; });
  }

  // Turn raw stick input into {m, dx, dy}; m is 0 inside the deadzone.
  function processAim(p) {
    const c = cfg();
    const ax = p.input.aimX;
    const ay = p.input.aimY;
    const mag = Math.hypot(ax, ay);
    const a = p.aim;
    if (mag < c.AIM_DEADZONE) { a.m = 0; return; }
    a.m = Math.min(1, (mag - c.AIM_DEADZONE) / (1 - c.AIM_DEADZONE));
    a.dx = ax / mag;
    a.dy = ay / mag;
  }

  function armForces(p) {
    const c = cfg();
    const H = p.head;
    const a = p.aim;
    const w = c.ARM_FREQ;
    // Blend from "relaxed" to "aimed" so a tiny stick nudge doesn't snap the arms.
    const t = clamp(a.m / 0.35, 0, 1);
    const blend = t * t * (3 - 2 * t);
    const hvx = velX(H);
    const hvy = velY(H);
    const baseAng = Math.atan2(a.dy, a.dx);
    const f = H.mass * FORCE_K;   // forces are expressed as head accelerations (px/s^2)

    for (let i = 0; i < 2; i++) {
      const hand = p.hands[i];
      const gripping = !!p.grab[i].pin;
      let s, zeta, capG, len;
      if (gripping) {
        // A gripping arm is a slack rope at neutral stick (you hang), and a short, strong
        // muscle when aimed: the head is driven to the side of the grip *opposite* the stick.
        // Keeping it short is what lets the other hand reach higher than the grip (climbing).
        if (blend === 0) continue;
        s = blend;
        zeta = c.PINNED_DAMP;     // low damping: swings keep their momentum
        capG = c.ARM_FORCE_CAP * blend;
        len = c.REACH * a.m * c.PINNED_REACH;
      } else {
        // A reaching arm is weaker than a gripping one, so a blocked reach never undoes a hold.
        s = c.ARM_RELAX + (1 - c.ARM_RELAX) * blend;
        zeta = c.ARM_DAMP;
        capG = c.RELAX_CAP + (c.FREE_ARM_CAP - c.RELAX_CAP) * blend;
        len = c.REACH * a.m;
      }
      const k = w * w * s;
      const d = 2 * zeta * w * Math.sqrt(s);
      const cap = c.GRAVITY * capG;
      const side = i === LEFT ? -1 : 1;
      const rx = side * c.ARM_RELAX_X;
      const ry = c.ARM_RELAX_Y;
      const ang = baseAng + side * c.ARM_SPREAD;
      const tx = rx + (Math.cos(ang) * len - rx) * blend;
      const ty = ry + (Math.sin(ang) * len - ry) * blend;
      const ex = H.position.x + tx - hand.position.x;
      const ey = H.position.y + ty - hand.position.y;
      let fx = k * ex - d * (velX(hand) - hvx);
      let fy = k * ey - d * (velY(hand) - hvy);
      const mag = Math.hypot(fx, fy);
      if (mag > cap) { fx *= cap / mag; fy *= cap / mag; }
      // An aimed free arm also carries its hand's weight (the head takes the load), so the spring
      // is spent on moving the hand: reaches land where you aim, even sliding up a wall.
      if (!gripping) fy -= c.GRAVITY * (hand.mass / H.mass) * blend;
      // Newton's third law, always: whatever drives the hand pushes back on the head.
      hand.force.x += fx * f; hand.force.y += fy * f;
      H.force.x -= fx * f;    H.force.y -= fy * f;
    }
  }

  function preStep(W, p, dt) {
    if (p.popT > 0) p.popT = Math.max(0, p.popT - dt);
    processAim(p);
    armForces(p);
  }

  // Move a body without changing its velocity.
  const v2 = { x: 0, y: 0 };
  function shift(b, dx, dy) {
    v2.x = b.position.x + dx; v2.y = b.position.y + dy;
    M.Body.setPosition(b, v2);
  }

  // Safety net behind the solver's arm constraint: only if an arm is still clearly over-stretched
  // after the step (a violent pile-up), project it back and remove the outward relative velocity.
  function limitArm(p, i) {
    const c = cfg();
    const H = p.head;
    const h = p.hands[i];
    const max = c.REACH * c.ARM_MAX_STRETCH;
    const dx = h.position.x - H.position.x;
    const dy = h.position.y - H.position.y;
    const dist = Math.hypot(dx, dy);
    p.stretch[i] = clamp((dist - 40) / (max - 40), 0, 1);
    if (dist <= max + c.LIMIT_SLOP || dist === 0) return;

    const g = p.grab[i];
    const target = g.pin ? g.target : null;
    let invH = 1 / H.mass;
    let invh = 1 / h.mass;
    let partner = null; // dynamic body held by the hand: it must travel with the hand
    if (target) {
      // Static targets and rope segments (held by their own rope) don't budge.
      if (target.isStatic || target.dg.kind === 'ropeSeg') invh = 0;
      else { partner = target; invh = 1 / (h.mass + partner.mass); }
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const total = invH + invh;
    const excess = dist - max;
    const moveH = excess * invH / total;
    const moveh = excess * invh / total;
    shift(H, nx * moveH, ny * moveH);
    if (invh > 0) {
      shift(h, -nx * moveh, -ny * moveh);
      if (partner) shift(partner, -nx * moveh, -ny * moveh);
    }

    const rel = (velX(h) - velX(H)) * nx + (velY(h) - velY(H)) * ny;
    if (rel > 0) {
      const j = rel / total;
      setVel(H, velX(H) + nx * j * invH, velY(H) + ny * j * invH);
      if (invh > 0) {
        setVel(h, velX(h) - nx * j * invh, velY(h) - ny * j * invh);
        if (partner) setVel(partner, velX(partner) - nx * j * invh, velY(partner) - ny * j * invh);
      }
    }
  }

  function limitArms(p) {
    limitArm(p, LEFT);
    limitArm(p, RIGHT);
  }

  function clampSpeed(b, maxSpeed) {
    const vx = velX(b);
    const vy = velY(b);
    const sp = Math.hypot(vx, vy);
    if (sp > maxSpeed) setVel(b, vx * maxSpeed / sp, vy * maxSpeed / sp);
  }

  function finite(b) {
    return isFinite(b.position.x) && isFinite(b.position.y) && isFinite(b.positionPrev.x) && isFinite(b.positionPrev.y);
  }

  // NaN / out-of-bounds / broken-arm check. Returns true when the player is sane.
  function healthy(W, p) {
    const c = cfg();
    const killY = W.killY === undefined ? c.KILL_Y : W.killY;
    const lim = W.limits || { minX: -c.WORLD_LIMIT, maxX: c.WORLD_LIMIT, minY: -c.WORLD_LIMIT };
    for (const b of p.bodies) {
      if (!finite(b)) return false;
      if (b.position.x < lim.minX || b.position.x > lim.maxX || b.position.y > killY || b.position.y < lim.minY) return false;
    }
    const far = c.REACH * 3;
    for (const h of p.hands) {
      if (Math.hypot(h.position.x - p.head.position.x, h.position.y - p.head.position.y) > far) return false;
    }
    return true;
  }

  // After the engine step: respawn broken players. Returns true if the player was respawned.
  function guard(W, p) {
    if (healthy(W, p)) return false;
    die(W, p, 'fell');
    return true;
  }

  // Coulomb-style friction for heads and hands on *floors*: decelerate sliding relative to the
  // surface by GRIP * g * (how much the surface faces up). Walls and ceilings are frictionless
  // for players, so heaving up a wall is smooth while floors still stop you (and hands pushing
  // on a floor don't skate). Against another dynamic body the impulse is shared by mass.
  function isPlayerPart(b) { return b.dg && (b.dg.kind === 'head' || b.dg.kind === 'hand'); }

  function floorFriction(W, dt) {
    const c = cfg();
    const list = W.engine.pairs.list;
    for (let i = 0; i < list.length; i++) {
      const pair = list[i];
      if (!pair.isActive) continue;
      const a = pair.bodyA;
      const b = pair.bodyB;
      const body = isPlayerPart(a) ? a : isPlayerPart(b) ? b : null;
      if (!body) continue;
      const other = body === a ? b : a;
      let nx = pair.collision.normal.x;
      let ny = pair.collision.normal.y;
      // Orient the normal from the surface toward the body.
      if (nx * (body.position.x - other.position.x) + ny * (body.position.y - other.position.y) < 0) { nx = -nx; ny = -ny; }
      const up = -ny;                      // 1 = flat floor, 0 = wall
      if (up <= 0.1) continue;
      let grip = body.dg.kind === 'head' ? c.HEAD_GRIP : c.HAND_GRIP;
      if (other.dg && other.dg.slick) grip *= c.SLICK_GRIP_SCALE;
      const dynamic = !other.isStatic;
      let ovx = 0, ovy = 0;
      if (other.dg && other.dg.mover) { ovx = other.dg.mover.vx; ovy = other.dg.mover.vy; }
      else if (dynamic) { ovx = velX(other); ovy = velY(other); }
      const tx = -ny;
      const ty = nx;
      const bvx = velX(body);
      const bvy = velY(body);
      const vt = (bvx - ovx) * tx + (bvy - ovy) * ty;
      let dv = Math.min(Math.abs(vt), grip * c.GRAVITY * up * dt);
      if (dv <= 0) continue;
      const sgn = vt > 0 ? 1 : -1;
      if (dynamic) {
        const share = other.mass / (other.mass + body.mass);
        setVel(other, ovx + sgn * dv * (1 - share) * tx, ovy + sgn * dv * (1 - share) * ty);
        dv *= share;
      }
      setVel(body, bvx - sgn * dv * tx, bvy - sgn * dv * ty);
    }
  }

  // Last thing each step: safety clamps, then the cosmetic tilt (a damped spring that leans
  // the face into sideways motion and settles back upright).
  function finish(p, dt) {
    const c = cfg();
    clampSpeed(p.head, c.MAX_HEAD_SPEED);
    clampSpeed(p.hands[0], c.MAX_HAND_SPEED);
    clampSpeed(p.hands[1], c.MAX_HAND_SPEED);
    const target = clamp(velX(p.head) * c.TILT_PER_SPEED, -c.TILT_MAX, c.TILT_MAX);
    p.tiltPrev = p.tilt;
    p.tiltVel += ((target - p.tilt) * 120 - p.tiltVel * 14) * dt;
    p.tilt += p.tiltVel * dt;
  }

  // Put the player back together at (x, y) with everything at rest, and play the pop.
  function place(W, p, x, y) {
    const c = cfg();
    Dangle.Grab.releaseAll(W, p);
    Dangle.Grab.releaseTargeting(W, p.bodies);
    Dangle.World.teleport(p.head, x, y);
    Dangle.World.teleport(p.hands[0], x - c.ARM_RELAX_X, y + c.ARM_RELAX_Y);
    Dangle.World.teleport(p.hands[1], x + c.ARM_RELAX_X, y + c.ARM_RELAX_Y);
    p.tilt = p.tiltPrev = p.tiltVel = 0;
    p.popT = 0.4;
  }

  // Immediate reset at p.spawn (sandbox and tests).
  function respawn(W, p) {
    place(W, p, p.spawn.x, p.spawn.y);
    p.respawns++;
  }

  // Death. In a level the player leaves the world (bodies and arm constraints removed, so
  // nothing can touch, pin to, or be pulled by them) until the level's respawn timer revives them.
  function die(W, p, cause) {
    if (p.dead) return;
    if (!W.level) { respawn(W, p); return; }
    Dangle.Grab.releaseAll(W, p);
    Dangle.Grab.releaseTargeting(W, p.bodies);
    for (const b of p.bodies) M.Composite.remove(W.mworld, b);
    for (const a of p.arms) M.Composite.remove(W.mworld, a);
    p.dead = true;
    p.deadT = W.players.length > 1 ? cfg().RESPAWN_DELAY_COOP : cfg().RESPAWN_DELAY_SOLO;
    p.deaths++;
    W.level.events.push({ type: 'death', player: p.index, cause, x: p.head.position.x, y: p.head.position.y });
  }

  function revive(W, p, x, y) {
    for (const b of p.bodies) M.Composite.add(W.mworld, b);
    for (const a of p.arms) M.Composite.add(W.mworld, a);
    place(W, p, x, y);
    p.dead = false;
    p.respawns++;
    W.level.events.push({ type: 'revive', player: p.index, x, y });
  }

  Dangle.Player = { create, applyConfig, preStep, guard, limitArms, finish, floorFriction, respawn, die, revive, velX, velY, setVel, LEFT, RIGHT };
})();
