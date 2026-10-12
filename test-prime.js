const { executeCode } = require('./src/engine/executor');

const primePipeline = [
  '# Step 1 (Python): Input the number to check',
  'n = 29',
  'print(f"Python input: checking if {n} is prime")',
  '',
  '// Step 2 (C): Prime logic testing divisors and saving flag',
  'int is_prime = 1;',
  'for (int i = 2; i * i <= n; i++) {',
  '    if (n % i == 0) {',
  '        is_prime = 0;',
  '        break;',
  '    }',
  '}',
  'poly_set_int("is_prime", is_prime);',
  'printf("C computed is_prime = %d\\n", is_prime);',
  '',
  '// Step 3 (JavaScript): Formatting and final output',
  'const status = is_prime === 1 ? "PRIME" : "NOT PRIME";',
  'console.log(`JavaScript result: ${n} is ${status}! 🎉`);'
].join('\n');

executeCode(primePipeline).then(res => {
  console.log('--- Pipeline Execution Output ---');
  console.log(res.output);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
