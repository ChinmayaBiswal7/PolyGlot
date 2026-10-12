// ═══════════════════════════════════════════════════
//  PolyGlot IDE — Web Client
//  Monaco editor + language detection + run via fetch
// ═══════════════════════════════════════════════════

let editor;
let decorations = [];

const LANG_COLORS = {
  python:     { color: '#3572A5', label: 'Python 🐍' },
  rust:       { color: '#dea584', label: 'Rust 🦀' },
  go:         { color: '#00ADD8', label: 'Go 🐹' },
  typescript: { color: '#3178c6', label: 'TypeScript 📘' },
  javascript: { color: '#f1e05a', label: 'JS 🌐' },
  java:       { color: '#b07219', label: 'Java ☕' },
  c:          { color: '#555555', label: 'C 🔧' },
  cpp:        { color: '#f34b7d', label: 'C++ ⚡' },
};

function getSampleCode() {
  return [
    '# Welcome to PolyGlot IDE!',
    '# Write code in ANY language — it just works.',
    '',
    'print("Hello from Python! 🐍")',
    '',
    'System.out.println("Hello from Java! ☕");',
    '',
    'printf("Hello from C! 🔧\\n");',
    '',
    'cout << "Hello from C++! ⚡" << endl;',
    '',
    'console.log("Hello from JavaScript! 🌐");',
  ].join('\n');
}

// ── Initialize Monaco Editor ──
require.config({
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' },
});

require(['vs/editor/editor.main'], function () {
  monaco.editor.defineTheme('polyglot-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background':                 '#0d1117',
      'editor.foreground':                 '#e6edf3',
      'editorLineNumber.foreground':       '#484f58',
      'editorLineNumber.activeForeground': '#8b949e',
      'editor.selectionBackground':        '#264f78',
      'editor.lineHighlightBackground':    '#161b22',
      'editorCursor.foreground':           '#58a6ff',
      'editor.inactiveSelectionBackground':'#1c3050',
    },
  });

  editor = monaco.editor.create(document.getElementById('editor'), {
    value: getSampleCode(),
    language: 'plaintext',
    theme: 'polyglot-dark',
    fontSize: 14,
    fontFamily: "'Cascadia Code','Fira Code','JetBrains Mono',Consolas,monospace",
    fontLigatures: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    glyphMargin: false,
    folding: false,
    renderLineHighlight: 'line',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    padding: { top: 16, bottom: 16 },
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    tabSize: 4,
    wordWrap: 'on',
    automaticLayout: true,
    lineDecorationsWidth: 14,
    suggest: { showWords: false },
  });

  // Detect languages on change (debounced)
  let detectTimer;
  editor.onDidChangeModelContent(() => {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(updateLanguageBadges, 300);
  });

  // Ctrl+Enter → Run
  editor.addAction({
    id: 'polyglot-run',
    label: 'Run Code',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => runCode(),
  });

  // Initial detection
  updateLanguageBadges();
});

// ── Language Detection → Badges + Gutter Bars ──
async function updateLanguageBadges() {
  if (!editor) return;

  const code = editor.getValue();
  let detectedLines = [];

  try {
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    detectedLines = await res.json();
  } catch (err) {
    console.error('Detection request failed:', err);
    return;
  }

  const languages = new Set();
  const newDecorations = [];

  for (const line of detectedLines) {
    const info = LANG_COLORS[line.language];
    if (!info) continue;

    languages.add(line.language);

    newDecorations.push({
      range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
      options: {
        isWholeLine: true,
        linesDecorationsClassName: 'lang-decoration-' + line.language,
      },
    });
  }

  // Update toolbar badges
  const container = document.getElementById('languageBadges');
  container.innerHTML = '';
  for (const lang of languages) {
    const info = LANG_COLORS[lang];
    const el = document.createElement('span');
    el.className = 'badge';
    el.textContent = info.label;
    el.style.color = info.color;
    el.style.borderColor = info.color;
    container.appendChild(el);
  }

  // Update gutter decorations
  decorations = editor.deltaDecorations(decorations, newDecorations);
}

// ── Run Code ──
async function runCode() {
  const btn = document.getElementById('runBtn');
  btn.innerHTML = '<span class="run-icon">⏳</span> Running…';
  btn.classList.add('running');

  try {
    const code = editor.getValue();
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const result = await res.json();
    displayResults(result);
  } catch (e) {
    showOutput('Execution error: ' + e.message, true);
  } finally {
    btn.innerHTML = '<span class="run-icon">▶</span> Run';
    btn.classList.remove('running');
  }
}

// ── Display Results ──
function displayResults(result) {
  const el = document.getElementById('outputContent');
  el.innerHTML = '';

  if (!result.results || result.results.length === 0) {
    el.innerHTML = '<span class="placeholder">No executable code detected.</span>';
    return;
  }

  for (const r of result.results) {
    const info = LANG_COLORS[r.language] || { color: '#8b949e', label: r.language };

    const header = document.createElement('div');
    header.className = 'lang-label';
    header.style.color = info.color;
    header.textContent = '── ' + info.label + ' ──';
    el.appendChild(header);

    const line = document.createElement('div');
    if (r.error) {
      line.className = 'error-text';
      line.textContent = r.error;
    } else {
      line.className = 'success-text';
      line.textContent = r.output || '(no output)';
    }
    el.appendChild(line);

    const spacer = document.createElement('div');
    spacer.style.height = '8px';
    el.appendChild(spacer);
  }
}

function showOutput(text, isError) {
  const el = document.getElementById('outputContent');
  el.innerHTML = `<span class="${isError ? 'error-text' : 'success-text'}">${escapeHtml(text)}</span>`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Clear Button ──
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('outputContent').innerHTML =
    '<span class="placeholder">Press ▶ Run or Ctrl+Enter to execute…</span>';
});

// ── Run Button ──
document.getElementById('runBtn').addEventListener('click', () => runCode());

// ── Resize Handle ──
(function initResize() {
  const handle = document.getElementById('resizeHandle');
  const panel = document.getElementById('outputPanel');
  let startY, startH;

  handle.addEventListener('mousedown', (e) => {
    startY = e.clientY;
    startH = panel.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    function onMove(e) {
      const delta = startY - e.clientY;
      const newH = Math.min(Math.max(startH + delta, 80), window.innerHeight - 250);
      panel.style.height = newH + 'px';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
})();
