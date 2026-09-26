// Menu manager: screen registry, back-stack navigation, eased slide/fade transitions, and input
// routing (keyboard, gamepad and mouse all become the same actions). Screens live in screens.js /
// screens-play.js; this file knows nothing about what they show.
//
// Screen interface: { enter(params), leave?(), update(dt, actions), draw(ctx, t), theme?(): themeId,
//                     onMove?(x, y), onClick?(x, y), overlay?: true (drawn over the running game) }
// Draw callbacks work in 1280x720 virtual coordinates; the manager applies the letterbox transform.
window.Dangle = window.Dangle || {};

Dangle.Menu = (function () {
  const screens = {};
  const history = [];
  const M = {
    cur: null, curName: '', params: null,
    trans: null,                  // { from, to, dir, t }
    t: 0,                         // seconds since the manager started (drives idle animation)
    themeId: 'meadow',
    fit: { s: 1, ox: 0, oy: 0 },
    over: false,                  // true while the game is running behind the menu (pause, complete)
    viewW: 1280, viewH: 720,
  };
  const DUR = 0.34;

  function register(name, screen) { screens[name] = screen; screen.name = name; }

  function enterScreen(name, params) {
    const s = screens[name];
    if (!s) throw new Error('no menu screen ' + name);
    M.cur = s; M.curName = name; M.params = params || {};
    if (s.enter) s.enter(M.params);
    if (s.theme) M.themeId = s.theme();
    Dangle.Input.clearMenuInput();
  }

  function transition(name, params, dir) {
    const from = M.cur;
    if (from && from.leave) from.leave();
    if (!from) { enterScreen(name, params); return; }
    enterScreen(name, params);
    M.trans = { from, fromParams: M.params, to: M.cur, dir, t: 0 };
  }

  // Forward: remember where we came from so back() can return.
  function go(name, params) {
    if (M.cur && M.curName) history.push({ name: M.curName, params: M.params });
    transition(name, params, 1);
  }
  function replace(name, params) { transition(name, params, 1); }
  function back() {
    const h = history.pop();
    if (!h) return false;
    transition(h.name, h.params, -1);
    return true;
  }
  // Open a screen as the first one (no history), e.g. title, or an overlay on the game.
  function open(name, params, over) {
    history.length = 0;
    M.over = !!over;
    M.trans = null;
    if (M.cur && M.cur.leave) M.cur.leave();
    enterScreen(name, params);
  }
  // Jump straight to a screen with its history already in place (no slide): e.g. levels, with campaigns behind it.
  function openPath(path, over) {
    history.length = 0;
    M.over = !!over;
    M.trans = null;
    if (M.cur && M.cur.leave) M.cur.leave();
    for (let i = 0; i < path.length - 1; i++) history.push({ name: path[i][0], params: path[i][1] || {} });
    enterScreen(path[path.length - 1][0], path[path.length - 1][1]);
  }
  function close() {
    if (M.cur && M.cur.leave) M.cur.leave();
    M.cur = null; M.curName = ''; M.trans = null; M.over = false;
    history.length = 0;
  }
  function isOpen() { return !!M.cur; }

  function toVirtual(px, py) { return { x: (px - M.fit.ox) / M.fit.s, y: (py - M.fit.oy) / M.fit.s }; }

  function update(dt, actions) {
    M.t += dt;
    Dangle.Scene.tickPuppets(dt);
    if (M.trans) {
      M.trans.t += dt / DUR;
      if (M.trans.t >= 1) M.trans = null;
    }
    if (!M.cur) return;
    const locked = M.trans && M.trans.t < 0.55;           // early input near the end of a slide still counts
    const click = Dangle.Input.takeClick();
    const moved = Dangle.Input.takeMoved();
    if (locked) return;
    if (moved && M.cur.onMove) { const p = toVirtual(Dangle.Input.pointer.x, Dangle.Input.pointer.y); M.cur.onMove(p.x, p.y); }
    if (click && M.cur.onClick) { const p = toVirtual(click.x, click.y); M.cur.onClick(p.x, p.y); }
    M.cur.update(dt, actions || []);
  }

  function drawScreen(ctx, dpr, s, offX, alpha) {
    ctx.save();
    ctx.setTransform(dpr * M.fit.s, 0, 0, dpr * M.fit.s, dpr * (M.fit.ox + offX * M.fit.s), dpr * M.fit.oy);
    ctx.globalAlpha = alpha;
    s.draw(ctx, M.t);
    ctx.restore();
  }

  function draw(ctx, viewW, viewH, dpr) {
    if (!M.cur) return;
    M.viewW = viewW; M.viewH = viewH;
    Dangle.Ui.fit(viewW, viewH, M.fit);
    if (M.over) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(253,240,220,0.55)';
      ctx.fillRect(0, 0, viewW, viewH);
    } else {
      Dangle.Scene.backdrop(ctx, viewW, viewH, dpr, M.fit, M.t, M.themeId);
    }
    const tr = M.trans;
    if (tr) {
      const e = Dangle.Ui.ease.inOutCubic(Math.min(1, tr.t));
      drawScreen(ctx, dpr, tr.from, -tr.dir * e * 70, 1 - e);
      drawScreen(ctx, dpr, tr.to, tr.dir * (1 - e) * 70, e);
    } else drawScreen(ctx, dpr, M.cur, 0, 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- helpers for screens ---------------------------------------------------------------------
  // Move a selection through `count` items laid out `cols` per row. Returns the new index.
  function moveSel(sel, count, cols, action) {
    const row = Math.floor(sel / cols), col = sel % cols;
    if (action === 'left' && col > 0) return sel - 1;
    if (action === 'right' && col < cols - 1 && sel + 1 < count) return sel + 1;
    if (action === 'up' && row > 0) return sel - cols;
    if (action === 'down' && sel + cols < count) return sel + cols;
    if (action === 'down' && row < Math.floor((count - 1) / cols)) return count - 1;   // short last row
    return sel;
  }
  // Which of these rects contains the virtual point? (items have x, y, w, h)
  function hit(items, x, y) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) return i;
    }
    return -1;
  }

  return { register, go, replace, back, open, openPath, close, isOpen, update, draw, moveSel, hit, toVirtual, state: M, screens };
})();
