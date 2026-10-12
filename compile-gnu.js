const { execSync } = require('child_process');
const fs = require('fs');

fs.writeFileSync('test_gnu.rs', 'fn main() { println!("Rust GNU works!"); }');
const env = {
  ...process.env,
  PATH: 'C:\\Program Files\\Rust stable GNU 1.99\\bin;' +
        'C:\\Users\\KIIT\\AppData\\Local\\Microsoft\\WinGet\\Packages\\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\\llvm-mingw-20260908-ucrt-x86_64\\bin;' +
        process.env.PATH
};

try {
  execSync('"C:\\Program Files\\Rust stable GNU 1.99\\bin\\rustc.exe" test_gnu.rs -o test_gnu.exe', { env, stdio: 'inherit' });
  const out = execSync('test_gnu.exe', { env });
  console.log('SUCCESS:', out.toString());
} catch(e) {
  console.error('ERROR:', e.message);
}
