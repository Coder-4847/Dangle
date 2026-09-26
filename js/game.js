// Entry point: plays levels (or the physics sandbox) with debug overlay and tuning panel.
//   ?level=<id>     start on a level (default test-h; 'sandbox' = the Phase 1 strip)
//   ?stress=1       physics stress-test results; ?stress=<name> plays one scenario live
// Dev keys: L = next level, R = restart, 1/2 = player count, backtick = panel, P/Esc = pause.
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const cfg = Dangle.config;
  let viewW = 0;
  let viewH = 0;
  let dpr = 1;

  const params = new URLSearchParams(location.search);
  const stressParam = params.get('stress');
  if (stressParam === '1' || stressParam === 'all') { canvas.style.display = 'none'; Dangle.StressUI.showTable(); return; }
  const watchScenario = stressParam ? Dangle.Stress.find(stressParam) : null;
  let session = null;          // live stress scenario (drives inputs itself)
  let restartT = 0;

  const levelList = Dangle.Levels.list().map((d) => ({ id: d.id, name: d.name })).concat([{ id: 'sandbox', name: 'Sandbox (Phase 1)' }]);
  let levelId = params.get('level') || levelList[0].id;
  if (!levelList.some((l) => l.id === levelId)) levelId = levelList[0].id;

  let W = null;
  let playerCount = 2;
  let debugOn = true;          // overlay + tuning panel (backtick toggles)
  let manualPause = false;
  let blurred = false;
  let loop = null;
  const targets = [];          // camera targets, reused every frame
  const tmp = { x: 0, y: 0, a: 0 };

  // Match the backing store to CSS size x devicePixelRatio so lines stay sharp on high-DPI screens.
  function resize() {
    dpr = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
  }

  // (Re)build the world for the current level. The old world is taken apart first.
  function build() {
    if (W) Dangle.Level.unload(W);
    if (watchScenario && !watchScenario.custom) {
      session = Dangle.Stress.session(watchScenario);
      W = session.W;
      restartT = 2.5;
      Dangle.Camera.setLevel(null);
    } else if (levelId === 'sandbox') {
      W = Dangle.Sandbox.build(playerCount);
      Dangle.Camera.setLevel(null);
    } else {
      const spec = Dangle.Levels.spec(levelId);
      W = Dangle.Level.load(spec, playerCount);
      Dangle.Camera.setLevel({ bounds: spec.bounds, goal: spec.goal, direction: spec.direction });
    }
    if (Dangle.Tuning.setLevel) Dangle.Tuning.setLevel(levelId);
  }

  function goToLevel(id) { levelId = id; build(); }
  function nextLevel(step) {
    const i = levelList.findIndex((l) => l.id === levelId);
    goToLevel(levelList[(i + step + levelList.length) % levelList.length].id);
  }

  function updatePause() {
    if (loop) loop.setPaused(manualPause || blurred);
  }

  function handleKeys() {
    const I = Dangle.Input;
    if (I.takePressed('Backquote')) { debugOn = !debugOn; Dangle.Tuning.setVisible(debugOn); }
    if (I.takePressed('KeyR')) build();
    if (I.takePressed('KeyL')) nextLevel(1);
    if (I.takePressed('Digit1')) { playerCount = 1; build(); }
    if (I.takePressed('Digit2')) { playerCount = 2; build(); }
    if (I.takePressed('KeyP') || I.takePressed('Escape')) { manualPause = !manualPause; updatePause(); }
  }

  function render(alpha, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    Dangle.Camera.update(dt, targets, viewW, viewH, anyInput);
    Dangle.Camera.apply(ctx, viewW, viewH, dpr);
    Dangle.DrawLevel.back(ctx, W);
    Dangle.DrawWorld.draw(ctx, W, alpha);
    Dangle.DrawLevel.front(ctx, W);
    Dangle.DrawPlayer.draw(ctx, W, alpha);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Dangle.Hud.draw(ctx, W, viewW, viewH);
    if (debugOn) Dangle.Debug.draw(ctx, W, 10, 10);
    if (session) Dangle.StressUI.drawWatch(ctx, session, 10, viewH - 80);
    if (manualPause || blurred) {
      ctx.fillStyle = 'rgba(253,240,220,0.6)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.fillStyle = '#3a3a48';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(blurred ? 'Paused (window not focused)' : 'Paused (P / Esc)', viewW / 2, viewH / 2);
      ctx.textAlign = 'start';
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => { blurred = true; updatePause(); });
  window.addEventListener('focus', () => { blurred = false; updatePause(); });
  document.addEventListener('visibilitychange', () => { blurred = document.hidden; updatePause(); });

  resize();
  Dangle.Input.init(canvas);
  Dangle.Input.setHeadScreen((p, out) => Dangle.Camera.worldToScreen(p.head.position.x, p.head.position.y, viewW, viewH, out));
  Dangle.Tuning.init({
    onChange: () => Dangle.World.applyConfig(W),
    onReset: build,
    onPlayers: (n) => { playerCount = n; build(); },
    onLevel: goToLevel,
    levels: levelList,
  });
  Dangle.Tuning.setVisible(debugOn);
  build();

  loop = Dangle.Loop.start({
    frame(dt) {
      if (!session) Dangle.Input.poll(W.players);   // a live stress scenario scripts the inputs
      handleKeys();
      Dangle.Debug.tick(dt, W);
      if (W.level) W.level.events.length = 0;       // nothing consumes events yet (Phase 4/10 will)
      if (session && session.finished && (restartT -= dt) <= 0) build();
    },
    step() {
      if (session) session.step();
      else Dangle.World.step(W);
    },
    render,
  });

  // Handy for console poking and the headless tests.
  Dangle.debug = { get world() { return W; }, build, goToLevel, get loop() { return loop; } };
})();
