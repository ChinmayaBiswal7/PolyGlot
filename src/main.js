const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('Creating window...');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    show: true,
    center: true,
    backgroundColor: '#0d1117',
    title: 'PolyGlot IDE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const htmlPath = path.join(__dirname, 'renderer', 'index.html');
  console.log('Loading:', htmlPath);

  mainWindow.loadFile(htmlPath).then(() => {
    console.log('Page loaded successfully');
  }).catch(err => {
    console.error('Failed to load page:', err);
  });

  mainWindow.setMenuBarVisibility(false);

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools({ mode: 'bottom' });

  mainWindow.on('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    setTimeout(() => mainWindow.setAlwaysOnTop(false), 1000);
  });
}

// ── IPC: Run mixed-language code ──
ipcMain.handle('run-code', async (_event, code) => {
  const { executeCode } = require('./engine/executor');
  return await executeCode(code);
});

// ── IPC: Detect languages per line ──
ipcMain.handle('detect-languages', (_event, code) => {
  const { splitCode } = require('./engine/splitter');
  return splitCode(code).detectedLines;
});

// ── App lifecycle ──
app.whenReady().then(() => {
  console.log('App ready');
  createWindow();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
