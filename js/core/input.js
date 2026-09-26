// Input layer: keyboard schemes, gamepads and optional mouse all reduce to the same thing
// per player: an aim vector (length 0..1) and two grab booleans (left/right hand).
window.Dangle = window.Dangle || {};

(function () {
  // Physical key codes, so it works on any keyboard layout. Solo/P1 also accepts the arrows.
  const SCHEMES = [
    { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], grabL: ['KeyQ'], grabR: ['KeyE'] },
    { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], grabL: ['KeyU'], grabR: ['KeyO'] },
  ];
  const GAME_KEYS = new Set();
  SCHEMES.forEach((s) => Object.values(s).forEach((codes) => codes.forEach((k) => GAME_KEYS.add(k))));

  const down = new Set();       // keys currently held
  const latched = new Set();    // pressed since the last poll (a tap shorter than a frame still counts)
  const edges = new Set();      // one-shot keys for UI toggles (takePressed)
  const padOrder = [];          // gamepad indices in the order they connected -> player 0, 1
  const mouse = { x: 0, y: 0, buttons: [false, false], latch: [false, false] };
  const toggled = [[false, false], [false, false]];   // toggle-grab state per player/hand
  const prevRaw = [[false, false], [false, false]];
  const state = { mouseEnabled: false };
  const tmp = { x: 0, y: 0 };
  let headScreen = null;        // (player, out) => screen position of the head; set by game.js

  function init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();   // keeps focused sliders from reacting
      if (!e.repeat) { down.add(e.code); latched.add(e.code); edges.add(e.code); }
    });
    window.addEventListener('keyup', (e) => { down.delete(e.code); });
    window.addEventListener('blur', () => { down.clear(); latched.clear(); mouse.buttons[0] = mouse.buttons[1] = false; });
    window.addEventListener('gamepadconnected', (e) => { if (padOrder.indexOf(e.gamepad.index) < 0) padOrder.push(e.gamepad.index); });
    window.addEventListener('gamepaddisconnected', (e) => {
      const i = padOrder.indexOf(e.gamepad.index);
      if (i >= 0) padOrder.splice(i, 1);
    });
    canvas.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    canvas.addEventListener('pointerdown', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      const b = e.button === 2 ? 1 : e.button === 0 ? 0 : -1;
      if (b >= 0) { mouse.buttons[b] = true; mouse.latch[b] = true; }
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

  function readPad(index, out) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[padOrder[index]];
    if (!pad) return false;
    let x = pad.axes[0] || 0;
    let y = pad.axes[1] || 0;
    const m = Math.hypot(x, y);
    const dz = 0.2;
    if (m < dz) { x = 0; y = 0; } else { const s = Math.min(1, (m - dz) / (1 - dz)) / m; x *= s; y *= s; }
    out.aimX = x; out.aimY = y;
    const b = pad.buttons;
    out.grabL = !!(b[4] && b[4].pressed) || !!(b[6] && b[6].value > 0.4);
    out.grabR = !!(b[5] && b[5].pressed) || !!(b[7] && b[7].value > 0.4);
    return true;
  }

  const pad = { aimX: 0, aimY: 0, grabL: false, grabR: false };

  function poll(players) {
    const c = Dangle.config;
    for (const p of players) {
      const s = SCHEMES[p.index];
      let ax = (anyDown(s.right) ? 1 : 0) - (anyDown(s.left) ? 1 : 0);
      let ay = (anyDown(s.down) ? 1 : 0) - (anyDown(s.up) ? 1 : 0);
      let l = anyDown(s.grabL);
      let r = anyDown(s.grabR);
      const m = Math.hypot(ax, ay);
      if (m > 1) { ax /= m; ay /= m; }

      if (readPad(p.index, pad)) {
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

  // One-shot key check for UI toggles (backquote, R, ...).
  function takePressed(code) {
    if (edges.has(code)) { edges.delete(code); return true; }
    return false;
  }

  Dangle.Input = {
    init, poll, takePressed, state,
    setHeadScreen(fn) { headScreen = fn; },
    padCount() { return padOrder.length; },
  };
})();
