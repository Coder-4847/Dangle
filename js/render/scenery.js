// Sparse, deterministic scenery accents per theme, placed on the tops of level blocks. Purely visual:
// nothing here has a body. "back" items stand behind the geometry in pale colours (so they never read
// as something to grab), "front" items are small and sit on the surface edge.
window.Dangle = window.Dangle || {};

(function () {
  const C = () => Dangle.Crayon;
  const BACK = { bush: 1, stalk: 1, cactus: 1, pine: 1, column: 1, gear: 1, cloud: 1, bunting: 1 };

  // Items: { kind, x, y (surface), s (scale), seed, back, bbox: {x0,y0,x1,y1} }
  function generate(W, theme, seed) {
    const c = Dangle.config;
    const R = c.REACH;
    const rnd = C().rng(seed);
    const avoid = [];
    const spec = W.level && W.level.spec;
    if (spec) {
      for (const s of spec.spawns) avoid.push(s.x);
      for (const k of spec.checkpoints) avoid.push(k.x);
      avoid.push(spec.goal.x + spec.goal.w / 2);
    }
    const solids = W.drawables.filter((b) => b.isStatic && !b.dg.mover);
    const covered = (x, y) => solids.some((b) => Matter.Vertices.contains(b.vertices, { x, y }));
    const items = [];
    for (const b of solids) {
      if (b.angle !== 0 || (b.dg.kind !== 'ground' && b.dg.kind !== 'ice')) continue;
      const x0 = b.bounds.min.x + 30;
      const x1 = b.bounds.max.x - 30;
      const y = b.bounds.min.y;
      if (y < -6000 || x1 - x0 < 40) continue;
      for (let x = x0 + rnd() * 1.2 * R; x < x1; x += (1.6 + rnd() * 2.6) * R) {
        if (covered(x, y - 6) || avoid.some((a) => Math.abs(a - x) < 0.6 * R)) continue;
        const kind = theme.scenery[Math.floor(rnd() * theme.scenery.length)];
        const s = 0.8 + rnd() * 0.45;
        const back = !!BACK[kind];
        const size = back ? (kind === 'stalk' || kind === 'pine' ? 3.4 * R : kind === 'cloud' ? 1.2 * R : 1.6 * R) : 0.5 * R;
        const lift = kind === 'cloud' ? 2.6 * R : 0;
        items.push({ kind, x, y: y - lift, s, seed: Math.floor(rnd() * 1e9), back,
          bbox: { x0: x - size * s, x1: x + size * s, y0: y - lift - size * s * 1.3, y1: y - lift + 20 } });
      }
    }
    return items;
  }

  function blades(g, x, y, s, color, n, h) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * 4 * s;
      g.beginPath(); g.moveTo(x + dx, y + 2); g.quadraticCurveTo(x + dx * 1.4, y - h * 0.6 * s, x + dx * 2.1, y - h * s); g.stroke();
    }
  }
  function blob(g, x, y, r, color, seed) { g.fillStyle = color; g.fill(C().blobPath(x, y, r, seed, r * 0.06)); }

  // Every drawer works in world coords at (x, y) = point on the surface.
  const DRAW = {
    tuft(g, it, t) { blades(g, it.x, it.y, it.s, t.sc[0], 5, 16); },
    leafy(g, it, t) { blades(g, it.x, it.y, it.s, t.sc[1], 4, 13); },
    flower(g, it, t) {
      const { x, y, s } = it;
      blades(g, x, y, s, t.sc[0], 2, 10);
      g.strokeStyle = t.sc[0]; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 20 * s); g.stroke();
      const col = it.seed % 2 ? t.sc[1] : t.sc[2];
      for (let k = 0; k < 5; k++) { const a = k * 1.256; blob(g, x + 2 + Math.cos(a) * 5 * s, y - 20 * s + Math.sin(a) * 5 * s, 3.6 * s, col, it.seed + k); }
      blob(g, x + 2, y - 20 * s, 2.6 * s, '#fff3c4', it.seed);
    },
    bush(g, it, t) {
      const col = C().shade(t.sc[0], 0.35);
      for (let k = 0; k < 3; k++) blob(g, it.x + (k - 1) * 22 * it.s, it.y - (k === 1 ? 26 : 16) * it.s, (k === 1 ? 26 : 20) * it.s, col, it.seed + k);
    },
    stalk(g, it, t) {
      const h = (2.4 + (it.seed % 100) / 60) * Dangle.config.REACH * it.s;
      const col = C().shade(t.sc[0], 0.2);
      g.fillStyle = col;
      g.fillRect(it.x - 7, it.y - h, 14, h);
      g.strokeStyle = C().shade(t.sc[0], -0.1); g.lineWidth = 2.5;
      for (let y = it.y - 40; y > it.y - h; y -= 46) { g.beginPath(); g.moveTo(it.x - 8, y); g.lineTo(it.x + 8, y); g.stroke(); }
      g.fillStyle = C().shade(t.sc[1], 0.3);
      g.beginPath(); g.ellipse(it.x + 18, it.y - h * 0.62, 18, 6, -0.5, 0, 6.28); g.fill();
    },
    crystal(g, it, t) {
      for (let k = 0; k < 3; k++) {
        const x = it.x + (k - 1) * 9 * it.s, h = (18 + k * 7 % 13) * it.s;
        g.beginPath(); g.moveTo(x - 5 * it.s, it.y + 2); g.lineTo(x, it.y - h); g.lineTo(x + 5 * it.s, it.y + 2); g.closePath();
        g.fillStyle = t.sc[0]; g.fill(); g.strokeStyle = C().shade(t.sc[0], -0.35); g.lineWidth = 2; g.stroke();
      }
    },
    lantern(g, it, t) {
      g.strokeStyle = t.post; g.lineWidth = 3;
      g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(it.x, it.y - 34); g.lineTo(it.x + 10, it.y - 34); g.stroke();
      blob(g, it.x + 10, it.y - 26, 7, t.sc[1], it.seed);
      g.strokeStyle = C().shade(t.sc[1], -0.4); g.lineWidth = 2; g.stroke(C().blobPath(it.x + 10, it.y - 26, 7, it.seed, 0.4));
    },
    shroom(g, it, t) {
      g.fillStyle = '#efe6d8'; g.fillRect(it.x - 3, it.y - 12 * it.s, 6, 12 * it.s);
      g.beginPath(); g.ellipse(it.x, it.y - 12 * it.s, 11 * it.s, 7 * it.s, 0, Math.PI, 0); g.fillStyle = t.sc[2]; g.fill();
    },
    saltcube(g, it, t) {
      for (let k = 0; k < 3; k++) {
        const sz = (7 + k * 3) * it.s;
        g.save(); g.translate(it.x + (k - 1) * 11 * it.s, it.y - sz / 2); g.rotate((it.seed % 7 + k) * 0.3);
        g.fillStyle = t.sc[0]; g.fillRect(-sz / 2, -sz / 2, sz, sz); g.strokeStyle = '#c9b89a'; g.lineWidth = 1.5; g.strokeRect(-sz / 2, -sz / 2, sz, sz);
        g.restore();
      }
    },
    cactus(g, it, t) {
      const col = C().shade(t.sc[1], 0.35);
      g.strokeStyle = col; g.lineCap = 'round';
      g.lineWidth = 16 * it.s; g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(it.x, it.y - 70 * it.s); g.stroke();
      g.lineWidth = 10 * it.s; g.beginPath(); g.moveTo(it.x, it.y - 30 * it.s); g.lineTo(it.x + 18 * it.s, it.y - 32 * it.s); g.lineTo(it.x + 18 * it.s, it.y - 52 * it.s); g.stroke();
    },
    pebble(g, it, t) {
      blob(g, it.x - 6, it.y - 3, 5 * it.s, t.sc[2], it.seed);
      blob(g, it.x + 5, it.y - 2, 3.5 * it.s, C().shade(t.sc[2], 0.2), it.seed + 1);
    },
    pine(g, it, t) {
      const col = C().shade(t.sc[0], 0.45);
      const h = 2.2 * Dangle.config.REACH * it.s;
      g.fillStyle = C().shade(t.post, 0.4); g.fillRect(it.x - 5, it.y - 24, 10, 24);
      g.fillStyle = col;
      for (let k = 0; k < 3; k++) {
        const w = (48 - k * 12) * it.s, top = it.y - 20 - (k + 1) * h / 3.2;
        g.beginPath(); g.moveTo(it.x - w, top + h / 2.6); g.lineTo(it.x, top); g.lineTo(it.x + w, top + h / 2.6); g.closePath(); g.fill();
      }
    },
    snowball(g, it) { blob(g, it.x - 6, it.y - 6, 8 * it.s, '#ffffff', it.seed); blob(g, it.x + 7, it.y - 4, 5 * it.s, '#f4f9fc', it.seed + 1); },
    column(g, it, t) {
      const col = C().shade(t.sc[0], 0.15);
      const h = 1.5 * Dangle.config.REACH * it.s;
      g.fillStyle = col; g.fillRect(it.x - 16, it.y - h, 32, h);
      g.fillRect(it.x - 22, it.y - 12, 44, 12);
      g.beginPath(); g.moveTo(it.x - 16, it.y - h); g.lineTo(it.x - 4, it.y - h - 14); g.lineTo(it.x + 16, it.y - h - 4); g.lineTo(it.x + 16, it.y - h); g.fill();
      g.strokeStyle = C().shade(t.sc[0], -0.12); g.lineWidth = 2;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(it.x + k * 8, it.y - 12); g.lineTo(it.x + k * 8, it.y - h + 4); g.stroke(); }
    },
    shell(g, it, t) {
      g.fillStyle = t.sc[1];
      g.beginPath(); g.moveTo(it.x, it.y); g.arc(it.x, it.y, 9 * it.s, Math.PI, 0); g.closePath(); g.fill();
      g.strokeStyle = C().shade(t.sc[1], -0.3); g.lineWidth = 1.5;
      for (let k = 1; k < 4; k++) { const a = Math.PI + k * Math.PI / 4; g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(it.x + Math.cos(a) * 9 * it.s, it.y + Math.sin(a) * 9 * it.s); g.stroke(); }
    },
    weed(g, it, t) {
      g.strokeStyle = t.sc[2]; g.lineWidth = 3.5; g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const x = it.x + (k - 1) * 7;
        g.beginPath(); g.moveTo(x, it.y); g.bezierCurveTo(x + 8, it.y - 10, x - 8, it.y - 20, x + 2, it.y - (26 + k * 5) * it.s); g.stroke();
      }
    },
    gear(g, it, t) {
      const r = 0.9 * Dangle.config.REACH * it.s;
      const cx = it.x, cy = it.y - r * 0.55;
      g.fillStyle = C().shade(t.sc[0], 0.2);
      g.beginPath();
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; const rr = k % 2 ? r : r * 0.84; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = C().shade(t.sc[0], 0.45); g.beginPath(); g.arc(cx, cy, r * 0.3, 0, 6.28); g.fill();
    },
    bolt(g, it, t) {
      g.fillStyle = t.sc[1]; g.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(it.x + Math.cos(a) * 6, it.y - 6 + Math.sin(a) * 6); }
      g.closePath(); g.fill();
      g.fillStyle = t.sc[0]; g.beginPath(); g.arc(it.x, it.y - 6, 2.2, 0, 6.28); g.fill();
    },
    cloud(g, it) {
      for (let k = 0; k < 4; k++) blob(g, it.x + (k - 1.5) * 24 * it.s, it.y - (k % 2 ? 14 : 4) * it.s, (k % 2 ? 26 : 20) * it.s, 'rgba(255,255,255,0.85)', it.seed + k);
    },
    ember(g, it, t) {
      g.fillStyle = 'rgba(255,154,74,0.25)'; g.beginPath(); g.arc(it.x, it.y - 4, 12 * it.s, 0, 6.28); g.fill();
      for (let k = 0; k < 3; k++) blob(g, it.x + (k - 1) * 6, it.y - 3 - (k % 2) * 4, 2.6, t.sc[0], it.seed + k);
    },
    stump(g, it, t) {
      g.fillStyle = t.sc[1];
      g.beginPath(); g.moveTo(it.x - 10, it.y); g.lineTo(it.x - 8, it.y - 18 * it.s); g.lineTo(it.x - 1, it.y - 14 * it.s); g.lineTo(it.x + 3, it.y - 22 * it.s); g.lineTo(it.x + 9, it.y - 16 * it.s); g.lineTo(it.x + 11, it.y); g.closePath(); g.fill();
    },
    bunting(g, it, t) {
      const w = 1.4 * Dangle.config.REACH * it.s;
      const h = 1.1 * Dangle.config.REACH;
      g.strokeStyle = C().shade(t.post, 0.3); g.lineWidth = 3;
      g.beginPath(); g.moveTo(it.x - w / 2, it.y); g.lineTo(it.x - w / 2, it.y - h); g.moveTo(it.x + w / 2, it.y); g.lineTo(it.x + w / 2, it.y - h); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(it.x - w / 2, it.y - h); g.quadraticCurveTo(it.x, it.y - h + 22, it.x + w / 2, it.y - h); g.stroke();
      for (let k = 1; k < 6; k++) {
        const u = k / 6, x = it.x - w / 2 + w * u, y = it.y - h + 22 * 2 * u * (1 - u) * 2 - 2;
        g.fillStyle = C().shade(t.sc[k % 3], 0.25);
        g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.lineTo(x, y + 14); g.closePath(); g.fill();
      }
    },
  };

  function draw(g, it, theme) { const f = DRAW[it.kind]; if (f) f(g, it, theme); }

  Dangle.Scenery = { generate, draw, kinds: Object.keys(DRAW) };
})();
