// Input layer. Gameplay: keyboard schemes, gamepads and optional mouse all reduce to an aim vector
// (length 0..1) and two grab booleans per player. Menus: the same devices produce discrete actions
// (up/down/left/right/confirm/back/pause) with key-repeat, plus mouse pointer/click for convenience.
// Which device drives which player is configurable (Settings -> controls).
window.Dangle = window.Dangle || {};

(function () {
  // Physical key codes, so it works on any keyboard layout. WASD scheme also accepts the arrows.
  const SCHEMES = {
    wasd: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], grabL: ['KeyQ'], grabR: ['KeyE'] },
    ijkl: { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], grabL: ['KeyU'], grabR: ['KeyO'] },
  };
  const GAME_KEYS = new Set();
  Object.values(SCHEMES).forEach((s) => Object.values(s).forEach((codes) => codes.forEach((k) => GAME_KEYS.add(k))));
  ['Enter', 'Space', 'Escape', 'Backspace', 'Tab'].forEach((k) => GAME_KEYS.add(k));

  // Menu navigation: any of these keys, from either keyboard scheme.
  const NAV = {
    up: ['ArrowUp', 'KeyW', 'KeyI'], down: ['ArrowDown', 'KeyS', 'KeyK'],
    left: ['ArrowLeft', 'KeyA', 'KeyJ'], right: ['ArrowRight', 'KeyD', 'KeyL'],
  };
  const CONFIRM = ['Enter', 'NumpadEnter', 'Space', 'KeyE', 'KeyO'];
  const BACK = ['Escape', 'Backspace', 'KeyQ', 'KeyU'];
  const REPEAT_DELAY = 0.4;
  const REPEAT_RATE = 0.11;

  const down = new Set();       // keys currently held
  const latched = new Set();    // pressed since the last poll (a tap shorter than a frame still counts)
  const edges = new Set();      // one-shot keys for UI toggles (takePressed)
  const menuEdges = new Set();  // keys pressed since the last menu poll
  const padOrder = [];          // gamepad indices in the order they connected -> pad slot 0, 1, ...
  const mouse = { x: 0, y: 0, buttons: [false, false], latch: [false, false], moved: false, click: null };
  const toggled = [[false, false], [false, false]];   // toggle-grab state per player/hand
  const prevRaw = [[false, false], [false, false]];
  const state = { mouseEnabled: false };
  const assign = [{ kb: 'auto', pad: 'auto' }, { kb: 'auto', pad: 'auto' }];
  const tmp = { x: 0, y: 0 };
  let headScreen = null;        // (player, out) => screen position of the head; set by game.js
  let playerTotal = 1;          // how many players the current world has (decides 'auto' keyboards)

  function init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();   // keeps focused sliders/scroll from reacting
      if (!e.repeat) { down.add(e.code); latched.add(e.code); edges.add(e.code); menuEdges.add(e.code); }
    });
    window.addEventListener('keyup', (e) => { down.delete(e.code); });
    window.addEventListener('blur', () => { down.clear(); latched.clear(); mouse.buttons[0] = mouse.buttons[1] = false; });
    window.addEventListener('gamepadconnected', (e) => { if (padOrder.indexOf(e.gamepad.index) < 0) padOrder.push(e.gamepad.index); });
    window.addEventListener('gamepaddisconnected', (e) => {
      const i = padOrder.indexOf(e.gamepad.index);
      if (i >= 0) padOrder.splice(i, 1);
    });
    canvas.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; });
    canvas.addEventListener('pointerdown', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      const b = e.button === 2 ? 1 : e.button === 0 ? 0 : -1;
      if (b >= 0) { mouse.buttons[b] = true; mouse.latch[b] = true; }
      if (e.button === 0) mouse.click = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', (e) => {
      const b = e.button === 2 ? 1 : e.button === 0 ? 0 : -1;
      if (b >= 0) mouse.buttons[b] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function anyDown(codes) {
    for (let i = 0; i < codes.length; i++) if (down.has(codes[i]) || latched.has(codes[i])) return true;
    return false;
  }

  // ---- device assignment -----------------------------------------------------------------------
  function setAssignments(controls, totalPlayers) {
    for (let i = 0; i < 2; i++) { assign[i].kb = controls[i].kb; assign[i].pad = controls[i].pad; }
    playerTotal = totalPlayers || 1;
  }
  function setPlayerCount(n) { playerTotal = n; }

  // Which keyboard scheme and pad slot does player i use right now?
  function schemeFor(i) {
    const a = assign[i].kb;
    if (a === 'none') return null;
    if (a === 'wasd' || a === 'ijkl') return SCHEMES[a];
    return SCHEMES[i === 0 ? 'wasd' : 'ijkl'];              // 'auto'
  }
  function padSlotFor(i) {
    const a = assign[i].pad;
    if (a === 'none') return -1;
    return a === 'auto' ? i : a;
  }
  function getPad(slot) {
    if (slot < 0) return null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads[padOrder[slot]] || null;
  }

  function readPad(pad, out) {
    let x = pad.axes[0] || 0;
    let y = pad.axes[1] || 0;
    const m = Math.hypot(x, y);
    const dz = 0.2;
    if (m < dz) { x = 0; y = 0; } else { const s = Math.min(1, (m - dz) / (1 - dz)) / m; x *= s; y *= s; }
    out.aimX = x; out.aimY = y;
    const b = pad.buttons;
    out.grabL = !!(b[4] && b[4].pressed) || !!(b[6] && b[6].value > 0.4);
    out.grabR = !!(b[5] && b[5].pressed) || !!(b[7] && b[7].value > 0.4);
  }

  const pad = { aimX: 0, aimY: 0, grabL: false, grabR: false };

  function poll(players) {
    const c = Dangle.config;
    for (const p of players) {
      const s = schemeFor(p.index);
      let ax = 0, ay = 0, l = false, r = false;
      if (s) {
        ax = (anyDown(s.right) ? 1 : 0) - (anyDown(s.left) ? 1 : 0);
        ay = (anyDown(s.down) ? 1 : 0) - (anyDown(s.up) ? 1 : 0);
        l = anyDown(s.grabL);
        r = anyDown(s.grabR);
        const m = Math.hypot(ax, ay);
        if (m > 1) { ax /= m; ay /= m; }
      }

      const gp = getPad(padSlotFor(p.index));
      if (gp) {
        readPad(gp, pad);
        if (Math.hypot(pad.aimX, pad.aimY) > Math.hypot(ax, ay)) { ax = pad.aimX; ay = pad.aimY; }
        l = l || pad.grabL; r = r || pad.grabR;
      }

      if (state.mouseEnabled && p.index === 0 && headScreen) {
        headScreen(p, tmp);
        const dx = mouse.x - tmp.x;
        const dy = mouse.y - tmp.y;
        const mm = Math.hypot(dx, dy);
        const radius = 140;     // screen px for full extension
        if (mm > 24 && Math.min(1, mm / radius) > Math.hypot(ax, ay)) {
          const k = Math.min(1, mm / radius) / mm;
          ax = dx * k; ay = dy * k;
        }
        l = l || mouse.buttons[0] || mouse.latch[0];
        r = r || mouse.buttons[1] || mouse.latch[1];
      }

      // Toggle-grab: each press flips the hand between gripping and free.
      if (c.TOGGLE_GRAB) {
        const raw = [l, r];
        for (let i = 0; i < 2; i++) {
          if (raw[i] && !prevRaw[p.index][i]) toggled[p.index][i] = !toggled[p.index][i];
          prevRaw[p.index][i] = raw[i];
        }
        l = toggled[p.index][0]; r = toggled[p.index][1];
      } else {
        toggled[p.index][0] = toggled[p.index][1] = false;
        prevRaw[p.index][0] = prevRaw[p.index][1] = false;
      }

      p.input.aimX = ax; p.input.aimY = ay;
      p.input.grab[0] = l; p.input.grab[1] = r;
    }
    latched.clear();
    mouse.latch[0] = mouse.latch[1] = false;
  }

  // Clear per-player toggle memory (a new level must not start with a hand already "gripping").
  function resetToggles() {
    for (let i = 0; i < 2; i++) { toggled[i][0] = toggled[i][1] = false; prevRaw[i][0] = prevRaw[i][1] = false; }
  }

  // One-shot key check for UI toggles (backquote, R, ...).
  function takePressed(code) {
    if (edges.has(code)) { edges.delete(code); return true; }
    return false;
  }

  // ---- menu actions ----------------------------------------------------------------------------
  const held = { up: 0, down: 0, left: 0, right: 0 };          // seconds each direction has been held
  const nextRepeat = { up: 0, down: 0, left: 0, right: 0 };
  const padPrev = {};                                            // per gamepad index: previous button states
  const actions = [];

  function padButtons(gp) {
    let prev = padPrev[gp.index];
    if (!prev) prev = padPrev[gp.index] = [];
    return prev;
  }

  // Fills and returns a reused array of action names since the last call, e.g. ['down', 'confirm'].
  function menuActions(dt) {
    actions.length = 0;
    const dirNow = { up: false, down: false, left: false, right: false };
    let confirm = false, back = false, pause = false, any = menuEdges.size > 0;

    // A direction key tapped and released between two polls still counts once (edge), so quick taps never vanish.
    const dirEdge = { up: false, down: false, left: false, right: false };
    for (const dir of ['up', 'down', 'left', 'right']) {
      for (const k of NAV[dir]) { if (down.has(k)) dirNow[dir] = true; if (menuEdges.has(k)) dirEdge[dir] = true; }
    }
    for (const k of menuEdges) {
      if (CONFIRM.indexOf(k) >= 0) confirm = true;
      if (BACK.indexOf(k) >= 0) back = true;
      if (k === 'Escape' || k === 'KeyP') pause = true;
    }
    menuEdges.clear();

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const prev = padButtons(gp);
      const b = gp.buttons;
      const pressed = (i) => !!(b[i] && b[i].pressed);
      const edge = (i) => pressed(i) && !prev[i];
      if (edge(0)) confirm = true;
      if (edge(1) || edge(8)) back = true;
      if (edge(9)) pause = true;
      for (let i = 0; i < 16; i++) { if (edge(i) && i !== 0 && i !== 1) any = true; }
      if (edge(0) || edge(1)) any = true;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (pressed(12) || ay < -0.55) dirNow.up = true;
      if (pressed(13) || ay > 0.55) dirNow.down = true;
      if (pressed(14) || ax < -0.55) dirNow.left = true;
      if (pressed(15) || ax > 0.55) dirNow.right = true;
      for (let i = 0; i < 16; i++) prev[i] = pressed(i);
    }

    for (const dir of ['up', 'down', 'left', 'right']) {
      if (dirNow[dir]) {
        if (held[dir] === 0) { actions.push(dir); nextRepeat[dir] = REPEAT_DELAY; }
        else if (held[dir] >= nextRepeat[dir]) { actions.push(dir); nextRepeat[dir] += REPEAT_RATE; }
        held[dir] += Math.max(dt, 1e-6);
      } else { held[dir] = 0; if (dirEdge[dir]) actions.push(dir); }
    }
    if (confirm) actions.push('confirm');
    if (back) actions.push('back');
    if (pause) actions.push('pause');
    if (any) actions.push('any');
    return actions;
  }

  // Forget queued presses (used when a screen change should not swallow the key that caused it twice).
  function clearMenuInput() { menuEdges.clear(); for (const k of Object.keys(held)) held[k] = 1e-3; }

  function takeClick() { const c = mouse.click; mouse.click = null; return c; }
  function takeMoved() { const m = mouse.moved; mouse.moved = false; return m; }
  function isDown(code) { return down.has(code); }

  // Is a gamepad start/back style "restart" (hold) happening? (R key or pad Back+Y not needed: pause menu has Restart.)
  function padCount() { return padOrder.length; }
  function padName(slot) { const g = getPad(slot); return g ? g.id.replace(/\(.*\)/, '').trim().slice(0, 22) : null; }

  Dangle.Input = {
    init, poll, takePressed, state, menuActions, clearMenuInput, takeClick, takeMoved, isDown,
    setAssignments, setPlayerCount, resetToggles, padCount, padName,
    get pointer() { return mouse; },
    setHeadScreen(fn) { headScreen = fn; },
    schemes: SCHEMES,
  };
})();
