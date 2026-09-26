// Phase 1 physics sandbox: one long strip that exercises every grab situation.
// Coordinates: y grows down, ground surface at y = 600. Distances are chosen relative to REACH.
window.Dangle = window.Dangle || {};

(function () {
  const S = () => Dangle.Surfaces;

  const LOOKS = [
    { head: '#f2a03d', dark: '#b8691a' },
    { head: '#5fc4a8', dark: '#2f8a72' },
  ];

  function build(playerCount) {
    const c = Dangle.config;
    const R = c.REACH;
    const W = Dangle.World.create();

    // Ground with a pit under the rope gap (fall in = respawn test).
    S().block(W, -600, 600, 1840, 120, 'ground');
    S().block(W, 1480, 600, 1300, 120, 'ground');
    // Boundary walls.
    S().block(W, -660, -600, 60, 1320, 'ground');
    S().block(W, 2720, -600, 60, 1320, 'ground');

    // A floating ledge and a crate near the start.
    S().block(W, 470, 440, R * 1.4, 32, 'ground');
    S().crate(W, 330, 566, 64, 7);

    // Tower to climb: hand-over-hand up its left face, plateau on top.
    S().block(W, 820, 250, 410, 350, 'ground');

    // Rope over the pit: pivot is high above; the tail hangs at plateau height.
    S().rope(W, 1320, -60, 10, 33, 1.2);

    // Landing block on the far side of the gap (about 2x REACH away from the plateau).
    S().block(W, 1490, 250, 420, 350, 'ground');

    // Moving platform above the landing block: ride it or hang under it.
    S().mover(W, 1540, 60, 180, 30, { dx: 320, period: 5 });

    // No-grab wall: hands slide off it.
    S().block(W, 2080, 300, 60, 300, 'noGrab');
    S().block(W, 2260, 360, 200, 32, 'ground');

    const spawns = [{ x: 120, y: 560 }, { x: 220, y: 560 }];
    for (let i = 0; i < playerCount; i++) {
      Dangle.Player.create(W, i, spawns[i].x, spawns[i].y, LOOKS[i]);
    }
    return W;
  }

  Dangle.Sandbox = { build };
})();
