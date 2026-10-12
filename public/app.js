// ═══════════════════════════════════════════════════
//  PolyGlot IDE — Web Client with Live Collaboration
//  Monaco editor + language detection + File Explorer
// ═══════════════════════════════════════════════════

let editor;
let decorations = [];
let isRemoteUpdate = false;
let socket = null;

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

// ── Multi-File Project State ──
const projectFiles = {
  'main.poly': [
    '# Welcome to PolyGlot IDE!',
    '# Write in ANY language in one file or multiple files.',
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
  ].join('\n'),

  'algorithms/prime.poly': [
    '# Multi-Language Prime Pipeline',
    'n = 29',
    'print(f"Checking prime for: {n}")',
    '',
    'int is_prime = 1;',
    'for (int i = 2; i * i <= n; i++) {',
    '    if (n % i == 0) { is_prime = 0; break; }',
    '}',
    'poly_set_int("is_prime", is_prime);',
    '',
    'const status = is_prime === 1 ? "PRIME" : "NOT PRIME";',
    'console.log(`Result: ${n} is ${status}! 🎉`);',
  ].join('\n'),

  'systems/demo.rs': [
    '// Standalone Rust or Mixed File',
    'println!("Rust says: hello from the systems thread!");',
    'fmt.Println("Go says: hello concurrently!");',
  ].join('\n'),
};

let activeFileName = 'main.poly';
const openTabs = ['main.poly', 'algorithms/prime.poly'];

// ── Room ID from URL Hash ──
function getOrCreateRoom() {
  let hash = window.location.hash.replace('#', '').trim();
  if (!hash) {
    hash = 'room-' + Math.random().toString(36).substring(2, 8);
    window.location.hash = hash;
  }
  return hash;
}

const currentRoom = getOrCreateRoom();

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
    value: projectFiles[activeFileName],
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

  // Save changes to active file & broadcast
  let detectTimer;
  editor.onDidChangeModelContent(() => {
    projectFiles[activeFileName] = editor.getValue();

    if (!isRemoteUpdate && socket) {
      socket.emit('code-change', {
        room: currentRoom,
        fileName: activeFileName,
        code: editor.getValue()
      });
    }

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

  // Ctrl+B → Toggle Sidebar
  editor.addAction({
    id: 'polyglot-toggle-sidebar',
    label: 'Toggle Sidebar',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
    run: () => toggleSidebar(),
  });

  renderFileTree();
  renderTabs();
  updateLanguageBadges();
  initRealtime();
});

// ── File Explorer & Tabs Management ──

function renderFileTree() {
  const container = document.getElementById('fileTree');
  if (!container) return;
  container.innerHTML = '';

  const paths = Object.keys(projectFiles).sort();

  for (const filePath of paths) {
    const item = document.createElement('div');
    item.className = 'tree-item' + (filePath === activeFileName ? ' active' : '');
    
    // Choose icon based on name
    let icon = '📄';
    if (filePath.endsWith('.poly')) icon = '◈';
    else if (filePath.endsWith('.rs')) icon = '🦀';
    else if (filePath.endsWith('.py')) icon = '🐍';
    else if (filePath.endsWith('.c') || filePath.endsWith('.cpp')) icon = '🔧';

    item.innerHTML = `<span class="tree-icon">${icon}</span> <span>${escapeHtml(filePath)}</span>`;
    item.addEventListener('click', () => switchFile(filePath));
    container.appendChild(item);
  }
}

function renderTabs() {
  const container = document.getElementById('tabsBar');
  if (!container) return;
  container.innerHTML = '';

  for (const filePath of openTabs) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (filePath === activeFileName ? ' active' : '');
    const baseName = filePath.split('/').pop();

    tab.innerHTML = `
      <span>${escapeHtml(baseName)}</span>
      <span class="tab-close" title="Close">&times;</span>
    `;

    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) {
        closeTab(filePath);
      } else {
        switchFile(filePath);
      }
    });

    container.appendChild(tab);
  }
}

