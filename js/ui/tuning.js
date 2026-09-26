// Live tuning panel: sliders bound straight to Dangle.config, plus sandbox controls.
// "Copy config" puts the current values on the clipboard, ready to paste into config.js.
window.Dangle = window.Dangle || {};

(function () {
  // [key, label, min, max, step]
  const SLIDERS = [
    ['REACH', 'Reach (px)', 60, 220, 1],
    ['ARM_FREQ', 'Arm stiffness (rad/s)', 3, 30, 0.5],
    ['ARM_DAMP', 'Arm damping', 0.1, 2, 0.05],
    ['ARM_FORCE_CAP', 'Grip pull cap (head weights)', 0.3, 3, 0.05],
    ['FREE_ARM_CAP', 'Reach push cap (head weights)', 0.2, 2, 0.05],
    ['PINNED_REACH', 'Grip arm length (x reach)', 0.1, 1, 0.01],
    ['PINNED_DAMP', 'Grip arm damping', 0, 1, 0.01],
    ['ARM_RELAX', 'Relaxed arm stiffness', 0, 0.5, 0.01],
    ['HEAD_MASS', 'Head mass', 2, 20, 0.5],
    ['HAND_MASS', 'Hand mass', 0.5, 6, 0.1],
    ['GRAVITY', 'Gravity (px/s²)', 200, 2000, 10],
    ['GRAB_TOLERANCE', 'Grab tolerance (px)', 0, 30, 1],
    ['GRAB_BUFFER', 'Grab buffer (s)', 0, 0.25, 0.01],
    ['GRAB_COYOTE', 'Grab coyote (s)', 0, 0.25, 0.01],
    ['HEAD_GRIP', 'Head floor grip (g)', 0, 2, 0.05],
    ['HAND_GRIP', 'Hand floor grip (g)', 0, 5, 0.1],
    ['HEAD_AIR_DRAG', 'Head air drag', 0, 0.03, 0.001],
    ['HAND_AIR_DRAG', 'Hand air drag', 0, 0.1, 0.005],
    ['MAX_HEAD_SPEED', 'Max head speed', 800, 4000, 50],
  ];
  const TOGGLES = [['TOGGLE_GRAB', 'Toggle grab (tap/tap)'], ['ASSIST', 'Assist (bigger grab)']];

  let root = null;
  let defaults = null;
  let levelSelect = null;
  const charSelects = [];
  const inputs = {};

  function copyText(text) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(fallback);   // e.g. document not focused
    }
    fallback();
    return Promise.resolve();
  }

  function fmt(v, step) { return step < 0.01 ? v.toFixed(3) : step < 1 ? v.toFixed(2) : String(Math.round(v)); }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function button(label, fn) {
    const b = el('button', 'tp-btn', label);
    b.addEventListener('click', () => { fn(); b.blur(); });
    return b;
  }

  function refresh() {
    for (const [key, , , , step] of SLIDERS) {
      inputs[key].range.value = Dangle.config[key];
      inputs[key].val.textContent = fmt(Dangle.config[key], step);
    }
    for (const [key] of TOGGLES) inputs[key].checked = !!Dangle.config[key];
  }

  function init(hooks) {
    const c = Dangle.config;
    defaults = Object.assign({}, c);
    root = el('div', 'tuning');
    root.appendChild(el('h3', '', 'Level & tuning'));

    if (hooks.levels) {
      levelSelect = document.createElement('select');
      levelSelect.className = 'tp-select';
      for (const l of hooks.levels) { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; levelSelect.appendChild(o); }
      levelSelect.addEventListener('change', () => { hooks.onLevel(levelSelect.value); levelSelect.blur(); });
      root.appendChild(levelSelect);
    }
    const select = (items, value, onPick) => {
      const s = document.createElement('select');
      s.className = 'tp-select';
      for (const it of items) { const o = document.createElement('option'); o.value = it.id; o.textContent = it.name; s.appendChild(o); }
      s.value = value;
      s.addEventListener('change', () => { onPick(s.value); s.blur(); });
      return s;
    };
    if (hooks.themes) root.appendChild(select(hooks.themes, hooks.theme, hooks.onTheme));
    if (hooks.characters) {
      const row = el('div', 'tp-row');
      for (let pl = 0; pl < 2; pl++) {
        const items = hooks.characters.map((c) => ({ id: c.id, name: `P${pl + 1}: ${c.name}` }));
        const s = select(items, hooks.chars[pl], (v) => hooks.onChar(pl, +v));
        charSelects.push(s);
        row.appendChild(s);
      }
      root.appendChild(row);
    }

    const row1 = el('div', 'tp-row');
    row1.appendChild(button('1P', () => hooks.onPlayers(1)));
    row1.appendChild(button('2P', () => hooks.onPlayers(2)));
    row1.appendChild(button('Reset level (R)', hooks.onReset));
    root.appendChild(row1);

    for (const [key, label, min, max, step] of SLIDERS) {
      const wrap = el('label', 'tp-slider');
      const top = el('span', 'tp-top');
      top.appendChild(el('span', '', label));
      const val = el('b', '', fmt(c[key], step));
      top.appendChild(val);
      const range = document.createElement('input');
      range.type = 'range'; range.min = min; range.max = max; range.step = step; range.value = c[key];
      range.addEventListener('input', () => {
        c[key] = parseFloat(range.value);
        val.textContent = fmt(c[key], step);
        hooks.onChange();
      });
      range.addEventListener('change', () => range.blur());   // arrow keys must keep steering the player
      wrap.appendChild(top); wrap.appendChild(range);
      root.appendChild(wrap);
      inputs[key] = { range, val };
    }

    for (const [key, label] of TOGGLES) {
      const wrap = el('label', 'tp-check');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = !!c[key];
      cb.addEventListener('change', () => { c[key] = cb.checked; hooks.onChange(); cb.blur(); });
      wrap.appendChild(cb); wrap.appendChild(document.createTextNode(' ' + label));
      root.appendChild(wrap);
      inputs[key] = cb;
    }
    const mw = el('label', 'tp-check');
    const mcb = document.createElement('input');
    mcb.type = 'checkbox';
    mcb.addEventListener('change', () => { Dangle.Input.state.mouseEnabled = mcb.checked; mcb.blur(); });
    mw.appendChild(mcb); mw.appendChild(document.createTextNode(' Mouse aim (P1: click = grab)'));
    root.appendChild(mw);

    const row2 = el('div', 'tp-row');
    row2.appendChild(button('Copy config', () => {
      const lines = SLIDERS.map(([k, , , , s]) => `  ${k}: ${fmt(c[k], s)},`)
        .concat(TOGGLES.map(([k]) => `  ${k}: ${!!c[k]},`));
      copyText('// paste into Dangle.config in js/config.js\n' + lines.join('\n')).then(() => {});
    }));
    row2.appendChild(button('Defaults', () => { Object.assign(c, defaults); refresh(); hooks.onChange(); }));
    root.appendChild(row2);
    root.appendChild(el('p', 'tp-help', 'P1: WASD/arrows + Q/E. P2: IJKL + U/O. Pad: stick + bumpers. ` = hide panel.'));
    document.body.appendChild(root);
  }

  function setVisible(v) { root.style.display = v ? 'block' : 'none'; }
  function setLevel(id) { if (levelSelect) levelSelect.value = id; }

  Dangle.Tuning = { init, setVisible, refresh, setLevel };
})();
