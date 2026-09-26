// Entry point: runs the physics sandbox with debug overlay and tuning panel.
// ?stress=1 shows the physics stress-test results; ?stress=<name> plays one scenario live.
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const cfg = Dangle.config;
  let viewW = 0;
  let viewH = 0;
  let dpr = 1;

  const stressParam = new URLSearchParams(location.search).get('stress');
  if (stressParam === '1' || stressParam === 'all') { canvas.style.display = 'none'; Dangle.StressUI.showTable(); return; }
  const watchScenario = stressParam ? Dangle.Stress.find(stressParam) : null;
  let session = null;          // live stress scenario (drives inputs itself)
  let restartT = 0;

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

  function build() {
    if (watchScenario && !watchScenario.custom) {
      session = Dangle.Stress.session(watchScenario);
      W = session.W;
      restartT = 2.5;
    } else {
      W = Dangle.Sandbox.build(playerCount);
    }
    Dangle.Camera.reset();
  }

  function updatePause() {
    if (loop) loop.setPaused(manualPause || blurred);
  }

  function handleKeys() {
    const I = Dangle.Input;
    if (I.takePressed('Backquote')) { debugOn = !debugOn; Dangle.Tuning.setVisible(debugOn); }
    if (I.takePressed('KeyR')) build();
    if (I.takePressed('Digit1')) { playerCount = 1; build(); }
    if (I.takePressed('Digit2')) { playerCount = 2; build(); }
    if (I.takePressed('KeyP') || I.takePressed('Escape')) { manualPause = !manualPause; updatePause(); }
  }

  function render(alpha, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = cfg.BG_COLOR;
    ctx.fillRect(0, 0, viewW, viewH);

    targets.length = 0;
    for (const p of W.players) {
      Dangle.World.pose(p.head, alpha, tmp);
      targets.push({ x: tmp.x, y: tmp.y });
    }
    Dangle.Camera.update(dt, targets, viewW, viewH);
    Dangle.Camera.apply(ctx, viewW, viewH, dpr);
    Dangle.DrawWorld.draw(ctx, W, alpha);
    Dangle.DrawPlayer.draw(ctx, W, alpha);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  build();
  Dangle.Tuning.init({
    onChange: () => Dangle.World.applyConfig(W),
    onReset: build,
    onPlayers: (n) => { playerCount = n; build(); },
  });
  Dangle.Tuning.setVisible(debugOn);

  loop = Dangle.Loop.start({
    frame(dt) {
      if (!session) Dangle.Input.poll(W.players);   // a live stress scenario scripts the inputs
      handleKeys();
      Dangle.Debug.tick(dt, W);
      if (session && session.finished && (restartT -= dt) <= 0) build();
    },
    step() {
      if (session) session.step();
      else Dangle.World.step(W);
    },
    render,
  });

  // Handy for console poking and the headless tests.
  Dangle.debug = { get world() { return W; }, build, get loop() { return loop; } };
})();