function switchFile(filePath) {
  if (!projectFiles.hasOwnProperty(filePath)) return;
  activeFileName = filePath;

  if (!openTabs.includes(filePath)) {
    openTabs.push(filePath);
  }

  isRemoteUpdate = true;
  editor.setValue(projectFiles[filePath] || '');
  isRemoteUpdate = false;

  renderFileTree();
  renderTabs();
  updateLanguageBadges();
}

function closeTab(filePath) {
  const idx = openTabs.indexOf(filePath);
  if (idx > -1) {
    openTabs.splice(idx, 1);
  }
  if (activeFileName === filePath && openTabs.length > 0) {
    switchFile(openTabs[openTabs.length - 1]);
  } else if (openTabs.length === 0) {
    openTabs.push(filePath);
    switchFile(filePath);
  } else {
    renderTabs();
  }
}

// ── New File / New Folder Buttons ──
document.getElementById('newFileBtn')?.addEventListener('click', () => {
  const name = prompt('Enter new file name (e.g. script.poly, utils.py):');
  if (name && name.trim()) {
    const clean = name.trim();
    if (!projectFiles[clean]) {
      projectFiles[clean] = '// ' + clean + '\n\n';
    }
    switchFile(clean);
  }
});

document.getElementById('newFolderBtn')?.addEventListener('click', () => {
  const folder = prompt('Enter folder/file path (e.g. src/math.poly):');
  if (folder && folder.trim()) {
    const clean = folder.trim();
    if (!projectFiles[clean]) {
      projectFiles[clean] = '// ' + clean + '\n\n';
    }
    switchFile(clean);
  }
});

// ── Sidebar Toggle Button & Keyboard Shortcut (Ctrl+B) ──
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
  }
}

document.getElementById('toggleSidebarBtn')?.addEventListener('click', toggleSidebar);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    toggleSidebar();
  }
});

// ── Real-Time WebSockets Collaboration ──
function initRealtime() {
  if (typeof io === 'undefined') return;

  socket = io();

  socket.on('connect', () => {
    socket.emit('join-room', currentRoom);
  });

  socket.on('code-sync', (code) => {
    if (code && editor && code !== editor.getValue()) {
      isRemoteUpdate = true;
      projectFiles[activeFileName] = code;
      editor.setValue(code);
      isRemoteUpdate = false;
      updateLanguageBadges();
    }
  });

  socket.on('code-update', (data) => {
    if (data.fileName) {
      projectFiles[data.fileName] = data.code;
    }
    if (data.fileName === activeFileName && editor && data.code !== editor.getValue()) {
      isRemoteUpdate = true;
      const pos = editor.getPosition();
      editor.setValue(data.code);
      if (pos) editor.setPosition(pos);
      isRemoteUpdate = false;
      updateLanguageBadges();
    }
  });

  socket.on('user-count', (count) => {
    const el = document.getElementById('userCount');
    if (el) el.textContent = `${count} live`;
  });

  socket.on('run-result', (result) => {
    displayResults(result);
  });
}

// ── Language Detection → Badges + Gutter Bars ──
async function updateLanguageBadges() {
  if (!editor) return;

  const code = editor.getValue();
  let detectedLines = [];

  try {
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, filename: activeFileName })
    });
    detectedLines = await res.json();
  } catch (err) {
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

  const container = document.getElementById('languageBadges');
  if (container) {
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
  }

  decorations = editor.deltaDecorations(decorations, newDecorations);
}

// ── Input / Output Tab Switcher ──
const tabOutputBtn = document.getElementById('tabOutputBtn');
const tabInputBtn = document.getElementById('tabInputBtn');
const outputContent = document.getElementById('outputContent');
const stdinContainer = document.getElementById('stdinContainer');
const stdinInput = document.getElementById('stdinInput');
const stdinDot = document.getElementById('stdinDot');

function switchToOutput() {
  tabOutputBtn?.classList.add('active');
  tabInputBtn?.classList.remove('active');
  if (outputContent) outputContent.style.display = 'block';
  if (stdinContainer) stdinContainer.style.display = 'none';
}

