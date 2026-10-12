'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { splitCode } = require('./splitter');

const TEMP_DIR = path.join(os.tmpdir(), 'polyglot-ide');
const SHARED_MEM_FILE = path.join(TEMP_DIR, 'shared_memory.json');

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function resetSharedMemory() {
  ensureTempDir();
  fs.writeFileSync(SHARED_MEM_FILE, JSON.stringify({}), 'utf8');
}

// Full Toolchains Environment
const EXTRA_PATHS = [
  'C:\\Program Files\\Rust stable GNU 1.99\\bin',
  'C:\\Program Files\\Go\\bin',
  'C:\\Users\\KIIT\\AppData\\Local\\Microsoft\\WinGet\\Packages\\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\\llvm-mingw-20260908-ucrt-x86_64\\bin',
  'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath'
];

function getEnv() {
  const currentPath = process.env.PATH || '';
  const mergedPath = EXTRA_PATHS.filter(p => fs.existsSync(p)).join(';') + ';' + currentPath;
  return {
    ...process.env,
    PATH: mergedPath,
    PYTHONIOENCODING: 'utf-8'
  };
}

function run(command) {
  return new Promise((resolve) => {
    exec(command, {
      timeout: 25000,
      encoding: 'utf8',
      cwd: TEMP_DIR,
      env: getEnv()
    }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : ''),
        exitCode: err ? (err.code ?? 1) : 0,
      });
    });
  });
}

const SHARED_PATH_ESC = SHARED_MEM_FILE.replace(/\\/g, '\\\\');

// ── Shared Memory Wrappers ──────────────────────────────────

// 1. Python
function wrapPython(code) {
  return `import json, os

_shared_file = r"${SHARED_MEM_FILE}"
_scope = {}
if os.path.exists(_shared_file):
    try:
        with open(_shared_file, 'r', encoding='utf-8') as f:
            _scope = json.load(f)
            globals().update(_scope)
    except Exception:
        pass

# --- User Code ---
${code}

# --- Export Variables ---
_export = {}
for _k, _v in list(globals().items()):
    if not _k.startswith('_') and isinstance(_v, (int, float, str, bool, list, dict)):
        _export[_k] = _v

try:
    if os.path.exists(_shared_file):
        with open(_shared_file, 'r', encoding='utf-8') as f:
            _current = json.load(f)
    else:
        _current = {}
    _current.update(_export)
    with open(_shared_file, 'w', encoding='utf-8') as f:
        json.dump(_current, f)
except Exception:
    pass
`;
}

// 2. JavaScript / TypeScript
function wrapJavaScript(code) {
  let sharedMemoryData = {};
  if (fs.existsSync(SHARED_MEM_FILE)) {
    try { sharedMemoryData = JSON.parse(fs.readFileSync(SHARED_MEM_FILE, 'utf8')); } catch (e) {}
  }

  let autoDeclarations = '';
  for (const [k, v] of Object.entries(sharedMemoryData)) {
    if (typeof v === 'number' || typeof v === 'boolean') {
      autoDeclarations += `const ${k} = ${v};\nglobal.${k} = ${v};\n`;
    } else if (typeof v === 'string') {
      autoDeclarations += `const ${k} = "${v.replace(/"/g, '\\"')}";\nglobal.${k} = "${v.replace(/"/g, '\\"')}";\n`;
    }
  }

  const varMatches = [...code.matchAll(/\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)].map(m => m[1]);
  const assignMatches = [...code.matchAll(/^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm)].map(m => m[1]);
  const allVars = [...new Set([...varMatches, ...assignMatches])];
  const exportSnippets = allVars.map(v => `try { if (typeof ${v} !== 'undefined') _export['${v}'] = ${v}; } catch(e){}`).join('\n');

  return `const fs = require('fs');
const _shared_file = "${SHARED_PATH_ESC}";
let _shared = {};
if (fs.existsSync(_shared_file)) {
  try { _shared = JSON.parse(fs.readFileSync(_shared_file, 'utf8')); } catch (e) {}
}
for (const [k, v] of Object.entries(_shared)) {
  global[k] = v;
}

// --- Injected Declarations ---
${autoDeclarations}

// --- User Code ---
${code}

// --- Export Variables ---
const _export = {};
for (const [k, v] of Object.entries(global)) {
  if (!k.startsWith('_') && ['number', 'string', 'boolean'].includes(typeof v)) {
    _export[k] = v;
  }
}
${exportSnippets}
try {
  const current = fs.existsSync(_shared_file) ? JSON.parse(fs.readFileSync(_shared_file, 'utf8')) : {};
  Object.assign(current, _export);
  fs.writeFileSync(_shared_file, JSON.stringify(current), 'utf8');
} catch (e) {}
`;
}

