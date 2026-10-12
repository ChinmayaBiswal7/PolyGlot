// ═══════════════════════════════════════════════════
//  PolyGlot IDE — Web Client with Live Collaboration
//  Monaco editor + language detection + File Explorer +
//  Live Web Preview + ML Visuals & Graphs + SQLite Studio
// ═══════════════════════════════════════════════════

let editor;
let decorations = [];
let isRemoteUpdate = false;
let socket = null;
let interactiveChartInstance = null;

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

  'datascience/ml_training.py': [
    'import matplotlib.pyplot as plt',
    '',
    '# Machine Learning Model Training Curve',
    'epochs = list(range(1, 9))',
    'train_loss = [0.88, 0.65, 0.48, 0.35, 0.25, 0.18, 0.14, 0.10]',
    'val_accuracy = [0.58, 0.72, 0.81, 0.87, 0.91, 0.93, 0.95, 0.96]',
    '',
    'plt.figure(figsize=(7, 4))',
    "plt.plot(epochs, train_loss, 'r-o', linewidth=2, label='Training Loss')",
    "plt.plot(epochs, val_accuracy, 'b-s', linewidth=2, label='Validation Accuracy')",
    "plt.title('Deep Learning Training Metrics 📊')",
    "plt.xlabel('Epoch')",
    "plt.ylabel('Score / Loss')",
    'plt.legend()',
    'plt.grid(True, linestyle=":", alpha=0.6)',
    '',
    'print("Training complete! Model converged at 96% accuracy.")',
  ].join('\n'),

  'web/index.html': [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>Live Web Server Preview</title>',
    '  <style>',
    '    body {',
    '      font-family: system-ui, sans-serif;',
    '      background: #0f172a;',
    '      color: #f8fafc;',
    '      display: flex;',
    '      align-items: center;',
    '      justify-content: center;',
    '      min-height: 100vh;',
    '      margin: 0;',
    '    }',
    '    .card {',
    '      background: #1e293b;',
    '      padding: 30px 40px;',
    '      border-radius: 12px;',
    '      box-shadow: 0 10px 25px rgba(0,0,0,0.5);',
    '      text-align: center;',
    '      border: 1px solid #334155;',
    '    }',
    '    h1 { color: #38bdf8; margin: 0 0 10px 0; }',
    '    p { color: #94a3b8; font-size: 14px; }',
    '    button {',
    '      background: #3b82f6;',
    '      color: white;',
    '      border: none;',
    '      padding: 10px 22px;',
    '      border-radius: 6px;',
    '      font-weight: 600;',
    '      cursor: pointer;',
    '      margin-top: 14px;',
    '      transition: background 0.15s ease;',
    '    }',
    '    button:hover { background: #2563eb; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="card">',
    '    <h1>🌐 Live Web Server</h1>',
    '    <p>Zero extensions required! Live HTML/CSS/JS preview inside PolyGlot IDE.</p>',
    '    <button id="btn">Click Me: <span id="count">0</span></button>',
    '  </div>',
    '  <script>',
    '    let n = 0;',
    '    document.getElementById("btn").onclick = () => {',
    '      n++;',
    '      document.getElementById("count").textContent = n;',
    '    };',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n'),

  'database/sales.sql': [
    '-- SQLite Database Studio Demo',
    'CREATE TABLE IF NOT EXISTS products (',
    '    id INTEGER PRIMARY KEY,',
    '    name TEXT NOT NULL,',
    '    category TEXT NOT NULL,',
    '    price REAL NOT NULL,',
    '    stock INTEGER NOT NULL',
    ');',
    '',
    'INSERT INTO products (name, category, price, stock) VALUES',
    "('MacBook Pro M3', 'Laptops', 1999.99, 15),",
    "('Sony WH-1000XM5', 'Audio', 399.99, 45),",
    "('Mechanical Keyboard', 'Accessories', 129.50, 80),",
    "('Dell UltraSharp 4K', 'Monitors', 649.00, 20),",
    "('Logitech MX Master 3S', 'Accessories', 99.00, 110);",
    '',
    '-- Query products sorted by price',
    "SELECT id, name, category, '$' || price AS price, stock FROM products ORDER BY price DESC;",
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
};

let activeFileName = 'main.poly';
const openTabs = ['main.poly', 'datascience/ml_training.py', 'web/index.html', 'database/sales.sql'];

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
    language: getMonacoLang(activeFileName),
    theme: 'polyglot-dark',
    fontSize: 14,
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'all',
    automaticLayout: true,
    tabSize: 4,
    insertSpaces: true,
    padding: { top: 12, bottom: 12 },
  });

  // Debounced line detection & local state saving
  let detectTimer = null;
  editor.onDidChangeModelContent(() => {
    if (detectTimer) clearTimeout(detectTimer);

    // Save content to current virtual file
    const val = editor.getValue();
    projectFiles[activeFileName] = val;

    // If currently on Web Preview tab, auto-refresh preview
    if (tabWebPreviewBtn?.classList.contains('active') || activeFileName.endsWith('.html')) {
      renderWebPreview();
    }

    // Broadcast to peers if not from remote update
    if (!isRemoteUpdate && socket) {
      socket.emit('code-change', {
        room: currentRoom,
        code: val,
        fileName: activeFileName,
      });
    }

    detectTimer = setTimeout(() => {
      updateLanguageBadges();
    }, 250);
  });

  // Ctrl+Enter → Run Code
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    runCode();
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

