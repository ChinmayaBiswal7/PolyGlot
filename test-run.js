const { executeCode } = require('./src/engine/executor');

const sample = [
  'print("Hello from Python! 🐍")',
  'System.out.println("Hello from Java! ☕");',
  'printf("Hello from C! 🔧\\n");',
  'cout << "Hello from C++! ⚡" << endl;',
  'console.log("Hello from JavaScript! 🌐");'
].join('\n');

executeCode(sample).then(res => {
  console.log('--- Combined Output ---');
  console.log(res.output);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