// 3. C
function wrapC(code) {
  const headers = '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n';

  const helperFunctions = `
int poly_get_int(const char* key, int default_val) {
    FILE *f = fopen("${SHARED_PATH_ESC}", "r");
    if (!f) return default_val;
    char buf[4096];
    size_t n = fread(buf, 1, sizeof(buf)-1, f);
    fclose(f);
    buf[n] = '\\0';
    char pattern[128];
    sprintf(pattern, "\\"%s\\":", key);
    char *p = strstr(buf, pattern);
    if (!p) return default_val;
    p += strlen(pattern);
    while (*p == ' ' || *p == '\\t') p++;
    int val = default_val;
    sscanf(p, "%d", &val);
    return val;
}

void poly_set_int(const char* key, int val) {
    FILE *f = fopen("${SHARED_PATH_ESC}", "r");
    char buf[4096] = "{}";
    if (f) {
        size_t n = fread(buf, 1, sizeof(buf)-1, f);
        fclose(f);
        buf[n] = '\\0';
    }
    char newbuf[4096];
    char pattern[128];
    sprintf(pattern, "\\"%s\\":", key);
    char *p = strstr(buf, pattern);
    if (p) {
        char *end = strpbrk(p, ",}");
        if (end) {
            *p = '\\0';
            sprintf(newbuf, "%s\\"%s\\": %d%s", buf, key, val, end);
        } else {
            sprintf(newbuf, "{\\"%s\\": %d}", key, val);
        }
    } else {
        if (strlen(buf) > 2) {
            buf[strlen(buf)-1] = '\\0';
            sprintf(newbuf, "%s, \\"%s\\": %d}", buf, key, val);
        } else {
            sprintf(newbuf, "{\\"%s\\": %d}", key, val);
        }
    }
    f = fopen("${SHARED_PATH_ESC}", "w");
    if (f) {
        fputs(newbuf, f);
        fclose(f);
    }
}
`;

  let sharedMemoryData = {};
  if (fs.existsSync(SHARED_MEM_FILE)) {
    try { sharedMemoryData = JSON.parse(fs.readFileSync(SHARED_MEM_FILE, 'utf8')); } catch(e){}
  }

  let autoLoads = '';
  for (const [k, v] of Object.entries(sharedMemoryData)) {
    if (typeof v === 'number' && Number.isInteger(v)) {
      autoLoads += `    int ${k} = poly_get_int("${k}", ${v});\n`;
    }
  }

  let mainBody;
  if (/int\s+main\s*\(/.test(code)) {
    mainBody = code.replace(/(int\s+main\s*\([^)]*\)\s*\{)/, `$1\n${autoLoads}`);
  } else {
    mainBody = `int main() {\n${autoLoads}${code}\n    return 0;\n}`;
  }
  return `${headers}\n${helperFunctions}\n${mainBody}`;
}

// 4. C++
function wrapCpp(code) {
  const headers = '#include <iostream>\n#include <fstream>\n#include <string>\n#include <cstdio>\n#include <cstdlib>\n#include <cstring>\nusing namespace std;\n';
  const cWrapped = wrapC(code);
  return `${headers}\n${cWrapped}`;
}

// 5. Java
function wrapJava(code) {
  let sharedMemoryData = {};
  if (fs.existsSync(SHARED_MEM_FILE)) {
    try { sharedMemoryData = JSON.parse(fs.readFileSync(SHARED_MEM_FILE, 'utf8')); } catch(e){}
  }

  let autoDeclarations = '';
  for (const [k, v] of Object.entries(sharedMemoryData)) {
    if (typeof v === 'number' && Number.isInteger(v)) {
      autoDeclarations += `        int ${k} = ${v};\n`;
    } else if (typeof v === 'string') {
      autoDeclarations += `        String ${k} = "${v.replace(/"/g, '\\"')}";\n`;
    }
  }

  if (code.includes('class PolyTemp') || code.includes('public class')) {
    if (code.includes('public static void main')) {
      return code.replace(/(public\s+static\s+void\s+main\s*\([^)]*\)\s*\{)/, `$1\n${autoDeclarations}`);
    }
    return code;
  }

  return [
    'import java.io.*;',
    'import java.util.*;',
    'public class PolyTemp {',
    '    public static void main(String[] args) {',
    autoDeclarations,
    ...code.split('\n').map(l => '        ' + l),
    '    }',
    '}'
  ].join('\n');
}

// 6. Go
function wrapGo(code) {
  let sharedMemoryData = {};
  if (fs.existsSync(SHARED_MEM_FILE)) {
    try { sharedMemoryData = JSON.parse(fs.readFileSync(SHARED_MEM_FILE, 'utf8')); } catch(e){}
  }

  let autoDeclarations = '';
  for (const [k, v] of Object.entries(sharedMemoryData)) {
    if (typeof v === 'number' && Number.isInteger(v)) {
      autoDeclarations += `\t${k} := ${v}\n\t_ = ${k}\n`;
    } else if (typeof v === 'string') {
      autoDeclarations += `\t${k} := "${v.replace(/"/g, '\\"')}"\n\t_ = ${k}\n`;
    }
  }

  if (code.includes('func main()')) {
    let goCode = code.includes('package main') ? code : `package main\n\nimport "fmt"\n\n${code}`;
    return goCode.replace(/(func\s+main\s*\(\s*\)\s*\{)/, `$1\n${autoDeclarations}`);
  }

  return `package main

import "fmt"

func main() {
${autoDeclarations}
${code.split('\n').map(l => '\t' + l).join('\n')}
}
`;
}

// 7. Rust
function wrapRust(code) {
  let sharedMemoryData = {};
  if (fs.existsSync(SHARED_MEM_FILE)) {
    try { sharedMemoryData = JSON.parse(fs.readFileSync(SHARED_MEM_FILE, 'utf8')); } catch(e){}
  }

  let autoDeclarations = '';
  for (const [k, v] of Object.entries(sharedMemoryData)) {
    if (typeof v === 'number' && Number.isInteger(v)) {
      autoDeclarations += `    let ${k} = ${v};\n`;
    } else if (typeof v === 'string') {
      autoDeclarations += `    let ${k} = "${v.replace(/"/g, '\\"')}";\n`;
    }
  }

  if (code.includes('fn main()')) {
    return code.replace(/(fn\s+main\s*\(\s*\)\s*\{)/, `$1\n${autoDeclarations}`);
  }

  return `fn main() {
${autoDeclarations}
${code.split('\n').map(l => '    ' + l).join('\n')}
}
`;
}

// ── Language Executors ──────────────────────────────

async function executePython(code) {
  const wrapped = wrapPython(code);
  const file = path.join(TEMP_DIR, 'temp.py');
  fs.writeFileSync(file, wrapped, 'utf8');
  // -B flag skips writing bytecode (.pyc) to disk
  const pyCmd = process.platform === 'win32' ? 'python -B' : 'python3 -B';
  const r = await run(`${pyCmd} "${file}"`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeJavaScript(code) {
  const wrapped = wrapJavaScript(code);
  const file = path.join(TEMP_DIR, 'temp.js');
  fs.writeFileSync(file, wrapped, 'utf8');
  const r = await run(`node "${file}"`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeTypeScript(code) {
  const wrapped = wrapJavaScript(code);
  const file = path.join(TEMP_DIR, 'temp.ts');
  fs.writeFileSync(file, wrapped, 'utf8');

  // 1. Try native Node strip-types (Node 22+: runs in < 200ms)
  let r = await run(`node --strip-types "${file}"`);
  if (!r.exitCode) {
    return { output: r.stdout.trim(), error: null };
  }

  // 2. Direct tsx local binary without npx registry lookup
  const localTsx = path.resolve(__dirname, '../../node_modules/tsx/dist/cli.mjs');
  if (fs.existsSync(localTsx)) {
    r = await run(`node "${localTsx}" "${file}"`);
    return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
  }

  // 3. Fallback
  r = await run(`npx --no-install tsx "${file}"`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeC(code) {
  const wrapped = wrapC(code);
  const isWin = process.platform === 'win32';
  const src = path.join(TEMP_DIR, 'temp.c');
  fs.writeFileSync(src, wrapped, 'utf8');

  // 1. On Linux/Docker, tcc compiles and runs in memory in ~5ms
  if (!isWin) {
    const tccRun = await run(`tcc -run "${src}"`);
    if (!tccRun.exitCode) {
      return { output: tccRun.stdout.trim(), error: null };
    }
  }

  // 2. Fast compilation with GCC -O0 -pipe
  const out = path.join(TEMP_DIR, isWin ? 'temp_c.exe' : 'temp_c');
  const compile = await run(`gcc -O0 -pipe -s "${src}" -o "${out}"`);
  if (compile.exitCode) return { output: '', error: compile.stderr.trim() };

  const r = await run(`"${out}"`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeCpp(code) {
  const wrapped = wrapCpp(code);
  const isWin = process.platform === 'win32';
  const src = path.join(TEMP_DIR, 'temp.cpp');
  const out = path.join(TEMP_DIR, isWin ? 'temp_cpp.exe' : 'temp_cpp');
  fs.writeFileSync(src, wrapped, 'utf8');

  // -O0 -pipe -s for fastest compilation without debug overhead
  const compile = await run(`g++ -O0 -pipe -s "${src}" -o "${out}"`);
  if (compile.exitCode) return { output: '', error: compile.stderr.trim() };

  const r = await run(`"${out}"`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeJava(code) {
  const wrapped = wrapJava(code);
  const file = path.join(TEMP_DIR, 'PolyTemp.java');
  fs.writeFileSync(file, wrapped, 'utf8');

  // 1. Single-file execution (Java 11+: in-memory, no javac required)
  const direct = await run(`java -Xms32m -Xmx128m -Dfile.encoding=UTF-8 "${file}"`);
  if (!direct.exitCode) {
    return { output: direct.stdout.trim(), error: null };
  }

  // 2. Fast javac fallback
  const compile = await run(`javac -J-Xms32m -J-Xmx128m -encoding UTF-8 "${file}"`);
  if (compile.exitCode) return { output: '', error: compile.stderr.trim() };

  const r = await run(`java -Xms32m -Xmx128m -Dfile.encoding=UTF-8 -cp "${TEMP_DIR}" PolyTemp`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeGo(code) {
  const wrapped = wrapGo(code);
  const file = path.join(TEMP_DIR, 'temp.go');
  fs.writeFileSync(file, wrapped, 'utf8');
  const r = await run(`go run "${file}"`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeRust(code) {
  const wrapped = wrapRust(code);
  const isWin = process.platform === 'win32';
  const src = path.join(TEMP_DIR, 'temp.rs');
  const out = path.join(TEMP_DIR, isWin ? 'temp_rs.exe' : 'temp_rs');
  fs.writeFileSync(src, wrapped, 'utf8');

  // -C opt-level=0 -C debuginfo=0 -C codegen-units=16 for 10x faster compilation
  const rustcCmd = isWin
    ? `"C:\\Program Files\\Rust stable GNU 1.99\\bin\\rustc.exe" -C opt-level=0 -C debuginfo=0 -C codegen-units=16 --sysroot "C:\\Program Files\\Rust stable GNU 1.99" -C link-self-contained=yes "${src}" -o "${out}"`
    : `rustc -C opt-level=0 -C debuginfo=0 -C codegen-units=16 "${src}" -o "${out}"`;

  const compile = await run(rustcCmd);
  if (compile.exitCode) return { output: '', error: compile.stderr.trim() };

  const r = await run(`"${out}"`);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

const EXECUTORS = {
  python: executePython,
  javascript: executeJavaScript,
  typescript: executeTypeScript,
  c: executeC,
  cpp: executeCpp,
  java: executeJava,
  go: executeGo,
  rust: executeRust
};

// ── Master Execution Flow ───────────────────────────

async function executeCode(code) {
  ensureTempDir();
  resetSharedMemory();

  const { blocks, detectedLines } = splitCode(code);
  const results = [];

  for (const block of blocks) {
    const executor = EXECUTORS[block.language];
    if (!executor) {
      results.push({
        language: block.language,
        lines: block.originalLineNumbers,
        output: '',
        error: `No runtime for "${block.language}"`,
      });
      continue;
    }

    try {
      const codeText = block.lines.join('\n');
      const { output, error } = await executor(codeText);
      results.push({ language: block.language, lines: block.originalLineNumbers, output, error });
    } catch (e) {
      results.push({ language: block.language, lines: block.originalLineNumbers, output: '', error: e.message });
    }
  }

  const output = results
    .map(r => (r.error ? `[${r.language.toUpperCase()} ERROR] ${r.error}` : r.output))
    .filter(Boolean)
    .join('\n');

  return { results, output, detectedLines };
}

module.exports = { executeCode };
