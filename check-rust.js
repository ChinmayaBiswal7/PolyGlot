const { execSync } = require('child_process');
const rustPath = 'C:\\Program Files\\Rust stable MSVC 1.99\\bin\\rustc.exe';
try {
  const out = execSync(`"${rustPath}" --version`, { encoding: 'utf8' });
  console.log('Rust:', out.trim());
} catch(e) {
  console.log('Err:', e.message);
}
