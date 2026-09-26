// Character art: head sprites (body, cheeks, head feature) and glove sprites, built once per
// character/resolution and cached. Faces (eyes, brows, mouth) are drawn live on top in draw-player.js.
window.Dangle = window.Dangle || {};

(function () {
  const C = () => Dangle.Crayon;
  const cache = new Map();
  const HEAD_PAD = 8;
  const HAT_ROOM = 30;

  function visualR() { return Dangle.config.HEAD_RADIUS + 2; }

  // Head feature, drawn in head-local coords (centre 0,0; top of head at y = -r).
  const HATS = {
    sprout(g, r, ch) {
      g.strokeStyle = C().shade(ch.hatColor, -0.3); g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -r + 2); g.quadraticCurveTo(2, -r - 8, 0, -r - 14); g.stroke();
      for (const s of [-1, 1]) {
        g.save(); g.translate(0, -r - 13); g.rotate(s * 0.7);
        g.beginPath(); g.ellipse(s * 8, 0, 9, 4.5, 0, 0, Math.PI * 2);
        g.fillStyle = ch.hatColor; g.fill(); g.strokeStyle = C().shade(ch.hatColor, -0.35); g.lineWidth = 2; g.stroke();
        g.restore();
      }
    },
    beanie(g, r, ch) {
      const p = new Path2D();
      p.moveTo(-r * 0.92, -r * 0.35);
      p.bezierCurveTo(-r * 0.95, -r * 1.35, r * 0.95, -r * 1.35, r * 0.92, -r * 0.35);
      p.closePath();
      g.fillStyle = ch.hatColor; g.fill(p);
      g.save(); g.clip(p);
      g.fillStyle = C().shade(ch.hatColor, -0.18); g.fillRect(-r, -r * 0.55, 2 * r, r * 0.25);
      g.strokeStyle = C().shade(ch.hatColor, 0.25); g.lineWidth = 2;
      for (let x = -r; x < r; x += 6) { g.beginPath(); g.moveTo(x, -r * 0.62); g.lineTo(x, -r * 1.3); g.stroke(); }
      g.restore();
      g.strokeStyle = C().shade(ch.hatColor, -0.4); g.lineWidth = 2.5; g.stroke(p);
      g.fillStyle = '#fff4e6'; g.fill(C().blobPath(0, -r * 1.12, 6.5, 11, 0.8));
    },
    bow(g, r, ch) {
      g.save(); g.translate(r * 0.45, -r * 0.85); g.rotate(0.35);
      g.fillStyle = ch.hatColor; g.strokeStyle = C().shade(ch.hatColor, -0.4); g.lineWidth = 2;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 12, -8); g.quadraticCurveTo(s * 15, 0, s * 12, 8); g.closePath(); g.fill(); g.stroke();
      }
      g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    },
    propeller(g, r, ch) {
      const p = new Path2D();
      p.moveTo(-r * 0.8, -r * 0.45); p.bezierCurveTo(-r * 0.8, -r * 1.2, r * 0.8, -r * 1.2, r * 0.8, -r * 0.45); p.closePath();
      g.fillStyle = ch.hatColor; g.fill(p);
      g.save(); g.clip(p); g.fillStyle = '#f2c94c'; g.fillRect(-r * 0.12, -r * 1.2, r * 0.24, r); g.restore();
      g.strokeStyle = C().shade(ch.hatColor, -0.4); g.lineWidth = 2.5; g.stroke(p);
      g.lineWidth = 3; g.beginPath(); g.moveTo(0, -r * 1.05); g.lineTo(0, -r * 1.3); g.stroke();
      g.fillStyle = '#e8544a';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 10, -r * 1.32, 10, 3.5, s * 0.12, 0, Math.PI * 2); g.fill(); }
    },
    daisy(g, r) {
      for (const [x, y, sz] of [[-r * 0.55, -r * 0.8, 1], [0, -r * 1.02, 1.15], [r * 0.55, -r * 0.8, 1]]) {
        g.fillStyle = '#ffffff';
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.ellipse(x + Math.cos(a) * 4.5 * sz, y + Math.sin(a) * 4.5 * sz, 3.4 * sz, 2.2 * sz, a, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(x, y, 2.8 * sz, 0, Math.PI * 2); g.fill();
      }
    },
    headband(g, r, ch, head) {
      g.save(); g.clip(head);
      g.fillStyle = ch.hatColor; g.fillRect(-r - 2, -r * 0.62, 2 * r + 4, 9);
      g.fillStyle = '#ffffff'; g.fillRect(-r - 2, -r * 0.62 + 3.5, 2 * r + 4, 2);
      g.restore();
      g.fillStyle = ch.hatColor;
      g.beginPath(); g.moveTo(r * 0.9, -r * 0.55); g.lineTo(r * 1.35, -r * 0.8); g.lineTo(r * 1.3, -r * 0.45); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(r * 0.9, -r * 0.5); g.lineTo(r * 1.3, -r * 0.25); g.lineTo(r * 1.1, -r * 0.15); g.closePath(); g.fill();
    },
  };

  function headSprite(ch, res) {
    const key = 'h:' + ch.id + ':' + res;
    let s = cache.get(key);
    if (s) return s;
    const r = visualR();
    const w = 2 * (r + HEAD_PAD + 10);
    const h = r + HEAD_PAD + r + HAT_ROOM + HEAD_PAD;
    s = C().sprite(w, h, res, (g) => {
      g.translate(w / 2, HAT_ROOM + r + HEAD_PAD);
      const head = C().blobPath(0, 0, r, ch.id.length * 31 + 7, 0.9);
      g.fillStyle = ch.body; g.fill(head);
      g.save(); g.clip(head);
      g.fillStyle = C().shade(ch.body, -0.1); g.beginPath(); g.ellipse(0, r * 0.75, r * 1.2, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = C().shade(ch.body, 0.25); g.beginPath(); g.ellipse(-r * 0.35, -r * 0.5, r * 0.35, r * 0.22, -0.5, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.55; g.fillStyle = ch.cheek;
      g.beginPath(); g.ellipse(-r * 0.58, r * 0.28, 5, 3.5, 0, 0, Math.PI * 2); g.ellipse(r * 0.58, r * 0.28, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      C().grain(g, -w / 2, -h, w, 2 * h, 0.9);
      C().outline(g, head, ch.dark, 3);
      if (HATS[ch.hat]) HATS[ch.hat](g, r, ch, head);
    });
    s.ox = w / 2;                    // where the head centre sits inside the sprite
    s.oy = HAT_ROOM + r + HEAD_PAD;
    cache.set(key, s);
    return s;
  }

  // Glove sprites point along +x (wrist on the left). closed = gripping fist.
  function gloveSprite(side, closed, res) {
    const key = 'g:' + side + ':' + (closed ? 1 : 0) + ':' + res;
    let s = cache.get(key);
    if (s) return s;
    const col = Dangle.Characters.GLOVES[side];
    const R = Dangle.config.HAND_RADIUS + 2.5;
    const W = 4 * R, H = 3.4 * R;
    s = C().sprite(W, H, res, (g) => {
      g.translate(W * 0.45, H / 2);
      // Cuff.
      g.fillStyle = '#fbf3e4';
      g.fill(C().toPath(C().wobble(C().rectPts(-R * 1.45, -R * 0.62, R * 0.7, R * 1.24), 17 + side, { amp: 0.5, radius: 3, step: 6 })));
      const hand = closed ? C().blobPath(0, 0, R * 0.95, 41 + side, 0.6) : C().toPath(C().wobble(
        [{ x: -R * 0.8, y: -R * 0.75 }, { x: R * 0.55, y: -R * 0.95 }, { x: R * 1.25, y: -R * 0.35 }, { x: R * 1.25, y: R * 0.45 }, { x: R * 0.4, y: R * 0.95 }, { x: -R * 0.8, y: R * 0.8 }],
        53 + side, { amp: 0.5, radius: 6, step: 6 }));
      const thumb = C().blobPath(closed ? R * 0.1 : -R * 0.05, -R * (closed ? 0.8 : 1.05), R * 0.42, 61 + side, 0.4);
      g.fillStyle = col.fill; g.fill(hand); g.fill(thumb);
      g.save(); g.clip(hand); g.fillStyle = C().shade(col.fill, 0.28); g.beginPath(); g.ellipse(R * 0.1, -R * 0.35, R * 0.6, R * 0.25, 0, 0, Math.PI * 2); g.fill(); g.restore();
      C().grain(g, -W, -H, 2 * W, 2 * H, 0.8);
      C().outline(g, hand, col.dark, 2.4);
      C().outline(g, thumb, col.dark, 2);
      g.strokeStyle = col.dark; g.lineWidth = 1.8; g.lineCap = 'round';
      if (closed) { g.beginPath(); g.moveTo(R * 0.55, -R * 0.3); g.lineTo(R * 0.7, R * 0.05); g.moveTo(R * 0.4, R * 0.3); g.lineTo(R * 0.55, R * 0.6); g.stroke(); }
      else { g.beginPath(); g.moveTo(R * 0.55, -R * 0.1); g.lineTo(R * 1.05, -R * 0.1); g.moveTo(R * 0.5, R * 0.35); g.lineTo(R, R * 0.35); g.stroke(); }
    });
    s.ox = W * 0.45; s.oy = H / 2;
    cache.set(key, s);
    return s;
  }

  Dangle.CharArt = { headSprite, gloveSprite, visualR, hats: Object.keys(HATS) };
})();