function getMonacoLang(fileName) {
  if (fileName.endsWith('.py')) return 'python';
  if (fileName.endsWith('.html')) return 'html';
  if (fileName.endsWith('.sql')) return 'sql';
  if (fileName.endsWith('.js')) return 'javascript';
  if (fileName.endsWith('.ts')) return 'typescript';
  if (fileName.endsWith('.c')) return 'c';
  if (fileName.endsWith('.cpp')) return 'cpp';
  if (fileName.endsWith('.java')) return 'java';
  if (fileName.endsWith('.rs')) return 'rust';
  if (fileName.endsWith('.go')) return 'go';
  return 'plaintext';
}

// ── Sidebar Activity Switcher (Files / Extensions / Database) ──
const actFilesBtn = document.getElementById('actFilesBtn');
const actExtensionsBtn = document.getElementById('actExtensionsBtn');
const actDbBtn = document.getElementById('actDbBtn');

const filesSection = document.getElementById('filesSection');
const extensionsSection = document.getElementById('extensionsSection');
const dbSidebarSection = document.getElementById('dbSidebarSection');

function switchSidebarTab(tab) {
  actFilesBtn?.classList.toggle('active', tab === 'files');
  actExtensionsBtn?.classList.toggle('active', tab === 'extensions');
  actDbBtn?.classList.toggle('active', tab === 'database');

  if (filesSection) filesSection.style.display = tab === 'files' ? 'flex' : 'none';
  if (extensionsSection) extensionsSection.style.display = tab === 'extensions' ? 'flex' : 'none';
  if (dbSidebarSection) dbSidebarSection.style.display = tab === 'database' ? 'flex' : 'none';
}

actFilesBtn?.addEventListener('click', () => switchSidebarTab('files'));
actExtensionsBtn?.addEventListener('click', () => switchSidebarTab('extensions'));
actDbBtn?.addEventListener('click', () => switchSidebarTab('database'));

