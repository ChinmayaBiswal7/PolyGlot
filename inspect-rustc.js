const { execSync } = require('child_process');
try {
  const bin = 'C:\\Program Files\\Rust stable GNU 1.99\\bin\\rustc.exe';
  const out = execSync(`"${bin}" test_gnu.rs`, { encoding: 'utf8', stdio: 'pipe' });
  console.log('Out:', out);
} catch(e) {
  console.log('STDOUT:', e.stdout);
  console.log('STDERR:', e.stderr);
}
