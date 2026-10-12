'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { splitCode } = require('./splitter');

// ═══════════════════════════════════════════════════════════
//  Execution Engine & Shared Memory Bridge
//  Full OOP, Pointers, Structs, Functions, and Standard Libs
// ═══════════════════════════════════════════════════════════

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

/**
 * Execute shell command with stdin support.
 */
function run(cmd, stdinInput = '') {
  return new Promise((resolve) => {
    const child = exec(cmd, { cwd: TEMP_DIR, maxBuffer: 10 * 1024 * 1024, timeout: 20000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? (error.code || 1) : 0,
      });
    });

    if (stdinInput && child.stdin) {
      child.stdin.write(stdinInput);
      child.stdin.end();
    } else if (child.stdin) {
      child.stdin.end();
    }
  });
}

const SHARED_PATH_ESC = SHARED_MEM_FILE.replace(/\\/g, '\\\\');

// ── Shared Memory Wrappers ──────────────────────────────────

// 1. Python
function wrapPython(code) {
  const cleanCode = code.replace(/^\s*\/\/(.*)$/gm, '# $1');
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

# --- Headless Matplotlib Support for Data Science & ML ---
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
except Exception:
    pass

# --- User Code ---
${cleanCode}

# --- Auto Plot Extractor for ML / Data Science ---
try:
    import matplotlib.pyplot as _plt
    if _plt.get_fignums():
        import io as _io, base64 as _b64
        _buf = _io.BytesIO()
        _plt.savefig(_buf, format='png', bbox_inches='tight', dpi=110)
        _buf.seek(0)
        _plot_b64 = _b64.b64encode(_buf.read()).decode('utf-8')
        print("__POLYGLOT_PLOT__:" + _plot_b64)
        _plt.close('all')
except Exception:
    pass

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
      autoDeclarations += `var ${k} = ${v};\nglobal.${k} = ${v};\n`;
    } else if (typeof v === 'string') {
      autoDeclarations += `var ${k} = "${v.replace(/"/g, '\\"')}";\nglobal.${k} = "${v.replace(/"/g, '\\"')}";\n`;
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
${exportSnippets}

try {
  let _current = {};
  if (fs.existsSync(_shared_file)) {
    try { _current = JSON.parse(fs.readFileSync(_shared_file, 'utf8')); } catch (e) {}
  }
  Object.assign(_current, _export);
  fs.writeFileSync(_shared_file, JSON.stringify(_current), 'utf8');
} catch (e) {}
`;
}

// 3. C
function wrapC(code) {
  let sharedMemoryData = {};
  if (fs.existsSync(SHARED_MEM_FILE)) {
    try { sharedMemoryData = JSON.parse(fs.readFileSync(SHARED_MEM_FILE, 'utf8')); } catch(e){}
  }

  const hasShared = Object.keys(sharedMemoryData).length > 0;
  const hasMain = /\b(?:int|void|signed)\s+main\s*\([^)]*\)/m.test(code) || /\bmain\s*\([^)]*\)\s*\{/m.test(code);

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

void poly_set_str(const char* key, const char* val) {
    FILE *f = fopen("${SHARED_PATH_ESC}", "r");
    char buf[8192] = "{}";
    if (f) {
        size_t n = fread(buf, 1, sizeof(buf)-1, f);
        fclose(f);
        buf[n] = '\\0';
    }
    char newbuf[8192];
    char pattern[128];
    sprintf(pattern, "\\"%s\\":", key);
    char *p = strstr(buf, pattern);
    if (p) {
        char *end = strpbrk(p, ",}");
        if (end) {
            *p = '\\0';
            sprintf(newbuf, "%s\\"%s\\": \\"%s\\"%s", buf, key, val, end);
        } else {
            sprintf(newbuf, "{\\"%s\\": \\"%s\\"}", key, val);
        }
    } else {
        if (strlen(buf) > 2) {
            buf[strlen(buf)-1] = '\\0';
            sprintf(newbuf, "%s, \\"%s\\": \\"%s\\"}", buf, key, val);
        } else {
            sprintf(newbuf, "{\\"%s\\": \\"%s\\"}", key, val);
        }
    }
    f = fopen("${SHARED_PATH_ESC}", "w");
    if (f) {
        fputs(newbuf, f);
        fclose(f);
    }
}
`;

  let autoLoads = '';
  for (const [k, v] of Object.entries(sharedMemoryData)) {
    if (typeof v === 'number' && Number.isInteger(v)) {
      autoLoads += `    int ${k} = poly_get_int("${k}", ${v});\n`;
    }
  }

  const cCharVars = [...code.matchAll(/\bchar\s+(?:\*\s*([a-zA-Z_$][a-zA-Z0-9_$]*)|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\[)/g)].map(m => m[1] || m[2]);
  const cIntVars = [...code.matchAll(/\bint\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g)].map(m => m[1]);
  let autoExports = '';
  for (const v of cCharVars) autoExports += `    poly_set_str("${v}", ${v});\n`;
  for (const v of cIntVars) autoExports += `    poly_set_int("${v}", ${v});\n`;

  // Required header includes if not present
  let headers = '';
  if (!code.includes('<stdio.h>')) headers += '#include <stdio.h>\n';
  if (!code.includes('<stdlib.h>')) headers += '#include <stdlib.h>\n';
  if (!code.includes('<string.h>')) headers += '#include <string.h>\n';

  if (hasMain) {
    let mainBody = code;
    if (autoLoads) {
      mainBody = mainBody.replace(/((?:int|void|signed)\s+main\s*\([^)]*\)\s*\{)/, `$1\n${autoLoads}`);
    }
    if (autoExports && mainBody.includes('return 0;')) {
      mainBody = mainBody.replace(/return\s+0\s*;/, `${autoExports}    return 0;`);
    }
    return `${headers}\n${hasShared ? helperFunctions : ''}\n${mainBody}`;
  }

  // Snippet mode: separate functions/structs/typedefs from statements
  const lines = code.split('\n');
  const decls = [];
  const stmts = [];
  let inFuncOrStruct = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (inFuncOrStruct) {
      decls.push(line);
      braceDepth += opens - closes;
      if (braceDepth <= 0) inFuncOrStruct = false;
      continue;
    }

    if (/^(?:struct|typedef|enum|union)\b/.test(trimmed) ||
        /^(?:void|int|char|double|float|long|bool)\s+[A-Za-z0-9_$]+\s*\([^)]*\)\s*\{?/.test(trimmed)) {
      decls.push(line);
      braceDepth = opens - closes;
      if (braceDepth > 0) inFuncOrStruct = true;
      continue;
    }

    if (/^#\s*include\b/.test(trimmed) || /^#\s*define\b/.test(trimmed)) {
      decls.push(line);
      continue;
    }

    stmts.push(line);
  }

  return `${headers}
${helperFunctions}
${decls.join('\n')}

int main() {
${autoLoads}
${stmts.join('\n')}
${autoExports}    return 0;
}
`;
}