function switchToInput() {
  tabInputBtn?.classList.add('active');
  tabOutputBtn?.classList.remove('active');
  if (outputContent) outputContent.style.display = 'none';
  if (stdinContainer) {
    stdinContainer.style.display = 'flex';
    stdinInput?.focus();
  }
}

tabOutputBtn?.addEventListener('click', switchToOutput);
tabInputBtn?.addEventListener('click', switchToInput);

stdinInput?.addEventListener('input', () => {
  if (stdinDot) {
    stdinDot.style.display = stdinInput.value.trim() ? 'inline' : 'none';
  }
});

// ── Run Code (Local + Sync across peers) ──
async function runCode() {
  const btn = document.getElementById('runBtn');
  btn.innerHTML = '<span class="run-icon">⏳</span> Running…';
  btn.classList.add('running');

  // Switch to output tab so user immediately sees results
  switchToOutput();

  try {
    const code = editor.getValue();
    const stdin = stdinInput?.value || '';
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, stdin, filename: activeFileName })
    });
    const rawText = await res.text();
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (parseErr) {
      if (rawText.includes('<!DOCTYPE') || res.status === 502 || res.status === 503) {
        showOutput('⏳ Server is ready now (was applying updates). Please click Run again!', false);
      } else {
        showOutput('Server error: ' + rawText.slice(0, 150), true);
      }
      return;
    }

    displayResults(result);

    if (socket) {
      socket.emit('run-sync', result);
    }
  } catch (e) {
    showOutput('Network error: ' + e.message, true);
  } finally {
    btn.innerHTML = '<span class="run-icon">▶</span> Run';
    btn.classList.remove('running');
  }
}

// ── Display Results (Clean Unified Terminal Output) ──
function displayResults(result) {
  const el = document.getElementById('outputContent');
  el.innerHTML = '';

  if (!result.results || result.results.length === 0) {
    el.innerHTML = '<span class="placeholder">No executable code detected.</span>';
    return;
  }

  let hasOutput = false;
  for (const r of result.results) {
    if (r.error) {
      const errEl = document.createElement('div');
      errEl.className = 'error-text';
      errEl.textContent = r.error;
      el.appendChild(errEl);
      hasOutput = true;
    } else if (r.output) {
      const outEl = document.createElement('div');
      outEl.className = 'success-text';
      outEl.textContent = r.output;
      el.appendChild(outEl);
      hasOutput = true;
    }
  }

  if (!hasOutput) {
    el.innerHTML = '<span class="placeholder">(Program finished with no output)</span>';
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
document.getElementById('clearBtn')?.addEventListener('click', () => {
  document.getElementById('outputContent').innerHTML =
    '<span class="placeholder">Press ▶ Run or Ctrl+Enter to execute…</span>';
});

// ── Run Button ──
document.getElementById('runBtn')?.addEventListener('click', () => runCode());

// ── Share Button (Copy Link) ──
document.getElementById('shareBtn')?.addEventListener('click', async () => {
  const shareBtn = document.getElementById('shareBtn');
  const shareText = document.getElementById('shareText');
  const shareUrl = window.location.href;

  try {
    await navigator.clipboard.writeText(shareUrl);
    shareBtn.classList.add('copied');
    shareText.textContent = 'Link Copied! ✓';
    setTimeout(() => {
      shareBtn.classList.remove('copied');
      shareText.textContent = 'Share';
    }, 2000);
  } catch (err) {
    prompt('Copy this share link:', shareUrl);
  }
});

// ── Terminal Resizer ──
(function initResize() {
  const handle = document.getElementById('resizeHandle');
  const panel = document.getElementById('outputPanel');
  if (!handle || !panel) return;
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

// ── Sidebar Resizer ──
(function initSidebarResize() {
  const resizer = document.getElementById('sidebarResizer');
  const sidebar = document.getElementById('sidebar');
  if (!resizer || !sidebar) return;
  let startX, startW;

  resizer.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    function onMove(e) {
      const delta = e.clientX - startX;
      const newW = Math.min(Math.max(startW + delta, 140), 450);
      sidebar.style.width = newW + 'px';
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
