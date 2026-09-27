// Entry point and session orchestrator. Owns the phases (menu / play / pause / complete), the world, the
// screen wipes between them, and result saving. Menus are in js/ui/*, gameplay in js/physics/*.
//   ?dev=1            unlock everything, debug overlay + tuning panel, L = next level, R = instant restart
//   ?level=<id>       skip the menus and play a level (campaign id like solo-2-3, test-h, sandbox, ...)
//   ?theme=<id>       draw any level in another campaign's theme (art preview)
//   ?stress=1         physics stress-test results; ?stress=<name> plays one scenario live
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const cfg = Dangle.config;
  const params = new URLSearchParams(location.search);
  const dev = params.get('dev') === '1';
  let viewW = 0;
  let viewH = 0;
  let dpr = 1;

  const stressParam = params.get('stress');
  if (stressParam === '1' || stressParam === 'all') { canvas.style.display = 'none'; Dangle.StressUI.showTable(); return; }
  const watchScenario = stressParam ? Dangle.Stress.find(stressParam) : null;
  let session = null;          // live stress scenario (drives inputs itself)
  let restartT = 0;

  Dangle.Storage.init({ dev });

  // ---- state -------------------------------------------------------------------------------------
  const state = {
    mode: 'solo', c: 0, n: 0,  // where we are in the campaign table (0 = none yet)
    levelId: '', themeId: 'meadow',
    phase: 'menu',             // 'menu' | 'play' | 'pause' | 'complete'
    howto: false,
    players: 1,
  };
  let W = null;
  let layer = null;            // pre-rendered static art for the current world
  let prewarm = false;         // render every visible tile on the first frame after a build
  let themeOverride = Dangle.Themes.ids().indexOf(params.get('theme')) >= 0 ? params.get('theme') : '';
  let debugOn = dev;
  let blurred = false;
  let loop = null;
  let renderMs = 0;
  let restartHold = 0;         // seconds R has been held (non-dev restart needs a short hold)
  let completeHandled = false;
  let completeShown = false;
  let wipe = null;             // { t, dir: 'out'|'in', fn }
  const targets = [];          // camera targets, reused every frame
  const tmp = { x: 0, y: 0, a: 0 };
  const RESTART_HOLD = 0.7;
  const WIPE = 0.24;

  // ---- viewport ------------------------------------------------------------------------------------
  function resize() {
    const old = dpr;
    dpr = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    Dangle.DrawPlayer.setResolution(dpr);
    Dangle.Type.setResolution(dpr);
    Dangle.Ui.setResolution(dpr);
    if (W && old !== dpr) buildArt();       // tiles are rendered for a pixel density
  }

  function buildArt() {
    if (layer) Dangle.LevelLayer.dispose(layer);
    layer = Dangle.LevelLayer.build(W, W.themeId, dpr);
    prewarm = true;
  }

  // ---- settings -> config ----------------------------------------------------------------------------
  function applySettings() {
    const s = Dangle.Storage.getSettings();
    cfg.TOGGLE_GRAB = s.toggleGrab;
    cfg.ASSIST = s.assist;
    cfg.SCREEN_SHAKE = !s.reduceShake;
    Dangle.Input.state.mouseEnabled = s.mouseAim;
    Dangle.Input.setAssignments(s.controls, state.players);
    Dangle.Input.resetToggles();
    if (Dangle.Audio && Dangle.Audio.setVolume) Dangle.Audio.setVolume(s.volume);
  }

  // ---- world lifecycle ---------------------------------------------------------------------------------
  function unloadWorld() {
    if (layer) { Dangle.LevelLayer.dispose(layer); layer = null; }
    if (W) { Dangle.Level.unload(W); W = null; }
    session = null;
  }

  // Build the world for a level id. players: 1 or 2.
  function loadWorld(id, players) {
    unloadWorld();
    const chars = Dangle.Storage.getSettings().chars;
    state.levelId = id;
    state.players = players;
    if (id === 'sandbox') {
      W = Dangle.Sandbox.build(players, chars);
      Dangle.Camera.setLevel(null);
    } else {
      const spec = Dangle.Levels.spec(id);
      W = Dangle.Level.load(spec, players, chars);
      Dangle.Camera.setLevel({ bounds: spec.bounds, goal: state.howto ? null : spec.goal, direction: spec.direction });
    }
    W.themeId = themeOverride || W.themeId || 'meadow';
    state.themeId = W.themeId;
    buildArt();
    Dangle.Fx.reset();
    Dangle.DrawLevel.resetFlags();
    applySettings();
    restartHold = 0;
    completeHandled = completeShown = false;
  }

  function startStress() {
    unloadWorld();
    session = Dangle.Stress.session(watchScenario);
    W = session.W;
    restartT = 2.5;
    Dangle.Camera.setLevel(null);
    W.themeId = themeOverride || 'meadow';
    buildArt();
  }

  // Cream wipe: cover the screen, run fn while covered, uncover.
  function doWipe(fn) {
    if (wipe) return;
    wipe = { t: 0, dir: 'out', fn };
  }

  function setPhase(p) {
    state.phase = p;
    if (loop) loop.setPaused(p !== 'play' || blurred);
  }

  // ---- what menus call ---------------------------------------------------------------------------------
  const Session = {
    state,
    applySettings,
    // Play a campaign level.
    play(mode, c, n) {
      const id = Dangle.Campaigns.levelId(mode, c, n);
      doWipe(() => {
        state.mode = mode; state.c = c; state.n = n; state.howto = false;
        Dangle.Menu.close();
        loadWorld(id, mode === 'coop' ? 2 : 1);
        setPhase('play');
      });
    },
    // Any level id (dev/testing): no unlock checks, one or two players.
    playId(id, players, instant) {
      const go = () => {
        const p = Dangle.Campaigns.parse(id);
        if (p) { state.mode = p.mode; state.c = p.c; state.n = p.n; } else { state.c = 0; state.n = 0; }
        state.howto = false;
        Dangle.Menu.close();
        loadWorld(id, players || (p && p.mode === 'coop' ? 2 : 1));
        setPhase('play');
      };
      if (instant) go(); else doWipe(go);
    },
    restart() {
      doWipe(() => { Dangle.Menu.close(); loadWorld(state.levelId, state.players); setPhase('play'); });
    },
    resume() { Dangle.Menu.close(); setPhase('play'); },
    pause() {
      if (state.phase !== 'play' || Dangle.Menu.isOpen()) return;
      setPhase('pause');
      Dangle.Menu.open('pause', {}, true);
    },
    // Back out to the level list of the current campaign (or the main menu if we came from elsewhere).
    toLevels() {
      doWipe(() => {
        unloadWorld();
        setPhase('menu');
        if (state.c) Dangle.Menu.openPath([['main'], ['campaigns'], ['levels']]);
        else Dangle.Menu.open('main');
      });
    },
    toTitle() { doWipe(() => { unloadWorld(); setPhase('menu'); Dangle.Menu.open('title'); }); },
    startHowTo() {
      doWipe(() => {
        state.howto = true;
        Dangle.Menu.close();
        loadWorld('howto', 1);
        setPhase('play');
      });
    },
    leaveHowTo() { doWipe(() => { state.howto = false; unloadWorld(); setPhase('menu'); Dangle.Menu.open('main'); }); },
  };
  Dangle.Session = Session;

  // The level after this one, for the dev L key: campaign order, then the registered test levels.
  function nextLevelId(id) {
    const p = Dangle.Campaigns.parse(id);
    if (p) {
      const camp = Dangle.Campaigns.list[p.c - 1];
      if (p.n < camp.levels) return Dangle.Campaigns.levelId(p.mode, p.c, p.n + 1);
      if (p.c < Dangle.Campaigns.list.length) return Dangle.Campaigns.levelId(p.mode, p.c + 1, 1);
      return Dangle.Levels.list().filter((d) => !d.hidden)[0].id;
    }
    const list = Dangle.Levels.list().filter((d) => !d.hidden).map((d) => d.id).concat(['sandbox']);
    const i = list.indexOf(id);
    return i >= 0 && i < list.length - 1 ? list[i + 1] : Dangle.Campaigns.levelId('solo', 1, 1);
  }

  // ---- level completion ---------------------------------------------------------------------------------
  function handleCompletion() {
    const L = W.level;
    if (!L || !L.complete) return;
    if (!completeHandled) {
      completeHandled = true;
      const p = Dangle.Campaigns.parse(state.levelId);
      const deaths = W.players.reduce((s, q) => s + q.deaths, 0);
      L.result = p && !state.howto
        ? Dangle.Storage.recordResult(p.mode, state.levelId, L.time, deaths)
        : { first: false, newBest: false, clean: deaths === 0, best: L.time, prevBest: 0 };
      L.result.time = L.time;
    }
    // Let the confetti and happy faces play for a moment, then show the results.
    if (!completeShown && L.t - L.completeT > 1.5 && state.phase === 'play' && !state.howto) {
      completeShown = true;
      const p = Dangle.Campaigns.parse(state.levelId);
      const res = { time: L.time, first: L.result.first, newBest: L.result.newBest, clean: L.result.clean, best: L.result.best, prevBest: L.result.prevBest };
      setPhase('complete');
      if (p) Dangle.Menu.open('complete', { mode: p.mode, c: p.c, n: p.n, result: res }, true);
      else Dangle.Menu.open('complete', { mode: 'solo', c: 1, n: 1, result: res, dev: true }, true);
    }
  }

  // ---- per frame -----------------------------------------------------------------------------------------
  function gameInput(dt, actions) {
    const I = Dangle.Input;
    if (actions.indexOf('pause') >= 0) {
      if (state.howto) Session.leaveHowTo(); else Session.pause();
    }
    // Restart: hold R (dev: a tap). A pad has Restart in the pause menu.
    if (dev) { if (I.takePressed('KeyR')) Session.restart(); }
    else if (I.isDown('KeyR')) { restartHold += dt; if (restartHold >= RESTART_HOLD) { restartHold = 0; Session.restart(); } }
    else restartHold = 0;
    if (dev && I.takePressed('KeyL')) Session.playId(nextLevelId(state.levelId), state.players);
    // The little pause button top-right.
    const click = I.takeClick();
    if (click && !state.howto && click.x > viewW - 60 && click.y < 60) Session.pause();
    if (!wipe) I.poll(W.players);          // a live stress scenario scripts the inputs itself
  }

  function frame(dt) {
    const I = Dangle.Input;
    const actions = I.menuActions(dt);
    if (I.takePressed('Backquote')) { debugOn = !debugOn; if (dev) Dangle.Tuning.setVisible(debugOn); }

    if (wipe) {
      wipe.t += dt;
      if (wipe.dir === 'out' && wipe.t >= WIPE) { wipe.fn(); wipe.dir = 'in'; wipe.t = 0; }
      else if (wipe.dir === 'in' && wipe.t >= WIPE) wipe = null;
    }
    const locked = !!wipe && wipe.dir === 'out';

    if (Dangle.Menu.isOpen()) Dangle.Menu.update(dt, locked ? [] : actions);
    else if (W && !locked) {
      if (session) I.menuActions(0);
      else if (state.phase === 'play') gameInput(dt, actions);
    } else if (!W) Dangle.Scene.tickPuppets(dt);

    if (W) {
      Dangle.Debug.tick(dt, W);
      Dangle.DrawPlayer.update(W, dt);
      Dangle.Fx.consume(W);
      if (W.level) W.level.events.length = 0;
      Dangle.Fx.update(dt);
      if (!session) handleCompletion();
      if (session && session.finished && (restartT -= dt) <= 0) startStress();
    }
  }

  function render(alpha, dt) {
    const t0 = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!W) {
      ctx.fillStyle = cfg.BG_COLOR;
      ctx.fillRect(0, 0, viewW, viewH);
      Dangle.Menu.draw(ctx, viewW, viewH, dpr);
    } else {
      ctx.fillStyle = cfg.BG_COLOR;
      ctx.fillRect(0, 0, viewW, viewH);
      targets.length = 0;
      let anyInput = false;
      for (const p of W.players) {
        if (p.dead) continue;
        Dangle.World.pose(p.head, alpha, tmp);
        targets.push({ index: p.index, x: tmp.x, y: tmp.y, vx: Dangle.Player.velX(p.head), vy: Dangle.Player.velY(p.head) });
        if (Math.abs(p.input.aimX) + Math.abs(p.input.aimY) > 0.2 || p.input.grab[0] || p.input.grab[1]) anyInput = true;
      }
      Dangle.Camera.update(dt, targets, viewW, viewH, anyInput && state.phase === 'play');
      const cam = Dangle.Camera.cam;
      Dangle.LevelLayer.drawFar(ctx, layer, cam, viewW, viewH, dpr);
      const sh = Dangle.Fx.shakeOffset();
      Dangle.Camera.apply(ctx, viewW, viewH, dpr, sh.x, sh.y);
      const hw = viewW / (2 * cam.scale), hh = viewH / (2 * cam.scale);
      Dangle.DrawLevel.back(ctx, W);
      Dangle.DrawWorld.devices(ctx, W, alpha, layer);
      Dangle.LevelLayer.draw(ctx, layer, cam.x - hw, cam.y - hh, cam.x + hw, cam.y + hh, prewarm);
      prewarm = false;
      Dangle.DrawWorld.draw(ctx, W, alpha, layer);
      Dangle.DrawLevel.front(ctx, W, dt);
      Dangle.DrawPlayer.draw(ctx, W, alpha);
      Dangle.Fx.draw(ctx);
      Dangle.DrawLevel.darkness(ctx, W, layer, cam, viewW, viewH, dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state.howto) Dangle.Hud.drawHowTo(ctx, viewW, viewH, W.time);
      else if (!session && !(Dangle.Menu.isOpen() && Dangle.Menu.state.over)) {
        const c = Dangle.Campaigns.parse(state.levelId);
        Dangle.Hud.draw(ctx, W, viewW, viewH, { name: c ? Dangle.Campaigns.levelName(c.c, c.n) : undefined, restartHold: restartHold / RESTART_HOLD, pauseIcon: state.phase === 'play', introTitle: state.phase === 'play' });
      }
      renderMs += (performance.now() - t0 - renderMs) * 0.05;
      if (debugOn) Dangle.Debug.draw(ctx, W, 10, 10, [`render ${renderMs.toFixed(2)} ms   tiles ${layer.tiles.size} (${(layer.bytes / 1e6).toFixed(0)} MB)   particles ${Dangle.Fx.count()}`]);
      if (session) Dangle.StressUI.drawWatch(ctx, session, 10, viewH - 80);
      Dangle.Menu.draw(ctx, viewW, viewH, dpr);
    }
    // Wipe.
    if (wipe) {
      const k = Math.min(1, wipe.t / WIPE);
      const a = wipe.dir === 'out' ? Dangle.Ui.ease.outCubic(k) : 1 - Dangle.Ui.ease.outCubic(k);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = a; ctx.fillStyle = cfg.BG_COLOR; ctx.fillRect(0, 0, viewW, viewH); ctx.globalAlpha = 1;
    }
  }

  // ---- boot -----------------------------------------------------------------------------------------------
  window.addEventListener('resize', resize);
  // Losing focus mid-level opens the pause menu, so coming back never drops you into a running game.
  window.addEventListener('blur', () => { blurred = true; if (state.phase === 'play' && !state.howto && !session) Session.pause(); else if (loop) loop.setPaused(true); });
  window.addEventListener('focus', () => { blurred = false; if (loop) loop.setPaused(state.phase !== 'play'); });
  document.addEventListener('visibilitychange', () => { blurred = document.hidden; if (blurred && state.phase === 'play' && !state.howto && !session) Session.pause(); });

  resize();
  Dangle.Input.init(canvas);
  Dangle.Input.setHeadScreen((p, out) => Dangle.Camera.worldToScreen(p.head.position.x, p.head.position.y, viewW, viewH, out));
  if (dev) {
    const levels = Dangle.Levels.list().filter((d) => !d.hidden).map((d) => ({ id: d.id, name: d.name })).concat([{ id: 'sandbox', name: 'Sandbox (Phase 1)' }]);
    Dangle.Tuning.init({
      onChange: () => { if (W) Dangle.World.applyConfig(W); },
      onReset: () => Session.restart(),
      onPlayers: (n) => Session.playId(state.levelId, n),
      onLevel: (id) => Session.playId(id, state.players),
      levels,
      themes: [{ id: '', name: 'Theme: level default' }].concat(Dangle.Themes.ids().map((id) => ({ id, name: 'Theme: ' + Dangle.Themes.get(id).name }))),
      theme: themeOverride,
      onTheme: (id) => { themeOverride = id; if (W) { W.themeId = id || (W.level ? W.level.spec.theme : 'meadow'); state.themeId = W.themeId; buildArt(); } },
      characters: Dangle.Characters.list.map((c, i) => ({ id: i, name: c.name })),
      chars: Dangle.Storage.getSettings().chars,
      onChar: (pl, i) => { Dangle.Storage.getSettings().chars[pl] = i; Dangle.Storage.saveSettings(); Session.restart(); },
    });
    Dangle.Tuning.setVisible(debugOn);
  }
  applySettings();

  loop = Dangle.Loop.start({
    frame,
    step() {
      if (!W) return;
      if (session) session.step();
      else Dangle.World.step(W);
    },
    render,
  });

  // Where to begin: a stress scenario, a specific level, or the title screen.
  const startLevel = params.get('level');
  if (watchScenario && !watchScenario.custom) { startStress(); setPhase('play'); }
  else if (startLevel && (startLevel === 'sandbox' || Dangle.Levels.find(startLevel))) {
    const cp = Dangle.Campaigns.parse(startLevel);
    Session.playId(startLevel, params.get('players') ? +params.get('players') : cp ? (cp.mode === 'coop' ? 2 : 1) : 2, true);
  }
  else Dangle.Menu.open('title');

  // Handy for console poking, tests and the headless tools.
  Dangle.debug = {
    get world() { return W; }, get layer() { return layer; }, get loop() { return loop; }, get state() { return state; },
    goToLevel(id) { Session.playId(id, state.players || 1, true); },
    setTheme(id) { themeOverride = id; if (W) { W.themeId = id || (W.level ? W.level.spec.theme : 'meadow'); buildArt(); } },
    render: (a, d) => render(a, d),
    tick(dt) { loop.advance(dt); },
  };
})();
