// In-page UI for the stress harness: ?stress=1 shows a results table, ?stress=<name> plays one live.
window.Dangle = window.Dangle || {};

(function () {
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Runs every scenario headless (takes well under a second) and lists the results.
  function showTable() {
    const root = el('div', 'stress');
    root.appendChild(el('h2', '', 'Physics stress tests'));
    const status = el('p', '', 'Running…');
    root.appendChild(status);
    document.body.appendChild(root);
    setTimeout(() => {   // let the page paint "Running" first
      const table = el('table');
      let passed = 0;
      for (const sc of Dangle.Stress.scenarios) {
        const r = Dangle.Stress.run(sc);
        if (r.pass) passed++;
        const tr = el('tr', r.pass ? 'ok' : 'bad');
        tr.appendChild(el('td', 'st', r.pass ? 'PASS' : 'FAIL'));
        const name = el('td', 'nm');
        if (sc.custom) name.textContent = sc.name;
        else { const a = el('a', '', sc.name); a.href = '?stress=' + encodeURIComponent(sc.name); name.appendChild(a); }
        tr.appendChild(name);
        const info = el('td');
        info.appendChild(el('div', 'desc', sc.desc));
        info.appendChild(el('div', '', r.info));
        tr.appendChild(info);
        table.appendChild(tr);
      }
      status.textContent = `${passed} / ${Dangle.Stress.scenarios.length} passed. Click a name to watch it live (scenarios without links are headless-only).`;
      root.appendChild(table);
    }, 30);
  }

  // HUD for a live scenario: name, what it tests, clock, and the verdict when it finishes.
  function drawWatch(ctx, sess, x, y) {
    const lines = [`stress: ${sess.sc.name}   t=${sess.time.toFixed(1)} / ${sess.sc.seconds}s`, sess.sc.desc];
    if (sess.finished) lines.push(`${sess.result.pass ? 'PASS' : 'FAIL'}: ${sess.result.info}   (restarting)`);
    ctx.font = '13px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20;
    ctx.fillStyle = 'rgba(30,30,40,0.78)';
    ctx.fillRect(x, y, w, lines.length * 18 + 12);
    lines.forEach((l, i) => {
      ctx.fillStyle = i === 2 ? (sess.result.pass ? '#9fe6a0' : '#ff9d9d') : '#f5ecd8';
      ctx.fillText(l, x + 10, y + 7 + i * 18);
    });
  }

  Dangle.StressUI = { showTable, drawWatch };
})();