// ── File Explorer & Tabs Management ──
function renderFileTree() {
  const container = document.getElementById('fileTree');
  if (!container) return;
  container.innerHTML = '';

  const paths = Object.keys(projectFiles).sort();

  for (const filePath of paths) {
    const item = document.createElement('div');
    item.className = 'tree-item' + (filePath === activeFileName ? ' active' : '');

    let icon = '📄';
    if (filePath.endsWith('.poly')) icon = '◈';
    else if (filePath.endsWith('.rs')) icon = '🦀';
    else if (filePath.endsWith('.py')) icon = '🐍';
    else if (filePath.endsWith('.html')) icon = '🌐';
    else if (filePath.endsWith('.sql')) icon = '🗄️';
    else if (filePath.endsWith('.c') || filePath.endsWith('.cpp')) icon = '⚡';
    else if (filePath.endsWith('.java')) icon = '☕';

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
      <span class="tab-title">${escapeHtml(baseName)}</span>
      <span class="tab-close" title="Close Tab">×</span>
    `;

    tab.querySelector('.tab-title').addEventListener('click', () => switchFile(filePath));
    tab.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(filePath);
    });

    container.appendChild(tab);
  }
}

function switchFile(filePath) {
  if (!projectFiles[filePath]) return;

  activeFileName = filePath;
  if (!openTabs.includes(filePath)) {
    openTabs.push(filePath);
  }

  if (editor) {
    isRemoteUpdate = true;
    editor.setValue(projectFiles[filePath]);
    monaco.editor.setModelLanguage(editor.getModel(), getMonacoLang(filePath));
    isRemoteUpdate = false;
  }

  renderFileTree();
  renderTabs();
  updateLanguageBadges();

  // If opening HTML file, auto-preview in Web Preview tab
  if (filePath.endsWith('.html')) {
    renderWebPreview();
  }
}

function closeTab(filePath) {
  const idx = openTabs.indexOf(filePath);
  if (idx !== -1) {
    openTabs.splice(idx, 1);
  }

  if (activeFileName === filePath && openTabs.length > 0) {
    switchFile(openTabs[openTabs.length - 1]);
  } else if (openTabs.length === 0) {
    openTabs.push('main.poly');
    switchFile('main.poly');
  } else {
    renderTabs();
  }
}

document.getElementById('newFileBtn')?.addEventListener('click', () => {
  const name = prompt('Enter new file name (e.g. script.py, main.cpp, index.html):');
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
      if (data.fileName === activeFileName && editor) {
        isRemoteUpdate = true;
        editor.setValue(data.code);
        isRemoteUpdate = false;
        updateLanguageBadges();
      }
    }
  });

  socket.on('user-count', (count) => {
    const el = document.getElementById('userCount');
    if (el) el.textContent = `${count} live`;
  });

  socket.on('run-sync', (result) => {
    displayResults(result);
  });
}

// ── Language Badges & Line Gutter Indicators ──
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

// ── Bottom Panel Tabs Switcher (Output / Stdin / Web Preview / Visuals / Database) ──
const tabOutputBtn = document.getElementById('tabOutputBtn');
const tabInputBtn = document.getElementById('tabInputBtn');
const tabWebPreviewBtn = document.getElementById('tabWebPreviewBtn');
const tabVisualsBtn = document.getElementById('tabVisualsBtn');
const tabDbBtn = document.getElementById('tabDbBtn');

const outputContent = document.getElementById('outputContent');
const stdinContainer = document.getElementById('stdinContainer');
const webPreviewContainer = document.getElementById('webPreviewContainer');
const visualsContainer = document.getElementById('visualsContainer');
const dbResultsContainer = document.getElementById('dbResultsContainer');

const stdinInput = document.getElementById('stdinInput');
const stdinDot = document.getElementById('stdinDot');
const visualDot = document.getElementById('visualDot');

function hideAllPanels() {
  [tabOutputBtn, tabInputBtn, tabWebPreviewBtn, tabVisualsBtn, tabDbBtn].forEach(b => b?.classList.remove('active'));
  if (outputContent) outputContent.style.display = 'none';
  if (stdinContainer) stdinContainer.style.display = 'none';
  if (webPreviewContainer) webPreviewContainer.style.display = 'none';
  if (visualsContainer) visualsContainer.style.display = 'none';
  if (dbResultsContainer) dbResultsContainer.style.display = 'none';
}

function switchToOutput() {
  hideAllPanels();
  tabOutputBtn?.classList.add('active');
  if (outputContent) outputContent.style.display = 'block';
}

function switchToInput() {
  hideAllPanels();
  tabInputBtn?.classList.add('active');
  if (stdinContainer) {
    stdinContainer.style.display = 'flex';
    stdinInput?.focus();
  }
}

function switchToWebPreview() {
  hideAllPanels();
  tabWebPreviewBtn?.classList.add('active');
  if (webPreviewContainer) {
    webPreviewContainer.style.display = 'flex';
    renderWebPreview();
  }
}

function switchToVisuals() {
  hideAllPanels();
  tabVisualsBtn?.classList.add('active');
  if (visualDot) visualDot.style.display = 'none';
  if (visualsContainer) visualsContainer.style.display = 'flex';
}

function switchToDb() {
  hideAllPanels();
  tabDbBtn?.classList.add('active');
  if (dbResultsContainer) dbResultsContainer.style.display = 'block';
}

tabOutputBtn?.addEventListener('click', switchToOutput);
tabInputBtn?.addEventListener('click', switchToInput);
tabWebPreviewBtn?.addEventListener('click', switchToWebPreview);
tabVisualsBtn?.addEventListener('click', switchToVisuals);
tabDbBtn?.addEventListener('click', switchToDb);

stdinInput?.addEventListener('input', () => {
  if (stdinDot) {
    stdinDot.style.display = stdinInput.value.trim() ? 'inline' : 'none';
  }
});

// ── Live Web Preview Renderer (Built-in Live Server) ──
function renderWebPreview() {
  const iframe = document.getElementById('previewIframe');
  const urlBar = document.getElementById('browserUrl');
  if (!iframe) return;

  let htmlContent = '';
  let url = 'http://localhost/' + activeFileName;

  if (activeFileName.endsWith('.html')) {
    htmlContent = editor ? editor.getValue() : projectFiles[activeFileName];
  } else if (projectFiles['web/index.html']) {
    htmlContent = projectFiles['web/index.html'];
    url = 'http://localhost/web/index.html';
  } else {
    htmlContent = `
      <body style="font-family: sans-serif; padding: 30px; background: #0f172a; color: #f8fafc; text-align: center;">
        <h2 style="color: #38bdf8;">🌐 No HTML File Active</h2>
        <p>Open <code>web/index.html</code> or create an <code>.html</code> file to see live preview.</p>
      </body>
    `;
  }

  if (urlBar) urlBar.textContent = url;
  iframe.srcdoc = htmlContent;
}

document.getElementById('reloadPreviewBtn')?.addEventListener('click', renderWebPreview);
document.getElementById('openTabPreviewBtn')?.addEventListener('click', () => {
  const iframe = document.getElementById('previewIframe');
  if (iframe && iframe.srcdoc) {
    const w = window.open();
    w.document.open();
    w.document.write(iframe.srcdoc);
    w.document.close();
  }
});

// ── Visuals & ML Graphs Rendering ──
function renderPlot(base64Data) {
  const imgWrapper = document.getElementById('plotImageWrapper');
  const img = document.getElementById('plotImage');
  const placeholder = document.getElementById('visualsPlaceholder');
  const downloadBtn = document.getElementById('downloadPlotBtn');

  if (img && imgWrapper) {
    img.src = 'data:image/png;base64,' + base64Data;
    imgWrapper.style.display = 'flex';
    if (placeholder) placeholder.style.display = 'none';
    if (downloadBtn) {
      downloadBtn.style.display = 'inline-block';
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'polyglot_plot.png';
        a.click();
      };
    }
  }

  if (visualDot) visualDot.style.display = 'inline';
}

function renderChart(chartData) {
  const canvasWrapper = document.getElementById('chartCanvasWrapper');
  const canvas = document.getElementById('interactiveChart');
  const placeholder = document.getElementById('visualsPlaceholder');

  if (!canvas || typeof Chart === 'undefined') return;

  if (interactiveChartInstance) {
    interactiveChartInstance.destroy();
  }

  canvasWrapper.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';

  interactiveChartInstance = new Chart(canvas.getContext('2d'), {
    type: chartData.type || 'line',
    data: {
      labels: chartData.labels || [],
      datasets: chartData.datasets || [],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e6edf3' } }
      },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } }
      }
    }
  });

  if (visualDot) visualDot.style.display = 'inline';
}

// ── SQLite Database Studio Runner ──
async function executeSql(sql) {
  const container = document.getElementById('dbOutputTable');
  if (container) {
    container.innerHTML = '<div style="color:#58a6ff; padding:12px;">⏳ Executing SQL query…</div>';
  }

  try {
    const res = await fetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();

    if (!data.success) {
      if (container) {
        container.innerHTML = `<div class="error-text" style="padding:10px;">SQL Error: ${escapeHtml(data.error)}</div>`;
      }
      return;
    }

    // Render tables in sidebar list
    const tablesListEl = document.getElementById('dbTablesContainer');
    if (tablesListEl && data.tables) {
      tablesListEl.innerHTML = '';
      if (data.tables.length === 0) {
        tablesListEl.innerHTML = '<span class="db-empty-hint">No tables found.</span>';
      } else {
        for (const t of data.tables) {
          const pill = document.createElement('div');
          pill.className = 'db-table-pill';
          pill.textContent = '📄 ' + t;
          pill.onclick = () => {
            const sqlInp = document.getElementById('dbSqlInput');
            if (sqlInp) {
              sqlInp.value = `SELECT * FROM ${t} LIMIT 50;`;
              executeSql(sqlInp.value);
            }
          };
          tablesListEl.appendChild(pill);
        }
      }
    }

    // Render tables in bottom panel
    if (!container) return;
    container.innerHTML = '';

    if (!data.results || data.results.length === 0) {
      container.innerHTML = '<div class="success-text" style="padding:10px;">Query completed successfully.</div>';
      return;
    }

    for (const r of data.results) {
      if (r.type === 'status') {
        const badge = document.createElement('div');
        badge.className = 'db-summary-badge';
        badge.textContent = r.message;
        container.appendChild(badge);
      } else if (r.type === 'table') {
        const badge = document.createElement('div');
        badge.className = 'db-summary-badge';
        badge.textContent = `${r.count} rows returned`;
        container.appendChild(badge);

        const table = document.createElement('table');
        table.className = 'db-data-table';

        // Headers
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        for (const col of r.columns) {
          const th = document.createElement('th');
          th.textContent = col;
          trHead.appendChild(th);
        }
        thead.appendChild(trHead);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        for (const row of r.rows) {
          const tr = document.createElement('tr');
          for (const cell of row) {
            const td = document.createElement('td');
            td.textContent = cell !== null ? cell : 'NULL';
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(table);
      }
    }

    switchToDb();
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="error-text" style="padding:10px;">Network error: ${escapeHtml(err.message)}</div>`;
    }
  }
}

