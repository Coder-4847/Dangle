// Player factory and per-step arm/head physics.
// A player is a heavy head plus two light hands. Each arm is a *vector spring* that wants
// (hand - head) to equal the aimed arm vector. Free hands fly to their target; a pinned hand
// can't move, so the same spring pulls the head instead: that is the "heave", no scripting.
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

  function create(W, index, x, y, look) {
    const c = cfg();
    // Same negative group = a player's own head/hands never collide with each other.
    const group = -(index + 1);
    const filter = { group };
    const p = {
      index,
      look,                       // { head, dark } placeholder colors until Phase 4
      spawn: { x, y },
      input: { aimX: 0, aimY: 0, grab: [false, false] },
      aim: { m: 0, dx: 0, dy: 0 },// processed aim: magnitude 0..1 and direction
      grab: [Dangle.Grab.newState(), Dangle.Grab.newState()],
      popT: 0,                    // >0 while the respawn pop animation plays
      respawns: 0,
      stretch: [0, 0],            // arm stretch 0..1 (drawing + debug)
    };
    p.head = M.Bodies.circle(x, y, c.HEAD_RADIUS, { label: 'head', collisionFilter: filter, restitution: 0 });
    p.hands = [LEFT, RIGHT].map((i) =>
      M.Bodies.circle(x + (i ? 1 : -1) * c.ARM_RELAX_X, y + c.ARM_RELAX_Y, c.HAND_RADIUS,
        { label: 'hand', collisionFilter: filter, restitution: 0 }));
    Dangle.World.register(W, p.head, 'head', { owner: p });
    p.hands.forEach((h) => Dangle.World.register(W, h, 'hand', { owner: p }));
    p.bodies = [p.head, p.hands[0], p.hands[1]];
    applyConfig(p);
    Dangle.World.addPlayer(W, p);
    return p;
  }

  function applyConfig(p) {
    const c = cfg();
    M.Body.setMass(p.head, c.HEAD_MASS);
    p.head.friction = c.HEAD_FRICTION;
    p.head.frictionStatic = c.HEAD_FRICTION_STATIC;
    p.head.frictionAir = c.HEAD_AIR_DRAG;
    p.hands.forEach((h) => {
      M.Body.setMass(h, c.HAND_MASS);
      h.friction = c.HAND_FRICTION;
      h.frictionStatic = c.HAND_FRICTION;
      h.frictionAir = c.HAND_AIR_DRAG;
    });
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
    const zeta = c.ARM_DAMP;
    // Blend from "relaxed dangle" to "aimed" so a tiny stick nudge doesn't snap the arms.
    const t = clamp(a.m / 0.35, 0, 1);
    const blend = t * t * (3 - 2 * t);
    const s = c.ARM_RELAX + (1 - c.ARM_RELAX) * blend;          // stiffness scale
    const k = w * w * s;
    const d = 2 * zeta * w * Math.sqrt(s);
    const cap = c.GRAVITY * c.ARM_FORCE_CAP;                    // accel-equivalent (px/s^2)
    const hvx = velX(H);
    const hvy = velY(H);
    const baseAng = Math.atan2(a.dy, a.dx);
    const len = c.REACH * a.m;

    for (let i = 0; i < 2; i++) {
      const hand = p.hands[i];
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
      // Newton's third law: whatever drives the hand pushes back on the head. While the stick
      // is neutral the arm is just a dangling rope, so it must not hold the head up.
      const f = H.mass * FORCE_K;
      hand.force.x += fx * f; hand.force.y += fy * f;
      H.force.x -= fx * f * blend; H.force.y -= fy * f * blend;
    }
  }

  function preStep(W, p, dt) {
    if (p.popT > 0) p.popT = Math.max(0, p.popT - dt);
    processAim(p);
    armForces(p);
    // Gentle torque so the face tilts with motion but drifts back upright.
    const H = p.head;
    const ang = H.angle - Math.round(H.angle / (2 * Math.PI)) * 2 * Math.PI;
    H.torque -= H.inertia * FORCE_K * cfg().HEAD_UPRIGHT * ang;
  }

  // Move a body without changing its velocity.
  function shift(b, dx, dy) {
    M.Body.setPosition(b, { x: b.position.x + dx, y: b.position.y + dy });
  }

  // Hard arm-length limit. Position correction shared by inverse mass, then the outward
  // relative velocity is removed (like a taut rope). A hand pinned to static geometry is immovable.
  function limitArm(p, i) {
    const c = cfg();
    const H = p.head;
    const h = p.hands[i];
    const max = c.REACH * c.ARM_MAX_STRETCH;
    const dx = h.position.x - H.position.x;
    const dy = h.position.y - H.position.y;
    const dist = Math.hypot(dx, dy);
    p.stretch[i] = clamp((dist - 40) / (max - 40), 0, 1);
    if (dist <= max || dist === 0) return;

    const g = p.grab[i];
    const pinTarget = g.pin ? (g.pin.bodyB === h ? g.pin.bodyA : g.pin.bodyB) : null;
    let invH = 1 / H.mass;
    let invh = 1 / h.mass;
    let partner = null; // dynamic body pinned to the hand; it must travel with it
    if (pinTarget) {
      if (pinTarget.isStatic) invh = 0;
      else { partner = pinTarget; invh = 1 / (h.mass + partner.mass); }
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const excess = dist - max;
    const total = invH + invh;
    const moveH = excess * invH / total;
    const moveh = excess * invh / total;
    shift(H, nx * moveH, ny * moveH);
    if (invh > 0) {
      shift(h, -nx * moveh, -ny * moveh);
      if (partner) shift(partner, -nx * moveh, -ny * moveh);
    }

    // Remove outward relative velocity (px/s), shared by inverse mass.
    const rel = (velX(h) - velX(H)) * nx + (velY(h) - velY(H)) * ny;
    if (rel > 0) {
      const j = rel / total;
      const k = 1 / Dangle.World.PER_SEC;
      M.Body.setVelocity(H, { x: (velX(H) + nx * j * invH) * k, y: (velY(H) + ny * j * invH) * k });
      if (invh > 0) {
        M.Body.setVelocity(h, { x: (velX(h) - nx * j * invh) * k, y: (velY(h) - ny * j * invh) * k });
      }
    }
  }

  function clampSpeed(b, maxSpeed) {
    const vx = velX(b);
    const vy = velY(b);
    const sp = Math.hypot(vx, vy);
    if (sp > maxSpeed) {
      const k = maxSpeed / sp / Dangle.World.PER_SEC;
      M.Body.setVelocity(b, { x: vx * k, y: vy * k });
    }
  }

  function finite(b) {
    return isFinite(b.position.x) && isFinite(b.position.y) && isFinite(b.positionPrev.x) && isFinite(b.positionPrev.y) && isFinite(b.angle);
  }

  // NaN / out-of-bounds / broken-constraint check. Returns true when the player is sane.
  function healthy(p) {
    const c = cfg();
    for (const b of p.bodies) {
      if (!finite(b)) return false;
      if (Math.abs(b.position.x) > c.WORLD_LIMIT || b.position.y > c.KILL_Y || b.position.y < -c.WORLD_LIMIT) return false;
    }
    const far = c.REACH * 3;
    for (const h of p.hands) {
      if (Math.hypot(h.position.x - p.head.position.x, h.position.y - p.head.position.y) > far) return false;
    }
    return true;
  }

  function postStep(W, p, dt) {
    const c = cfg();
    if (!healthy(p)) { respawn(W, p); return; }
    // Two passes so chained players settle each other's limits.
    for (let pass = 0; pass < 2; pass++) { limitArm(p, LEFT); limitArm(p, RIGHT); }
    clampSpeed(p.head, c.MAX_HEAD_SPEED);
    clampSpeed(p.hands[0], c.MAX_HAND_SPEED);
    clampSpeed(p.hands[1], c.MAX_HAND_SPEED);
    // Angular damping so the head doesn't spin forever.
    const damp = Math.exp(-c.HEAD_ANG_DAMP * dt);
    M.Body.setAngularVelocity(p.head, M.Body.getAngularVelocity(p.head) * damp);
  }

  function respawn(W, p) {
    const c = cfg();
    Dangle.Grab.releaseAll(W, p);
    Dangle.Grab.releaseTargeting(W, p.bodies);
    Dangle.World.teleport(p.head, p.spawn.x, p.spawn.y);
    Dangle.World.teleport(p.hands[0], p.spawn.x - c.ARM_RELAX_X, p.spawn.y + c.ARM_RELAX_Y);
    Dangle.World.teleport(p.hands[1], p.spawn.x + c.ARM_RELAX_X, p.spawn.y + c.ARM_RELAX_Y);
    M.Body.setAngle(p.head, 0);
    p.head._pa = 0;
    p.popT = 0.4;
    p.respawns++;
  }

  Dangle.Player = { create, applyConfig, preStep, postStep, respawn, velX, velY, LEFT, RIGHT };
})();
