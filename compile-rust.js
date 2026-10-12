const { execSync } = require('child_process');
const fs = require('fs');

fs.writeFileSync('test.rs', 'fn main() { println!("Rust works!"); }');
const env = {
  ...process.env,
  PATH: 'C:\\Program Files\\Rust stable MSVC 1.99\\bin;' +
        'C:\\Users\\KIIT\\AppData\\Local\\Microsoft\\WinGet\\Packages\\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\\llvm-mingw-20260908-ucrt-x86_64\\bin;' +
        process.env.PATH
};

try {
  execSync('rustc test.rs -C linker=gcc', { env, stdio: 'inherit' });
  const out = execSync('test.exe', { env });
  console.log('OUTPUT:', out.toString());
} catch(e) {
  console.error('COMPILE/RUN ERROR:', e.message);
}
