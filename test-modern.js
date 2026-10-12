const { executeCode } = require('./src/engine/executor');

const testCode = [
  '# 1. Python starts with a number',
  'num = 42',
  'print(f"Python started with num = {num}")',
  '',
  '// 2. Go takes the number and adds 10',
  'fmt.Printf("Go says: original num is %d, adding 10\\n", num)',
  '',
  '// 3. Rust displays and checks',
  'println!("Rust says: hello from the modern systems world! Num is {}", num);',
  '',
  '// 4. TypeScript with strict types prints conclusion',
  'const finalMsg: string = `TypeScript finished processing num: ${num}`;',
  'console.log(finalMsg);'
].join('\n');

executeCode(testCode).then(res => {
  console.log('--- Multi-Language Result ---');
  console.log(res.output);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
