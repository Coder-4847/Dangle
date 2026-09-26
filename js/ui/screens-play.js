// Menu screens, part 2: settings, controls (reference + device assignment), confirm dialog, pause menu,
// level-complete screen. Depends on screens.js (listScreen, animateFocus).
window.Dangle = window.Dangle || {};

(function () {
  const M = () => Dangle.Menu;
  const U = () => Dangle.Ui;
  const S = () => Dangle.Session;
  const T = () => Dangle.Type;
  const ST = () => Dangle.Storage;
  const INK = '#3a3a48';
  const fmt = (t) => Dangle.Hud.fmtTime(t);
  const animateFocus = (a, b, c) => Dangle.Screens.animateFocus(a, b, c);
  const bgTheme = () => (M().state.over ? (S().state.themeId || 'meadow') : 'meadow');

  // ---- settings ------------------------------------------------------------------------------------
  const SETTING_ROWS = [
    { key: 'volume', label: 'Volume', kind: 'slider' },
    { key: 'toggleGrab', label: 'Tap to grab, tap to let go', kind: 'toggle' },
    { key: 'assist', label: 'Grab assist', kind: 'toggle' },
    { key: 'reduceShake', label: 'Reduce screen shake', kind: 'toggle' },
    { key: 'mouseAim', label: 'Mouse aim (player 1)', kind: 'toggle' },
    { key: 'controls', label: 'Controls', kind: 'link' },
    { key: 'erase', label: 'Erase progress', kind: 'link' },
    { key: 'back', label: 'Back', kind: 'link' },
  ];

  M().register('settings', {
    theme: bgTheme,
    enter() {
      this.rows = SETTING_ROWS.map((r, i) => ({ x: 250, y: 92 + i * 68, w: 780, h: 58, f: 0, seed: 70 + i, def: r }));
      this.sel = 0;
      this.rows.forEach((r, i) => { r.f = i === 0 ? 1 : 0; });
    },
    activate(i) {
      const r = this.rows[i].def;
      const set = ST().getSettings();
      if (r.kind === 'toggle') { set[r.key] = !set[r.key]; this.changed(); }
      else if (r.key === 'controls') M().go('controls');
      else if (r.key === 'erase') M().go('confirm', { text: 'Erase all progress?', yes: 'Erase', onYes: () => { ST().reset(); M().back(); } });
      else if (r.key === 'back') M().back();
    },
    changed() { ST().saveSettings(); S().applySettings(); },
    update(dt, actions) {
      const set = ST().getSettings();
      for (const a of actions) {
        const r = this.rows[this.sel].def;
        if (a === 'up' || a === 'down') this.sel = M().moveSel(this.sel, this.rows.length, 1, a);
        else if (a === 'confirm') this.activate(this.sel);
        else if (a === 'back' || a === 'pause') M().back();
        else if (a === 'left' || a === 'right') {
          if (r.kind === 'slider') { set[r.key] = Math.min(1, Math.max(0, Math.round((set[r.key] + (a === 'left' ? -0.05 : 0.05)) * 100) / 100)); this.changed(); }
          else if (r.kind === 'toggle') { const want = a === 'right'; if (set[r.key] !== want) { set[r.key] = want; this.changed(); } }
        }
      }
      animateFocus(this.rows, this.sel, dt);
    },
    onMove(x, y) { const i = M().hit(this.rows, x, y); if (i >= 0) this.sel = i; },
    onClick(x, y) {
      const i = M().hit(this.rows, x, y);
      if (i < 0) return;
      this.sel = i;
      const r = this.rows[i].def, row = this.rows[i];
      if (r.kind === 'slider') {
        const v = Math.min(1, Math.max(0, (x - (row.x + 460)) / 280));
        ST().getSettings()[r.key] = Math.round(v * 20) / 20; this.changed();
      } else this.activate(i);
    },
    draw(ctx, t) {
      const set = ST().getSettings();
      T().text(ctx, 'Settings', 640, 66, 46, { align: 'center', fill: '#fff6e4', stroke: INK });
      this.rows.forEach((row, i) => {
        const r = row.def;
        U().panel(ctx, row.x, row.y + 4, row.w, row.h, U().shade('#f3e2bd', 0.1 + 0.15 * row.f), '#a88a4f', row.seed, { scale: 1 + 0.02 * row.f });
        T().text(ctx, r.label, row.x + 34, row.y + 42, 30, { fill: INK, stroke: '#fff6e4' });
        if (r.kind === 'slider') {
          U().slider(ctx, row.x + 460, row.y + 34, 280, set[r.key], row.f, '#4a8fe0');
          T().text(ctx, Math.round(set[r.key] * 100) + '%', row.x + row.w - 20, row.y + 44, 24, { align: 'right', fill: INK, stroke: '#fff6e4' });
        } else if (r.kind === 'toggle') U().toggle(ctx, row.x + row.w - 120, row.y + 34, !!set[r.key], row.f);
        else if (r.key !== 'back') U().arrow(ctx, row.x + row.w - 40, row.y + 34, 12, 'right', INK);
        if (row.f > 0.05) { ctx.globalAlpha = row.f; U().cursor(ctx, row.x - 30, row.y + 34, t); ctx.globalAlpha = 1; }
      });
      if (!ST().persistent) T().text(ctx, "Settings can't be saved in this browser mode", 640, 690, 24, { align: 'center', fill: '#c0392b', stroke: '#fff6e4' });
    },
  });

  // ---- controls ------------------------------------------------------------------------------------
  const KB_OPTS = ['auto', 'wasd', 'ijkl', 'none'];
  const KB_NAMES = { auto: 'Automatic', wasd: 'WASD / arrows', ijkl: 'IJKL', none: 'Off' };
  const PAD_OPTS = ['auto', 0, 1, 2, 3, 'none'];

  function keycap(ctx, x, y, label, lit, w) {
    w = w || 46;
    U().panel(ctx, x - w / 2, y - 22, w, 44, lit ? '#f2c94c' : '#fff6e4', '#8a7a5a', label.charCodeAt(0) + w, { radius: 8 });
    T().text(ctx, label, x, y + 10, 24, { align: 'center', fill: INK, stroke: lit ? '#fff0b8' : '#fff6e4', wobble: 0 });
  }

  M().register('controls', {
    theme: bgTheme,
    enter() {
      const labels = ['Player 1 keyboard', 'Player 1 gamepad', 'Player 2 keyboard', 'Player 2 gamepad', 'Back'];
      this.rows = labels.map((l, i) => ({ x: 170, y: 84 + i * 62, w: 940, h: 54, f: 0, seed: 90 + i, label: l, pl: i >> 1, kind: i === 4 ? 'back' : (i % 2 ? 'pad' : 'kb') }));
      this.sel = 0;
      this.rows.forEach((r, i) => { r.f = i === 0 ? 1 : 0; });
    },
    cycle(row, dir) {
      const c = ST().getSettings().controls[row.pl];
      const opts = row.kind === 'kb' ? KB_OPTS : PAD_OPTS;
      const key = row.kind === 'kb' ? 'kb' : 'pad';
      const i = opts.indexOf(c[key]);
      c[key] = opts[(i + dir + opts.length) % opts.length];
      ST().saveSettings(); S().applySettings();
    },
    update(dt, actions) {
      for (const a of actions) {
        const row = this.rows[this.sel];
        if (a === 'up' || a === 'down') this.sel = M().moveSel(this.sel, this.rows.length, 1, a);
        else if (a === 'left' && row.kind !== 'back') this.cycle(row, -1);
        else if (a === 'right' && row.kind !== 'back') this.cycle(row, 1);
        else if (a === 'confirm') { if (row.kind === 'back') M().back(); else this.cycle(row, 1); }
        else if (a === 'back' || a === 'pause') M().back();
      }
      animateFocus(this.rows, this.sel, dt);
    },
    onMove(x, y) { const i = M().hit(this.rows, x, y); if (i >= 0) this.sel = i; },
    onClick(x, y) { const i = M().hit(this.rows, x, y); if (i >= 0) { this.sel = i; const r = this.rows[i]; if (r.kind === 'back') M().back(); else this.cycle(r, 1); } },
    draw(ctx, t) {
      const set = ST().getSettings();
      T().text(ctx, 'Controls', 640, 62, 44, { align: 'center', fill: '#fff6e4', stroke: INK });
      this.rows.forEach((row) => {
        U().panel(ctx, row.x, row.y, row.w, row.h, U().shade('#f3e2bd', 0.1 + 0.15 * row.f), '#a88a4f', row.seed, { scale: 1 + 0.02 * row.f });
        T().text(ctx, row.label, row.x + 30, row.y + 38, 28, { fill: INK, stroke: '#fff6e4' });
        if (row.kind !== 'back') {
          const v = set.controls[row.pl][row.kind === 'kb' ? 'kb' : 'pad'];
          let name;
          if (row.kind === 'kb') name = KB_NAMES[v];
          else if (v === 'none') name = 'Off';
          else { const slot = v === 'auto' ? row.pl : v; const pn = Dangle.Input.padName(slot); name = (v === 'auto' ? 'Automatic' : 'Pad ' + (v + 1)) + (pn ? '  (' + pn + ')' : '  (not connected)'); }
          U().arrow(ctx, row.x + 460, row.y + 27, 10, 'left', INK);
          T().text(ctx, name, row.x + 640, row.y + 38, 26, { align: 'center', fill: '#6b3d2e', stroke: '#fff6e4' });
          U().arrow(ctx, row.x + row.w - 30, row.y + 27, 10, 'right', INK);
        }
        if (row.f > 0.05) { ctx.globalAlpha = row.f; U().cursor(ctx, row.x - 30, row.y + 27, t); ctx.globalAlpha = 1; }
      });
      // Reference: both keyboards and the gamepad, keys lighting up as you press them.
      const down = Dangle.Input.isDown;
      const KB = Dangle.Input.schemes;
      const drawKb = (cx, title, sc, extra) => {
        T().text(ctx, title, cx, 452, 26, { align: 'center', fill: '#fff6e4', stroke: INK });
        keycap(ctx, cx, 500, sc.up[0].slice(3), sc.up.some(down));
        keycap(ctx, cx - 52, 552, sc.left[0].slice(3), sc.left.some(down));
        keycap(ctx, cx, 552, sc.down[0].slice(3), sc.down.some(down));
        keycap(ctx, cx + 52, 552, sc.right[0].slice(3), sc.right.some(down));
        keycap(ctx, cx - 130, 552, sc.grabL[0].slice(3), sc.grabL.some(down));
        keycap(ctx, cx + 130, 552, sc.grabR[0].slice(3), sc.grabR.some(down));
        const g0 = Dangle.CharArt.gloveSprite(0, false, 3), g1 = Dangle.CharArt.gloveSprite(1, false, 3);
        ctx.save(); ctx.translate(cx - 130, 606); ctx.scale(0.9, 0.9); ctx.drawImage(g0.canvas, -g0.ox, -g0.oy, g0.w, g0.h); ctx.restore();
        ctx.save(); ctx.translate(cx + 130, 606); ctx.scale(0.9, 0.9); ctx.drawImage(g1.canvas, -g1.ox, -g1.oy, g1.w, g1.h); ctx.restore();
        T().text(ctx, 'aim', cx, 606, 22, { align: 'center', fill: '#fff6e4', stroke: INK });
      };
      drawKb(230, 'Keyboard 1  (or arrows)', KB.wasd);
      drawKb(640, 'Keyboard 2', KB.ijkl);
      // Gamepad: stick aims, bumpers grab.
      const px = 1040;
      T().text(ctx, 'Gamepad', px, 452, 26, { align: 'center', fill: '#fff6e4', stroke: INK });
      const anyPad = Dangle.Input.padCount() > 0;
      U().panel(ctx, px - 110, 480, 220, 110, '#e8e1d2', '#8a7a5a', 97, { radius: 40 });
      ctx.fillStyle = '#7a7a8a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px - 54, 530, 20, 0, 6.28); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + 54, 542, 14, 0, 6.28); ctx.fill(); ctx.stroke();
      const g0 = Dangle.CharArt.gloveSprite(0, false, 3), g1 = Dangle.CharArt.gloveSprite(1, false, 3);
      ctx.save(); ctx.translate(px - 82, 486); ctx.scale(0.7, 0.7); ctx.drawImage(g0.canvas, -g0.ox, -g0.oy, g0.w, g0.h); ctx.restore();
      ctx.save(); ctx.translate(px + 82, 486); ctx.scale(0.7, 0.7); ctx.drawImage(g1.canvas, -g1.ox, -g1.oy, g1.w, g1.h); ctx.restore();
      T().text(ctx, 'LB', px - 82, 470, 18, { align: 'center', fill: INK, stroke: '#fff6e4' });
      T().text(ctx, 'RB', px + 82, 470, 18, { align: 'center', fill: INK, stroke: '#fff6e4' });
      T().text(ctx, 'aim', px - 54, 606, 22, { align: 'center', fill: '#fff6e4', stroke: INK });
      if (!anyPad) T().text(ctx, 'none connected', px, 640, 20, { align: 'center', fill: '#fff6e4', stroke: INK });
      T().text(ctx, 'Two players on one keyboard can block each other\'s keys: gamepads are best', 640, 690, 21, { align: 'center', fill: '#fff6e4', stroke: INK });
    },
  });

  // ---- confirm dialog ------------------------------------------------------------------------------
  M().register('confirm', {
    theme: bgTheme,
    enter(params) {
      this.p = params;
      this.btns = [
        { x: 400, y: 380, w: 210, h: 78, label: 'Cancel', color: '#9fc4ef', f: 1, seed: 1 },
        { x: 670, y: 380, w: 210, h: 78, label: params.yes || 'Yes', color: '#e8837a', f: 0, seed: 2 },
      ];
      this.sel = 0;
    },
    update(dt, actions) {
      for (const a of actions) {
        if (a === 'left' || a === 'right') this.sel = M().moveSel(this.sel, 2, 2, a);
        else if (a === 'confirm') this.pick(this.sel);
        else if (a === 'back') M().back();
      }
      animateFocus(this.btns, this.sel, dt);
    },
    pick(i) { if (i === 1) this.p.onYes(); else M().back(); },
    onMove(x, y) { const i = M().hit(this.btns, x, y); if (i >= 0) this.sel = i; },
    onClick(x, y) { const i = M().hit(this.btns, x, y); if (i >= 0) { this.sel = i; this.pick(i); } },
    draw(ctx, t) {
      U().panel(ctx, 320, 250, 640, 260, '#fdf0dc', '#a88a4f', 5, { radius: 24 });
      T().text(ctx, this.p.text, 640, 340, 44, { align: 'center', fill: INK, stroke: '#fff6e4' });
      for (const b of this.btns) U().button(ctx, b, t);
    },
  });

  // ---- pause ---------------------------------------------------------------------------------------
  M().register('pause', Dangle.Screens.listScreen({
    overlay: true, w: 420, h: 72, top: 176, theme: bgTheme, pauseCloses: true,
    items() {
      return [
        { label: 'Resume', color: '#8fd3b0', id: 'resume' },
        { label: 'Restart', color: '#f3c46a', id: 'restart' },
        { label: 'Settings', color: '#e9b1c6', id: 'settings' },
        { label: 'Levels', color: '#9fc4ef', id: 'levels' },
        { label: 'Title', color: '#d9c7e8', id: 'title' },
      ];
    },
    onPick(it) {
      if (it.id === 'resume') S().resume();
      else if (it.id === 'restart') S().restart();
      else if (it.id === 'settings') M().go('settings');
      else if (it.id === 'levels') S().toLevels();
      else S().toTitle();
    },
    onBack() { S().resume(); },
    drawBefore(ctx) { T().text(ctx, 'Paused', 640, 120, 66, { align: 'center', fill: '#fff6e4', stroke: INK }); },
  }));

  // ---- level complete ----------------------------------------------------------------------------
  M().register('complete', {
    theme: bgTheme,
    enter(params) {
      this.p = params;
      const P = params;
      const nextInCamp = P.n < Dangle.Campaigns.list[P.c - 1].levels;
      const nextCamp = !nextInCamp && P.c < Dangle.Campaigns.list.length;
      this.btns = [
        { label: nextInCamp ? 'Next level' : nextCamp ? 'Next campaign' : 'Levels', id: nextInCamp ? 'next' : nextCamp ? 'nextcamp' : 'levels', color: '#8fd3b0' },
        { label: 'Retry', id: 'retry', color: '#f3c46a' },
        { label: 'Levels', id: 'levels', color: '#9fc4ef' },
      ].filter((b, i, arr) => !(i === 2 && arr[0].id === 'levels'));
      const w = 250, gap = 24, total = this.btns.length * w + (this.btns.length - 1) * gap;
      this.btns.forEach((b, i) => { b.x = 640 - total / 2 + i * (w + gap); b.y = 520; b.w = w; b.h = 80; b.f = i === 0 ? 1 : 0; b.seed = 60 + i; });
      this.sel = 0;
      this.age = 0;
      this.campDone = Dangle.Storage.campaignDone(P.mode, P.c);
    },
    pick(i) {
      const b = this.btns[i], P = this.p;
      if (b.id === 'next') S().play(P.mode, P.c, P.n + 1);
      else if (b.id === 'nextcamp') S().play(P.mode, P.c + 1, 1);
      else if (b.id === 'retry') S().restart();
      else S().toLevels();
    },
    update(dt, actions) {
      this.age += dt;
      for (const a of actions) {
        if (a === 'left' || a === 'right') this.sel = M().moveSel(this.sel, this.btns.length, this.btns.length, a);
        else if (a === 'confirm' && this.age > 0.35) this.pick(this.sel);
        else if (a === 'back' && this.age > 0.35) S().toLevels();
      }
      animateFocus(this.btns, this.sel, dt);
    },
    onMove(x, y) { const i = M().hit(this.btns, x, y); if (i >= 0) this.sel = i; },
    onClick(x, y) { const i = M().hit(this.btns, x, y); if (i >= 0 && this.age > 0.35) { this.sel = i; this.pick(i); } },
    draw(ctx, t) {
      const P = this.p, R = P.result;
      const pop = U().ease.outBack(Math.min(1, this.age / 0.5));
      ctx.save(); ctx.translate(640, 140); ctx.scale(pop, pop);
      U().panel(ctx, -330, -20, 660, 330, '#fdf0dc', '#a88a4f', 8, { radius: 26 });
      T().text(ctx, this.campDone && P.n === Dangle.Campaigns.list[P.c - 1].levels ? 'Campaign complete!' : 'Level complete!', 0, 60, 52, { align: 'center', fill: '#3f8f52', stroke: '#fff6e4' });
      T().text(ctx, fmt(R.time), 0, 150, 76, { align: 'center', fill: INK, stroke: '#fff6e4' });
      if (R.newBest && !R.first) T().text(ctx, 'New best!  (was ' + fmt(R.prevBest) + ')', 0, 198, 30, { align: 'center', fill: '#d9503f', stroke: '#fff6e4' });
      else if (R.first) T().text(ctx, 'First clear!', 0, 198, 30, { align: 'center', fill: '#d9503f', stroke: '#fff6e4' });
      else T().text(ctx, 'Best ' + fmt(R.best), 0, 198, 30, { align: 'center', fill: '#6b6b7a', stroke: '#fff6e4' });
      // Clean-run medal.
      U().star(ctx, 0, 262, R.clean ? 30 : 26, R.clean, '#f2c94c');
      T().text(ctx, R.clean ? 'No falls!' : 'No falls = star', 70, 272, 24, { fill: R.clean ? '#b8841c' : '#8c8474', stroke: '#fff6e4' });
      ctx.restore();
      if (this.age > 0.3) for (const b of this.btns) U().button(ctx, b, t);
    },
  });
})();
