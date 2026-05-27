const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let llamaProcess = null;

// ── LLM SERVER CONFIG ──
const LLAMA_DIR = 'C:\\testLlama\\llama.cpp';
const LLAMA_EXE = path.join(LLAMA_DIR, 'build', 'bin', 'Release', 'llama-server.exe');
const MODEL_PATH = path.join(LLAMA_DIR, 'models', 'Meta-Llama-3-8B-Instruct-Q4_K_M.gguf');
const LLAMA_PORT = 8080;

function startLlamaServer() {
  // Check if the llama-server executable exists
  if (!fs.existsSync(LLAMA_EXE)) {
    console.log('[LLM] llama-server not found at:', LLAMA_EXE);
    console.log('[LLM] Skipping auto-start. Please start the server manually.');
    return;
  }

  if (!fs.existsSync(MODEL_PATH)) {
    console.log('[LLM] Model not found at:', MODEL_PATH);
    return;
  }

  console.log('[LLM] Starting llama-server...');
  
  llamaProcess = spawn(LLAMA_EXE, [
    '-m', MODEL_PATH,
    '-ngl', '0',
    '-t', '8',
    '-c', '4096',
    '--host', '127.0.0.1',
    '--port', String(LLAMA_PORT)
  ], {
    cwd: LLAMA_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true  // Hide the console window
  });

  llamaProcess.stdout.on('data', (data) => {
    console.log('[LLM]', data.toString().trim());
  });

  llamaProcess.stderr.on('data', (data) => {
    console.log('[LLM ERR]', data.toString().trim());
  });

  llamaProcess.on('error', (err) => {
    console.error('[LLM] Failed to start:', err.message);
    llamaProcess = null;
  });

  llamaProcess.on('exit', (code) => {
    console.log('[LLM] Server exited with code:', code);
    llamaProcess = null;
  });
}

function stopLlamaServer() {
  if (llamaProcess) {
    console.log('[LLM] Shutting down llama-server...');
    llamaProcess.kill('SIGTERM');
    // Force kill after 3 seconds if it doesn't stop
    setTimeout(() => {
      if (llamaProcess) {
        llamaProcess.kill('SIGKILL');
        llamaProcess = null;
      }
    }, 3000);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0A0A0A',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1A1A1A',
      symbolColor: '#ffffff',
      height: 40
    }
  });

  // In development, load from the Vite dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built static files
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Start the LLM server first, then create the window
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