document.getElementById('dbExecBtn')?.addEventListener('click', () => {
  const sql = document.getElementById('dbSqlInput')?.value || '';
  if (sql.trim()) executeSql(sql.trim());
});

document.getElementById('dbRunSideBtn')?.addEventListener('click', () => {
  const sql = document.getElementById('dbSqlInput')?.value || '';
  if (sql.trim()) executeSql(sql.trim());
});

// ── Run Code (Local + Sync across peers) ──
async function runCode() {
  const btn = document.getElementById('runBtn');
  btn.innerHTML = '<span class="run-icon">⏳</span> Running…';
  btn.classList.add('running');

  // If running SQL file, route directly to SQLite Studio
  if (activeFileName.endsWith('.sql')) {
    const sqlCode = editor.getValue();
    const sqlInp = document.getElementById('dbSqlInput');
    if (sqlInp) sqlInp.value = sqlCode;
    await executeSql(sqlCode);
    btn.innerHTML = '<span class="run-icon">▶</span> Run';
    btn.classList.remove('running');
    return;
  }

  // If running HTML file, route directly to Live Web Preview
  if (activeFileName.endsWith('.html')) {
    switchToWebPreview();
    btn.innerHTML = '<span class="run-icon">▶</span> Run';
    btn.classList.remove('running');
    return;
  }

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

    // If an ML plot or Chart was generated, render it and notify user
    if (result.plot) {
      renderPlot(result.plot);
      switchToVisuals();
    } else if (result.chart) {
      renderChart(result.chart);
      switchToVisuals();
    }

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

// ── Share Link Generator ──
const shareBtn = document.getElementById('shareBtn');
const shareText = document.getElementById('shareText');

shareBtn?.addEventListener('click', async () => {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    if (shareText) shareText.textContent = 'Copied!';
    setTimeout(() => {
      if (shareText) shareText.textContent = 'Share';
    }, 2000);
  } catch (err) {
    prompt('Copy this collaboration link:', url);
  }
});

