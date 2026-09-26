// Entry point. Phase 0: a blank, crisp, full-window canvas that follows resizes.
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;

  // Match the backing store to CSS size x devicePixelRatio so lines stay sharp on high-DPI screens.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels from here on
    draw();
  }

  function draw() {
    ctx.fillStyle = Dangle.config.BG_COLOR;
    ctx.fillRect(0, 0, width, height);
  }

  window.addEventListener('resize', resize);
  resize();
})();
