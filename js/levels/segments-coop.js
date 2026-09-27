// Co-op obstacles (Phase 8): segments that need two players, driven by physics/devices.js (gate, counterweight
// lift, two-player heavy crate). The chain gap is `gap` with aid 'chain' (segments.js). Loaded after segments.js.
window.Dangle = window.Dangle || {};

(function () {
  const Segments = Dangle.Segments;
  const cfg = () => Dangle.config;
  const R = () => cfg().REACH;

  // ---------------------------------------------------------------- co-op obstacles (physics/devices.js)
  // Each records b.spec.coopTasks (what the linter and the co-op bots check). Numbers are REACH units; the "solo can't"
  // margins come from config.LINT (COOP_*).

  // A plate the partner stands on (a zone around a head resting on the floor at x..x+w).
  function plateAt(b, x, w, y) { return b.plate(x, y - R(), w, R()); }

  // Hold-open gate: a tall no-grab portcullis that lifts into its tower while someone stands on a plate. One plate well
  // before it (too far to reach the gate before it closes again), one just after it (to let the partner through).
  Segments.add('gate', 'right', (b, o) => {
    const r = R();
    const dist = (o.dist || 3.2) * r;              // near plate to gate
    const h = (o.h || 3) * r;
    const gw = 0.6 * r, pw = 0.9 * r;
    const x0 = b.x, y = b.y;
    const near = plateAt(b, x0 + 0.3 * r, pw, y);
    const gx = x0 + 0.3 * r + pw + dist;
    const far = plateAt(b, gx + gw + 1.0 * r, pw, y);           // room between gate and far plate for the one coming through
    const end = gx + gw + 1.0 * r + pw + 0.6 * r;
    b.block(x0, y, end - x0, b.D);
    b.block(gx - 12, y - 2 * h - 20, gw + 24, h + 20, 'noGrab');   // the tower the portcullis lifts into (hides it when open)
    b.device({ x: gx, y: y - h, w: gw, h, kind: 'noGrab', dx: 0, dy: -h, time: 0.6, plates: [near, far], handles: [], role: 'gate' });
    b.spec.coopTasks.push({ type: 'gate', x: gx, y, h: h / r, plateGap: dist / r, near: x0 + 0.3 * r, far: gx + gw + 1.0 * r, pw });
    b.x = end;
    b.markSafe();
  });

  // Counterweight lift: a platform in front of a tall no-grab wall rises while someone hangs on a grab handle. One
  // handle well back from the platform (the partner rides), one on top, well back from the edge (to bring them up).
  Segments.add('leverLift', 'right', (b, o) => {
    const r = R();
    const h = (o.h || 2.6) * r;
    const dist = (o.dist || 3.2) * r;              // bottom handle to platform
    const pw = 1.3 * r, bar = 0.5 * r, barY = 1.1 * r;
    const x0 = b.x, y = b.y;
    const hb = b.handle(x0 + 0.5 * r, y - barY - 24, bar, 24);
    const px = x0 + 0.5 * r + bar + dist;
    b.block(x0, y, px - x0, b.D);
    b.block(px, y + 32, pw, b.D - 32);                          // the platform rests in a slot, flush with the floor
    const top = 4.2 * r;                            // top ledge length (its handle is well back from the edge)
    const wx = px + pw;
    b.block(wx, y - h, top, b.D + h);
    b.block(wx - 24, y - h + 8, 24, h - 8, 'noGrab');
    const ht = b.handle(wx + top - 0.6 * r - bar, y - h - barY - 24, bar, 24);
    b.device({ x: px, y, w: pw - 26, h: 32, kind: 'ground', dx: 0, dy: -h, time: h / cfg().COOP_LIFT_SPEED, plates: [], handles: [hb, ht], role: 'lift' });
    b.spec.coopTasks.push({ type: 'lift', x: px, y, h: h / r, handleGap: dist / r, bottom: x0 + 0.5 * r, top: wx + top - 0.6 * r - bar, wx, bar });
    b.rise(h / r, 'coop');
    b.x = wx + top; b.y = y - h;
    b.floor(b.y);
    b.markSafe();
  });

  // Two-player heavy crate: a crate that only slides while both players grip it and push the same way; push it to the
  // foot of a tall no-grab wall and climb it. It starts too far out to reach the lip from.
  Segments.add('heavyCrate', 'right', (b, o) => {
    const r = R();
    const h = (o.h || 1.9) * r;
    const size = r;
    const run = (o.run || 2) * r;                  // how far the crate must travel
    const x0 = b.x, y = b.y;
    const cx0 = x0 + 0.9 * r + size / 2;
    const wx = cx0 + size / 2 + run;
    b.block(x0, y, wx - x0, b.D);
    b.block(wx, y - h, 2.2 * r, b.D + h);
    b.block(wx - 24, y - h + 8, 24, h - 8, 'noGrab');
    b.heavy(cx0, y - size / 2, size, cx0, wx - 24 - size / 2 - 1);
    b.spec.coopTasks.push({ type: 'heavy', x: cx0, y, h: h / r, run: run / r, wx, size });
    b.rise(h / r, 'coop');
    b.x = wx + 2.2 * r; b.y = y - h;
    b.floor(b.y);
    b.markSafe();
  });
})();