// ── Clear Terminal ──
document.getElementById('clearBtn')?.addEventListener('click', () => {
  const el = document.getElementById('outputContent');
  if (el) el.innerHTML = '<span class="placeholder">Terminal cleared.</span>';
});

// ── Splitter Resizer (Sidebar) ──
const sidebar = document.getElementById('sidebar');
const sidebarResizer = document.getElementById('sidebarResizer');
let isResizingSidebar = false;

sidebarResizer?.addEventListener('mousedown', () => {
  isResizingSidebar = true;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
});

// ── Bottom Panel Resizer (Terminal) ──
const resizeHandle = document.getElementById('resizeHandle');
const outputPanel = document.getElementById('outputPanel');
let isResizingTerminal = false;

resizeHandle?.addEventListener('mousedown', () => {
  isResizingTerminal = true;
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
});

window.addEventListener('mousemove', (e) => {
  if (isResizingSidebar && sidebar) {
    const newWidth = Math.max(140, Math.min(e.clientX, 450));
    sidebar.style.width = newWidth + 'px';
  }
  if (isResizingTerminal && outputPanel) {
    const containerRect = document.querySelector('.container').getBoundingClientRect();
    const newHeight = Math.max(80, Math.min(containerRect.bottom - e.clientY, containerRect.height - 120));
    outputPanel.style.height = newHeight + 'px';
  }
});

window.addEventListener('mouseup', () => {
  if (isResizingSidebar) {
    isResizingSidebar = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  if (isResizingTerminal) {
    isResizingTerminal = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});
