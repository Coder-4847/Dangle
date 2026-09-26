// Headless physics stress tests: node tools/sim-test.js [scenarioName]
// Loads the real game files under node (no DOM) and runs js/dev/stress.js.
const path = require('path');
global.window = global;
global.Matter = require('../js/lib/matter.min.js');
for (const f of ['config', 'core/loop', 'physics/world', 'physics/grab', 'physics/player', 'physics/surfaces', 'levels/sandbox', 'dev/stress']) {
  require(path.join('..', 'js', f + '.js'));
}
const D = global.Dangle;

if (require.main === module) {
  const only = process.argv[2];
  const list = D.Stress.scenarios.filter((s) => !only || s.name === only);
  if (!list.length) { console.log('unknown scenario; have:', D.Stress.scenarios.map((s) => s.name).join(' ')); process.exit(1); }
  let failed = 0;
  for (const sc of list) {
    const r = D.Stress.run(sc);
    if (!r.pass) failed++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${sc.name.padEnd(11)} ${r.info}  (${r.ms.toFixed(0)} ms)`);
  }
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exitCode = failed ? 1 : 0;
}
module.exports = { D };
