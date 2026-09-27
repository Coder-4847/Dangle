// Run every automated check: node tools/check-all.js
// physics stress tests, level linter (+ its selftest), scripted-player bots (gaps, segments, whole levels), saves,
// level smoke test, camera maths.
const { spawnSync } = require('child_process');
const path = require('path');
const checks = [
  ['physics stress tests', 'sim-test.js'],
  ['level linter selftest', 'lint-levels.js', '--selftest'],
  ['level linter', 'lint-levels.js'],
  ['gap limit bots', 'gap-bots.js'],
  ['segment bots', 'segment-bots.js'],
  ['level bot (authored)', 'level-bot.js'],
  ['co-op bots', 'coop-bots.js'],
  ['saves and unlock rules', 'progress-test.js'],
  ['level smoke test', 'level-smoke.js'],
  ['camera', 'camera-test.js'],
];
let failed = 0;
for (const [name, file, ...args] of checks) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...args], { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(24)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').filter((l) => /FAIL|error|EXCEPTION|Error/.test(l)).slice(0, 12).map((l) => '      ' + l).join('\n'));
}
console.log(failed ? `${failed} check(s) failed` : 'everything passes');
process.exit(failed ? 1 : 0);
