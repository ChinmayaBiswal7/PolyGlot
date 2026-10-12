const { executeCode } = require('./src/engine/executor');

const sample = [
  '# Step 1: Python calculates a list square',
  'numbers = [1, 2, 3, 4, 5]',
  'print("Python squares:", [n * n for n in numbers])',
  '',
  '// Step 2: C calculates factorial',
  'int fact = 1;',
  'for (int i = 1; i <= 5; i++) {',
  '    fact *= i;',
  '}',
  'printf("C factorial of 5: %d\\n", fact);',
  '',
  '// Step 3: JavaScript timestamp and string manipulation',
  'const message = "PolyGlot IDE is running!";',
  'console.log("JS says:", message.toUpperCase());'
].join('\n');

executeCode(sample).then(res => {
  console.log('Result:', JSON.stringify(res, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
