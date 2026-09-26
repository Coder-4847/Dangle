// Menu screens, part 1: title, main menu, character select, campaign select, level select.
// (Settings, controls, pause, level complete and how-to-play are in screens-play.js.)
window.Dangle = window.Dangle || {};

(function () {
  const M = () => Dangle.Menu;
  const U = () => Dangle.Ui;
  const S = () => Dangle.Session;
  const T = () => Dangle.Type;
  const INK = '#3a3a48';
  const fmt = (t) => Dangle.Hud.fmtTime(t);

  function animateFocus(items, sel, dt) { items.forEach((it, i) => { it.f = U().approach(it.f || 0, i === sel ? 1 : 0, 16, dt); }); }
  function modeLabel() { return S().state.mode === 'coop' ? 'Co-op' : 'Solo'; }

  // ---- title ---------------------------------------------------------------------------------
  M().register('title', {
    theme: () => 'meadow',
    enter() { this.age = 0; },
    update(dt, actions) {
      this.age += dt;
      if (this.age > 0.25 && (actions.indexOf('any') >= 0 || actions.indexOf('confirm') >= 0)) M().go('main');
    },
    onClick() { if (this.age > 0.25) M().go('main'); },
    draw(ctx, t) {
      const chars = Dangle.Characters.list;
      const set = Dangle.Storage.getSettings().chars;
      Dangle.Scene.dangler(ctx, t, 'title-l', chars[set[0] % chars.length], 120, 0, 1, 'idle', 400);
      Dangle.Scene.dangler(ctx, t, 'title-r', chars[set[1] % chars.length], 1160, 2, 1, 'grab', 400);
      Dangle.Scene.logo(ctx, t, 640, 84);
      const pulse = 1 + Math.sin(t * 3.2) * 0.04;
      ctx.save(); ctx.translate(640, 520); ctx.scale(pulse, pulse);
      T().text(ctx, Dangle.Input.padCount() > 0 ? 'Press A' : 'Press Enter', 0, 0, 46, { align: 'center', fill: '#fff6e4', stroke: '#8a5a2b' });
      ctx.restore();
      if (Dangle.Storage.dev) T().text(ctx, 'DEV', 1230, 60, 30, { align: 'right', fill: '#f26b8a', stroke: '#8a2a44' });
      if (!Dangle.Storage.persistent) T().text(ctx, "Progress can't be saved in this browser mode", 640, 690, 24, { align: 'center', fill: '#fff6e4', stroke: '#8a5a2b' });
    },
  });

  // ---- a vertical list of big buttons (used by main and pause) ------------------------------------
  function listScreen(cfg) {
    return {
      overlay: cfg.overlay,
      theme: cfg.theme || (() => 'meadow'),
      enter(params) {
        this.params = params || {};
        this.items = cfg.items(this.params);
        this.sel = Math.min(this.params.sel || 0, this.items.length - 1);
        this.layout();
        this.items.forEach((it, i) => { it.f = i === this.sel ? 1 : 0; });
      },
      layout() {
        const n = this.items.length, w = cfg.w || 440, h = cfg.h || 82, gap = 22;
        const top = (cfg.top !== undefined ? cfg.top : 360 - (n * (h + gap) - gap) / 2);
        this.items.forEach((it, i) => { it.x = 640 - w / 2 + (cfg.dx || 0); it.y = top + i * (h + gap); it.w = w; it.h = h; it.seed = 11 + i; });
      },
      update(dt, actions) {
        for (const a of actions) {
          if (a === 'up' || a === 'down') { this.sel = M().moveSel(this.sel, this.items.length, 1, a); }
          else if (a === 'confirm') this.pick(this.sel);
          else if (a === 'back' || (a === 'pause' && cfg.pauseCloses)) { if (cfg.onBack) cfg.onBack(this.params); else M().back(); }
        }
        animateFocus(this.items, this.sel, dt);
      },
      pick(i) { const it = this.items[i]; if (it.locked) return; cfg.onPick(it, this.params); },
      onMove(x, y) { const i = M().hit(this.items, x, y); if (i >= 0) this.sel = i; },
      onClick(x, y) { const i = M().hit(this.items, x, y); if (i >= 0) { this.sel = i; this.pick(i); } },
      draw(ctx, t) {
        if (cfg.drawBefore) cfg.drawBefore(ctx, t, this);
        for (const it of this.items) U().button(ctx, it, t);
        if (cfg.drawAfter) cfg.drawAfter(ctx, t, this);
      },
    };
  }
  Dangle.Screens = { listScreen, animateFocus };

  // ---- main menu -----------------------------------------------------------------------------------
  M().register('main', listScreen({
    dx: 0,
    items() {
      const st = Dangle.Storage;
      const count = (mode) => { let d = 0; for (let c = 1; c <= 10; c++) d += st.campaignProgress(mode, c).done; return d; };
      return [
        { label: 'Solo', color: '#f3c46a', id: 'solo', sub: count('solo') + ' / 75' },
        { label: 'Co-op', color: '#8fd3b0', id: 'coop', sub: count('coop') + ' / 75' },
        { label: 'How to play', color: '#9fc4ef', id: 'howto' },
        { label: 'Settings', color: '#e9b1c6', id: 'settings' },
      ];
    },
    onPick(it) {
      if (it.id === 'solo' || it.id === 'coop') { S().state.mode = it.id; M().go('chars', { player: 0 }); }
      else if (it.id === 'howto') S().startHowTo();
      else M().go('settings');
    },
    onBack() { M().back(); },
    drawBefore(ctx, t) {
      const chars = Dangle.Characters.list, set = Dangle.Storage.getSettings().chars;
      Dangle.Scene.dangler(ctx, t, 'main-l', chars[set[0] % chars.length], 170, 0.4, 0.85, 'idle', 330);
      Dangle.Scene.dangler(ctx, t, 'main-r', chars[set[1] % chars.length], 1110, 2.2, 0.85, 'idle', 330);
    },
    drawAfter(ctx, t, scr) {
      for (const it of scr.items) if (it.sub) T().text(ctx, it.sub, it.x + it.w - 26, it.y + it.h / 2 + 12, 26, { align: 'right', fill: '#6b6b7a', stroke: 'rgba(255,255,255,0.7)' });
    },
  }));

  // ---- character select ---------------------------------------------------------------------------
  M().register('chars', {
    theme: () => 'meadow',
    enter(params) {
      this.player = params.player || 0;
      this.coop = S().state.mode === 'coop';
      const set = Dangle.Storage.getSettings();
      this.cards = Dangle.Characters.list.map((c, i) => ({ x: 70 + i * 194, y: 432, w: 170, h: 214, f: 0, seed: 20 + i }));
      this.sel = set.chars[this.player] % this.cards.length;
      this.cards.forEach((c, i) => { c.f = i === this.sel ? 1 : 0; });
    },
    takenBy(i) { return this.coop && this.player === 1 && Dangle.Storage.getSettings().chars[0] === i; },
    pick(i) {
      if (this.takenBy(i)) return;
      const set = Dangle.Storage.getSettings();
      set.chars[this.player] = i;
      Dangle.Storage.saveSettings();
      if (this.coop && this.player === 0) {
        // Player 2 starts on the next free character.
        if (set.chars[1] === i) set.chars[1] = (i + 1) % this.cards.length;
        M().replace('chars', { player: 1 });
      } else M().go('campaigns');
    },
    update(dt, actions) {
      for (const a of actions) {
        if (a === 'left' || a === 'right') {
          let next = this.sel;
          do { next = (next + (a === 'left' ? -1 : 1) + this.cards.length) % this.cards.length; } while (this.takenBy(next) && next !== this.sel);
          this.sel = next;
        } else if (a === 'confirm') this.pick(this.sel);
        else if (a === 'back') { if (this.coop && this.player === 1) M().replace('chars', { player: 0 }); else M().back(); }
      }
      animateFocus(this.cards, this.sel, dt);
    },
    onMove(x, y) { const i = M().hit(this.cards, x, y); if (i >= 0 && !this.takenBy(i)) this.sel = i; },
    onClick(x, y) { const i = M().hit(this.cards, x, y); if (i >= 0) { this.sel = i; this.pick(i); } },
    draw(ctx, t) {
      const chars = Dangle.Characters.list;
      const cols = ['#f2a03d', '#5fc4a8'];
      const label = this.coop ? `Player ${this.player + 1}` : 'Choose your character';
      T().text(ctx, label, 640, 92, 58, { align: 'center', fill: this.coop ? cols[this.player] : '#fff6e4', stroke: INK });
      Dangle.Scene.dangler(ctx, t, 'sel' + this.player, chars[this.sel], 1130, 0.3, 0.8, 'grab', 200);
      this.cards.forEach((c, i) => {
        const ch = chars[i];
        const taken = this.takenBy(i);
        U().panel(ctx, c.x, c.y, c.w, c.h, taken ? '#d9d0be' : U().shade(ch.body, 0.55), taken ? '#9b917f' : ch.dark, c.seed, { scale: 1 + 0.07 * c.f });
        const hs = Dangle.CharArt.headSprite(ch, 3);
        ctx.save(); ctx.translate(c.x + c.w / 2, c.y + 100); ctx.scale(1.55 + 0.12 * c.f, 1.55 + 0.12 * c.f); ctx.globalAlpha = taken ? 0.4 : 1;
        ctx.drawImage(hs.canvas, -hs.ox, -hs.oy, hs.w, hs.h); ctx.restore(); ctx.globalAlpha = 1;
        T().text(ctx, ch.name, c.x + c.w / 2, c.y + c.h - 24, 32, { align: 'center', fill: taken ? '#8c8474' : INK, stroke: '#fff6e4' });
        if (taken) T().text(ctx, 'P1', c.x + c.w - 30, c.y + 40, 30, { align: 'center', fill: cols[0], stroke: INK });
        if (c.f > 0.05) { ctx.globalAlpha = c.f; U().arrow(ctx, c.x + c.w / 2, c.y - 24 + Math.sin(t * 6) * 3, 14, 'down', INK); ctx.globalAlpha = 1; }
      });
    },
  });

  // ---- campaign select ------------------------------------------------------------------------------
  M().register('campaigns', {
    theme() { return this.cards ? Dangle.Campaigns.list[this.sel].theme : 'meadow'; },
    enter() {
      const mode = S().state.mode;
      this.mode = mode;
      const list = Dangle.Campaigns.list;
      this.cards = list.map((c, i) => ({ x: 61 + (i % 5) * 236, y: 160 + Math.floor(i / 5) * 240, w: 214, h: 214, f: 0, seed: 30 + i }));
      // Start on the campaign you are working on.
      this.sel = Math.max(0, Math.min(list.length - 1, S().state.c ? S().state.c - 1 : Dangle.Storage.nextUp(mode).c - 1));
      if (!Dangle.Storage.campaignUnlocked(mode, this.sel + 1)) this.sel = Dangle.Storage.nextUp(mode).c - 1;
      this.cards.forEach((c, i) => { c.f = i === this.sel ? 1 : 0; });
      this.shake = 0;
      Dangle.Menu.state.themeId = list[this.sel].theme;
    },
    pick(i) {
      if (!Dangle.Storage.campaignUnlocked(this.mode, i + 1)) { this.shake = 0.35; return; }
      S().state.c = i + 1;
      M().go('levels');
    },
    update(dt, actions) {
      for (const a of actions) {
        if (['left', 'right', 'up', 'down'].indexOf(a) >= 0) { this.sel = M().moveSel(this.sel, this.cards.length, 5, a); Dangle.Menu.state.themeId = Dangle.Campaigns.list[this.sel].theme; }
        else if (a === 'confirm') this.pick(this.sel);
        else if (a === 'back') M().back();
      }
      this.shake = Math.max(0, this.shake - dt);
      animateFocus(this.cards, this.sel, dt);
    },
    onMove(x, y) { const i = M().hit(this.cards, x, y); if (i >= 0 && i !== this.sel) { this.sel = i; Dangle.Menu.state.themeId = Dangle.Campaigns.list[i].theme; } },
    onClick(x, y) { const i = M().hit(this.cards, x, y); if (i >= 0) { this.sel = i; this.pick(i); } },
    draw(ctx, t) {
      const list = Dangle.Campaigns.list;
      T().text(ctx, modeLabel() + ' campaigns', 640, 92, 54, { align: 'center', fill: '#fff6e4', stroke: INK });
      list.forEach((camp, i) => {
        const c = this.cards[i];
        const theme = Dangle.Themes.get(camp.theme);
        const unlocked = Dangle.Storage.campaignUnlocked(this.mode, camp.id);
        const prog = Dangle.Storage.campaignProgress(this.mode, camp.id);
        const wob = i === this.sel && this.shake > 0 ? Math.sin(this.shake * 60) * 8 * this.shake : 0;
        const fill = unlocked ? theme.ground[0] : '#cfc6b4';
        ctx.save(); ctx.translate(wob, 0);
        U().panel(ctx, c.x, c.y, c.w, c.h, fill, unlocked ? theme.ground[1] : '#9b917f', c.seed, { scale: 1 + 0.06 * c.f });
        // Name over two lines.
        const words = camp.name.split(' ');
        const half = Math.ceil(words.length / 2);
        const lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')].filter(Boolean);
        lines.forEach((ln, k) => T().text(ctx, ln, c.x + c.w / 2, c.y + 88 + k * 34, 30, { align: 'center', fill: unlocked ? INK : '#8c8474', stroke: unlocked ? U().shade(fill, 0.6) : '#e6dfd0' }));
        T().text(ctx, String(camp.id), c.x + 34, c.y + 50, 40, { align: 'center', fill: unlocked ? theme.accent : '#9b917f', stroke: INK });
        if (unlocked) {
          // One pip per level: filled when done.
          const n = camp.levels, pw = n === 5 ? 24 : 15, gap = n === 5 ? 8 : 5;
          const total = n * pw + (n - 1) * gap;
          for (let k = 0; k < n; k++) {
            const px = c.x + c.w / 2 - total / 2 + k * (pw + gap) + pw / 2, py = c.y + c.h - 50;
            ctx.fillStyle = k < prog.done ? theme.accent : 'rgba(255,255,255,0.55)';
            ctx.strokeStyle = INK; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(px, py, pw / 2, 0, 6.28); ctx.fill(); ctx.stroke();
          }
          if (prog.clean > 0) { U().star(ctx, c.x + c.w - 36, c.y + 42, 15, true); T().text(ctx, String(prog.clean), c.x + c.w - 36, c.y + 86, 22, { align: 'center', fill: INK, stroke: '#fff6e4' }); }
        } else U().lock(ctx, c.x + c.w / 2, c.y + c.h - 52, 34, '#8c8474');
        ctx.restore();
        if (c.f > 0.05) { ctx.globalAlpha = c.f; U().arrow(ctx, c.x + c.w / 2, c.y - 16 + Math.sin(t * 6) * 3, 12, 'down', INK); ctx.globalAlpha = 1; }
      });
      const camp = list[this.sel];
      const unlocked = Dangle.Storage.campaignUnlocked(this.mode, camp.id);
      const line = unlocked ? camp.idea : 'Finish ' + list[this.sel - 1].name + ' first';
      T().text(ctx, line, 640, 676, 34, { align: 'center', fill: '#fff6e4', stroke: INK });
    },
  });

  // ---- level select ---------------------------------------------------------------------------------
  M().register('levels', {
    theme() { return Dangle.Campaigns.list[(S().state.c || 1) - 1].theme; },
    enter() {
      const st = S().state;
      this.mode = st.mode; this.c = st.c;
      const camp = Dangle.Campaigns.list[this.c - 1];
      this.camp = camp;
      this.tiles = [];
      const cols = 5, rows = Math.ceil(camp.levels / cols);
      const w = 200, h = 176, gapX = 30, gapY = 34;
      const x0 = 640 - (cols * w + (cols - 1) * gapX) / 2;
      const y0 = rows === 1 ? 260 : 190;
      for (let n = 1; n <= camp.levels; n++) {
        const i = n - 1;
        this.tiles.push({ x: x0 + (i % cols) * (w + gapX), y: y0 + Math.floor(i / cols) * (h + gapY), w, h, f: 0, n, seed: 50 + n });
      }
      // Highlight the first unfinished unlocked level (or the one just played).
      let sel = 0;
      if (st.n && st.n <= camp.levels && Dangle.Storage.levelUnlocked(this.mode, this.c, st.n)) sel = st.n - 1;
      else for (let n = 1; n <= camp.levels; n++) if (Dangle.Storage.levelUnlocked(this.mode, this.c, n)) { sel = n - 1; if (!Dangle.Storage.isDone(this.mode, Dangle.Campaigns.levelId(this.mode, this.c, n))) break; }
      this.sel = sel;
      this.shake = 0;
      this.tiles.forEach((t, i) => { t.f = i === sel ? 1 : 0; });
    },
    pick(i) {
      const n = i + 1;
      if (!Dangle.Storage.levelUnlocked(this.mode, this.c, n)) { this.shake = 0.35; return; }
      S().play(this.mode, this.c, n);
    },
    update(dt, actions) {
      for (const a of actions) {
        if (['left', 'right', 'up', 'down'].indexOf(a) >= 0) this.sel = M().moveSel(this.sel, this.tiles.length, 5, a);
        else if (a === 'confirm') this.pick(this.sel);
        else if (a === 'back') M().back();
      }
      this.shake = Math.max(0, this.shake - dt);
      animateFocus(this.tiles, this.sel, dt);
    },
    onMove(x, y) { const i = M().hit(this.tiles, x, y); if (i >= 0) this.sel = i; },
    onClick(x, y) { const i = M().hit(this.tiles, x, y); if (i >= 0) { this.sel = i; this.pick(i); } },
    draw(ctx, t) {
      const theme = Dangle.Themes.get(this.camp.theme);
      T().text(ctx, this.camp.name, 640, 96, 58, { align: 'center', fill: '#fff6e4', stroke: INK });
      T().text(ctx, modeLabel() + '   ' + this.camp.levels + ' levels', 640, 140, 28, { align: 'center', fill: '#fff6e4', stroke: INK });
      this.tiles.forEach((tile, i) => {
        const id = Dangle.Campaigns.levelId(this.mode, this.c, tile.n);
        const unlocked = Dangle.Storage.levelUnlocked(this.mode, this.c, tile.n);
        const rec = Dangle.Storage.record(this.mode, id);
        const wob = i === this.sel && this.shake > 0 ? Math.sin(this.shake * 60) * 8 * this.shake : 0;
        const fill = unlocked ? (rec && rec.done ? U().shade(theme.ground[0], 0.25) : theme.ground[0]) : '#cfc6b4';
        ctx.save(); ctx.translate(wob, 0);
        U().panel(ctx, tile.x, tile.y, tile.w, tile.h, fill, unlocked ? theme.ground[1] : '#9b917f', tile.seed, { scale: 1 + 0.07 * tile.f });
        T().text(ctx, String(tile.n), tile.x + tile.w / 2, tile.y + 92, 76, { align: 'center', fill: unlocked ? INK : '#8c8474', stroke: unlocked ? U().shade(fill, 0.6) : '#e6dfd0' });
        if (!unlocked) U().lock(ctx, tile.x + tile.w / 2, tile.y + tile.h - 40, 30, '#8c8474');
        else if (rec && rec.done) {
          U().check(ctx, tile.x + 34, tile.y + 38, 14);
          if (rec.clean) U().star(ctx, tile.x + tile.w - 34, tile.y + 36, 16, true);
          T().text(ctx, fmt(rec.best), tile.x + tile.w / 2, tile.y + tile.h - 26, 28, { align: 'center', fill: INK, stroke: U().shade(fill, 0.6) });
        } else T().text(ctx, 'new', tile.x + tile.w / 2, tile.y + tile.h - 26, 26, { align: 'center', fill: theme.accent, stroke: INK });
        ctx.restore();
        if (tile.f > 0.05) { ctx.globalAlpha = tile.f; U().arrow(ctx, tile.x + tile.w / 2, tile.y - 18 + Math.sin(t * 6) * 3, 13, 'down', INK); ctx.globalAlpha = 1; }
      });
      const prev = this.sel > 0 ? 'Finish level ' + this.sel + ' first' : '';
      if (!Dangle.Storage.levelUnlocked(this.mode, this.c, this.sel + 1) && prev) T().text(ctx, prev, 640, 676, 34, { align: 'center', fill: '#fff6e4', stroke: INK });
    },
  });
})();