// 4. C++
function wrapCpp(code) {
  const hasMain = /\b(?:int|void|signed)\s+main\s*\([^)]*\)/m.test(code) || /\bmain\s*\([^)]*\)\s*\{/m.test(code);

  let headers = '';
  if (!code.includes('<iostream>')) headers += '#include <iostream>\n';
  if (!code.includes('using namespace std;') && !code.includes('std::')) {
    headers += 'using namespace std;\n';
  }

  if (hasMain) {
    return `${headers}\n${code}`;
  }

  // Snippet mode for C++
  const lines = code.split('\n');
  const decls = [];
  const stmts = [];
  let inBlock = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (inBlock) {
      decls.push(line);
      braceDepth += opens - closes;
      if (braceDepth <= 0) inBlock = false;
      continue;
    }

    if (/^(?:class|struct|enum|union|template|namespace)\b/.test(trimmed) ||
        /^(?:void|int|char|double|float|long|bool|auto|string)\s+[A-Za-z0-9_$]+\s*\([^)]*\)\s*\{?/.test(trimmed)) {
      decls.push(line);
      braceDepth = opens - closes;
      if (braceDepth > 0) inBlock = true;
      continue;
    }

    if (/^#\s*include\b/.test(trimmed) || /^using\s+namespace\b/.test(trimmed)) {
      decls.push(line);
      continue;
    }

    stmts.push(line);
  }

  return `${headers}
${decls.join('\n')}

int main() {
${stmts.join('\n')}
    return 0;
}
`;
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

  if (/\bscanner\./i.test(code) && !/new\s+Scanner/i.test(code)) {
    autoDeclarations += `        Scanner scanner = new Scanner(System.in.available() > 0 ? System.in : new ByteArrayInputStream("World\\n".getBytes()));\n`;
  }

  // Determine class name: public class X, or class X with main, or PolyTemp
  const pubMatch = code.match(/public\s+class\s+([A-Za-z0-9_$]+)/);
  const mainClassMatch = code.match(/class\s+([A-Za-z0-9_$]+)[^{]*\{[\s\S]*?public\s+static\s+void\s+main/);
  const anyClassMatch = code.match(/\bclass\s+([A-Za-z0-9_$]+)/);

  let className = 'PolyTemp';
  if (pubMatch) {
    className = pubMatch[1];
  } else if (mainClassMatch) {
    className = mainClassMatch[1];
  } else if (code.includes('public static void main') && anyClassMatch) {
    className = anyClassMatch[1];
  }

  const hasMain = /\bpublic\s+static\s+void\s+main\b/.test(code);

  if (hasMain) {
    let result = code;
    if (autoDeclarations) {
      result = result.replace(/(public\s+static\s+void\s+main\s*\([^)]*\)\s*\{)/, `$1\n${autoDeclarations}`);
    }
    // Ensure common imports exist
    let imports = '';
    if (!code.includes('import java.util.')) imports += 'import java.util.*;\n';
    if (!code.includes('import java.io.')) imports += 'import java.io.*;\n';
    return { code: `${imports}\n${result}`, className };
  }

  // Snippet mode: move user classes outside PolyTemp, put statements in main()
  const lines = code.split('\n');
  const outsideClasses = [];
  const insideStmts = [];
  let inClass = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (inClass) {
      outsideClasses.push(line);
      braceDepth += opens - closes;
      if (braceDepth <= 0) inClass = false;
      continue;
    }

    if (/^(?:(?:public|private|protected)\s+)?(?:abstract\s+|final\s+)?(?:class|interface|enum)\b/.test(trimmed)) {
      outsideClasses.push(line);
      braceDepth = opens - closes;
      if (braceDepth > 0) inClass = true;
      continue;
    }

    if (/^import\s+java\./.test(trimmed)) {
      outsideClasses.push(line);
      continue;
    }

    insideStmts.push(line);
  }

  const wrapped = `import java.io.*;
import java.util.*;

${outsideClasses.join('\n')}

public class PolyTemp {
    public static void main(String[] args) throws Exception {
${autoDeclarations}
${insideStmts.map(l => '        ' + l).join('\n')}
    }
}
`;
  return { code: wrapped, className: 'PolyTemp' };
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

  const hasMain = /\bfunc\s+main\s*\(\s*\)/m.test(code);
  const hasPackage = /^\s*package\s+\w+/m.test(code);

  if (hasMain) {
    let goCode = code;
    if (!hasPackage) goCode = `package main\n\n${goCode}`;
    if (!goCode.includes('"fmt"') && /\bfmt\./.test(goCode)) {
      goCode = goCode.replace(/(package\s+main\s*\n)/, `$1\nimport "fmt"\n`);
    }
    if (autoDeclarations) {
      goCode = goCode.replace(/(func\s+main\s*\(\s*\)\s*\{)/, `$1\n${autoDeclarations}`);
    }
    return goCode;
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

  const hasMain = /\bfn\s+main\s*\(\s*\)/m.test(code);

  if (hasMain) {
    if (autoDeclarations) {
      return code.replace(/(fn\s+main\s*\(\s*\)\s*\{)/, `$1\n${autoDeclarations}`);
    }
    return code;
  }

  return `fn main() {
${autoDeclarations}
${code.split('\n').map(l => '    ' + l).join('\n')}
}
`;
}

// ── Language Executors ──────────────────────────────

async function executePython(code, stdin = '') {
  const wrapped = wrapPython(code);
  const file = path.join(TEMP_DIR, 'temp.py');
  fs.writeFileSync(file, wrapped, 'utf8');
  const pyCmd = process.platform === 'win32' ? 'python -B' : 'python3 -B';
  const r = await run(`${pyCmd} "${file}"`, stdin);

  let rawOut = r.stdout;
  let plot = null;
  let chart = null;

  const plotMatch = rawOut.match(/__POLYGLOT_PLOT__:([A-Za-z0-9+/=]+)/);
  if (plotMatch) {
    plot = plotMatch[1];
    rawOut = rawOut.replace(/__POLYGLOT_PLOT__:[A-Za-z0-9+/=]+/, '');
  }

  const chartMatch = rawOut.match(/__POLYGLOT_CHART__:(\{.*?\})/);
  if (chartMatch) {
    try {
      chart = JSON.parse(chartMatch[1]);
      rawOut = rawOut.replace(/__POLYGLOT_CHART__:\{.*?\}/, '');
    } catch (e) {}
  }

  return {
    output: rawOut.trim(),
    error: r.exitCode ? r.stderr.trim() : null,
    plot,
    chart
  };
}

async function executeJavaScript(code, stdin = '') {
  const wrapped = wrapJavaScript(code);
  const file = path.join(TEMP_DIR, 'temp.js');
  fs.writeFileSync(file, wrapped, 'utf8');
  const r = await run(`node "${file}"`, stdin);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeTypeScript(code, stdin = '') {
  const wrapped = wrapJavaScript(code);
  const file = path.join(TEMP_DIR, 'temp.ts');
  fs.writeFileSync(file, wrapped, 'utf8');

  // 1. Try native Node strip-types (Node 22+: runs in < 200ms)
  let r = await run(`node --strip-types "${file}"`, stdin);
  if (!r.exitCode) {
    return { output: r.stdout.trim(), error: null };
  }

  // 2. Direct tsx local binary without npx registry lookup
  const localTsx = path.resolve(__dirname, '../../node_modules/tsx/dist/cli.mjs');
  if (fs.existsSync(localTsx)) {
    r = await run(`node "${localTsx}" "${file}"`, stdin);
    return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
  }

  // 3. Fallback
  r = await run(`npx --no-install tsx "${file}"`, stdin);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeC(code, stdin = '') {
  const wrapped = wrapC(code);
  const isWin = process.platform === 'win32';
  const src = path.join(TEMP_DIR, 'temp.c');
  fs.writeFileSync(src, wrapped, 'utf8');

  // 1. On Linux/Docker, tcc compiles and runs in memory in ~5ms
  if (!isWin) {
    const tccRun = await run(`tcc -run "${src}"`, stdin);
    if (!tccRun.exitCode) {
      return { output: tccRun.stdout.trim(), error: null };
    }
  }

  // 2. Fast compilation with GCC -O0 -pipe
  const out = path.join(TEMP_DIR, isWin ? 'temp_c.exe' : 'temp_c');
  const compile = await run(`gcc -O0 -pipe -s "${src}" -o "${out}"`);
  if (compile.exitCode) return { output: '', error: compile.stderr.trim() };

  const r = await run(`"${out}"`, stdin);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeCpp(code, stdin = '') {
  const wrapped = wrapCpp(code);
  const isWin = process.platform === 'win32';
  const src = path.join(TEMP_DIR, 'temp.cpp');
  const out = path.join(TEMP_DIR, isWin ? 'temp_cpp.exe' : 'temp_cpp');
  fs.writeFileSync(src, wrapped, 'utf8');

  // -O0 -pipe -s for fastest compilation without debug overhead
  const compile = await run(`g++ -O0 -pipe -s "${src}" -o "${out}"`);
  if (compile.exitCode) return { output: '', error: compile.stderr.trim() };

  const r = await run(`"${out}"`, stdin);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeJava(code, stdin = '') {
  const { code: wrapped, className } = wrapJava(code);
  const file = path.join(TEMP_DIR, `${className}.java`);
  fs.writeFileSync(file, wrapped, 'utf8');

  // 1. Single-file execution (Java 11+: in-memory, no javac required)
  const direct = await run(`java -Xms32m -Xmx128m -Dfile.encoding=UTF-8 "${file}"`, stdin);
  if (!direct.exitCode) {
    return { output: direct.stdout.trim(), error: null };
  }

  // 2. Fast javac fallback
  const compile = await run(`javac -J-Xms32m -J-Xmx128m -encoding UTF-8 "${file}"`);
  if (compile.exitCode) return { output: '', error: compile.stderr.trim() };

  const r = await run(`java -Xms32m -Xmx128m -Dfile.encoding=UTF-8 -cp "${TEMP_DIR}" ${className}`, stdin);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeGo(code, stdin = '') {
  const wrapped = wrapGo(code);
  const file = path.join(TEMP_DIR, 'temp.go');
  fs.writeFileSync(file, wrapped, 'utf8');
  const r = await run(`go run "${file}"`, stdin);
  return { output: r.stdout.trim(), error: r.exitCode ? r.stderr.trim() : null };
}

async function executeRust(code, stdin = '') {
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

  const r = await run(`"${out}"`, stdin);
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

async function executeCode(code, stdin = '', filename = '') {
  ensureTempDir();
  resetSharedMemory();

  const { blocks, detectedLines } = splitCode(code, filename);
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
      const res = await executor(codeText, stdin);
      results.push({
        language: block.language,
        lines: block.originalLineNumbers,
        output: res.output,
        error: res.error,
        plot: res.plot || null,
        chart: res.chart || null
      });
    } catch (e) {
      results.push({ language: block.language, lines: block.originalLineNumbers, output: '', error: e.message });
    }
  }

  const output = results
    .map(r => (r.error ? `[${r.language.toUpperCase()} ERROR] ${r.error}` : r.output))
    .filter(Boolean)
    .join('\n');

  const plot = results.find(r => r.plot)?.plot || null;
  const chart = results.find(r => r.chart)?.chart || null;

  return { results, output, detectedLines, plot, chart };
}

module.exports = { executeCode };
