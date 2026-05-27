const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let llamaProcess = null;
let serverStatus = 'stopped'; // 'running' | 'stopped' | 'error' | 'not_found'
let lastError = '';

// ── LLM SERVER CONFIG ──
const CONFIG_FILE = path.join(app.getPath('userData'), 'llama_config.json');

let llamaConfig = {
  llamaDir: 'C:\\testLlama\\llama.cpp',
  llamaExe: 'C:\\testLlama\\llama.cpp\\build\\bin\\Release\\llama-server.exe',
  modelPath: 'C:\\testLlama\\llama.cpp\\models\\Meta-Llama-3-8B-Instruct-Q4_K_M.gguf',
  gpuLayers: 0,
  port: 8080
};

// Load dynamic llama configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      llamaConfig = { ...llamaConfig, ...JSON.parse(data) };
      console.log('[Config] Loaded config:', llamaConfig);
    } else {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(llamaConfig, null, 2), 'utf8');
      console.log('[Config] Saved default config.');
    }
  } catch (err) {
    console.error('[Config] Failed to load config:', err);
  }
}

function startLlamaServer() {
  stopLlamaServer();
  loadConfig();

  const { llamaExe, modelPath, llamaDir, port, gpuLayers } = llamaConfig;

  // Validate llama-server executable path
  if (!fs.existsSync(llamaExe)) {
    console.log('[LLM] llama-server not found at:', llamaExe);
    serverStatus = 'not_found';
    lastError = `llama-server.exe not found at:\n${llamaExe}`;
    if (mainWindow) mainWindow.webContents.send('llama-status-change', { status: serverStatus, error: lastError });
    return;
  }

  // Validate model weight file path
  if (!fs.existsSync(modelPath)) {
    console.log('[LLM] Model not found at:', modelPath);
    serverStatus = 'not_found';
    lastError = `GGUF Model weights file not found at:\n${modelPath}`;
    if (mainWindow) mainWindow.webContents.send('llama-status-change', { status: serverStatus, error: lastError });
    return;
  }

  console.log('[LLM] Starting llama-server...');
  serverStatus = 'starting';
  lastError = '';

  const args = [
    '-m', modelPath,
    '-ngl', String(gpuLayers ?? 0),
    '-t', '8',
    '-c', '4096',
    '--host', '127.0.0.1',
    '--port', String(port ?? 8080)
  ];

  try {
    llamaProcess = spawn(llamaExe, args, {
      cwd: llamaDir || path.dirname(llamaExe),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true  // Hide console popup on windows
    });

    serverStatus = 'running';

    llamaProcess.stdout.on('data', (data) => {
      console.log('[LLM]', data.toString().trim());
    });

    llamaProcess.stderr.on('data', (data) => {
      const text = data.toString().trim();
      console.log('[LLM ERR]', text);
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
        lastError = text.substring(0, 200);
      }
    });

    llamaProcess.on('error', (err) => {
      console.error('[LLM] Failed to start:', err.message);
      serverStatus = 'error';
      lastError = err.message;
      llamaProcess = null;
      if (mainWindow) mainWindow.webContents.send('llama-status-change', { status: serverStatus, error: lastError });
    });

    llamaProcess.on('exit', (code) => {
      console.log('[LLM] Server exited with code:', code);
      serverStatus = 'stopped';
      if (code !== 0 && code !== null) {
        serverStatus = 'error';
        lastError = `Llama-server exited with code ${code}`;
      }
      llamaProcess = null;
      if (mainWindow) mainWindow.webContents.send('llama-status-change', { status: serverStatus, error: lastError });
    });

  } catch (err) {
    serverStatus = 'error';
    lastError = err.message;
    console.error('[LLM] Spawn exception:', err);
  }

  if (mainWindow) mainWindow.webContents.send('llama-status-change', { status: serverStatus, error: lastError });
}

function stopLlamaServer() {
  if (llamaProcess) {
    console.log('[LLM] Shutting down llama-server...');
    try {
      llamaProcess.kill('SIGTERM');
    } catch (e) {}
    
    // Force kill if necessary after delay
    const tempProcess = llamaProcess;
    setTimeout(() => {
      try {
        if (tempProcess) tempProcess.kill('SIGKILL');
      } catch (e) {}
    }, 2000);
    llamaProcess = null;
    serverStatus = 'stopped';
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#090b0a',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#121513',
      symbolColor: '#ffffff',
      height: 40
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ── IPC REGISTER HANDLERS ──
ipcMain.on('get-llama-config', (event) => {
  loadConfig();
  event.returnValue = llamaConfig;
});

ipcMain.on('save-llama-config', (event, newConfig) => {
  try {
    llamaConfig = { ...llamaConfig, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(llamaConfig, null, 2), 'utf8');
    console.log('[Config] Saved new config, restarting LLM...');
    startLlamaServer();
    event.returnValue = { success: true };
  } catch (err) {
    event.returnValue = { success: false, error: err.message };
  }
});

ipcMain.on('get-llama-status', (event) => {
  event.returnValue = { status: serverStatus, error: lastError };
});

ipcMain.on('restart-llama', (event) => {
  startLlamaServer();
  event.returnValue = { success: true };
});

ipcMain.on('select-file', (event, filters) => {
  const paths = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openFile'],
    filters: filters || []
  });
  event.returnValue = paths && paths.length > 0 ? paths[0] : null;
});

ipcMain.on('select-directory', (event) => {
  const paths = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openDirectory']
  });
  event.returnValue = paths && paths.length > 0 ? paths[0] : null;
});

// App lifecycle
app.whenReady().then(() => {
  loadConfig();
  startLlamaServer();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    stopLlamaServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopLlamaServer();
});
