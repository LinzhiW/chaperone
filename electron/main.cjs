// Desktop shell. Owns two things the browser build cannot do for itself:
//
//   1. Runs the backend as a child process on an OS-assigned port, and tells the
//      renderer where it landed. Hardcoding 3005 is not safe on someone else's
//      machine.
//   2. Provides a real folder picker. A web page can never learn a true
//      filesystem path, which is why the browser build has to ask people to type
//      one; here the OS dialog hands us the actual path.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

// Credentials live beside the app's other per-user data, not next to the binary —
// the install directory is read-only for non-admins on Windows and macOS.
const DATA_DIR = app.getPath('userData');

let serverProcess = null;
let apiBase = null;
let mainWindow = null;

/** Absolute path to the compiled backend entry point. */
function serverEntry() {
  return isDev
    ? path.join(__dirname, '..', 'server', 'dist', 'index.js')
    : path.join(process.resourcesPath, 'server', 'dist', 'index.js');
}

/**
 * Start the backend and resolve once it reports the port it bound to.
 * Rejects if it dies or never reports within the timeout, so a broken backend
 * surfaces as a visible error rather than an app stuck on a blank screen.
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const entry = serverEntry();
    if (!fs.existsSync(entry)) {
      reject(new Error(`Backend not built — missing ${entry}\nRun: npm run build:server`));
      return;
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });

    serverProcess = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        PORT: '0',                       // let the OS choose
        CHAPERONE_DATA_DIR: DATA_DIR,
        NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY || '1',
        ELECTRON_RUN_AS_NODE: '1',       // run the bundled Electron binary as plain Node
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    const done = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      err ? reject(err) : resolve(value);
    };

    const timer = setTimeout(
      () => done(new Error('Backend did not report a port within 30s')),
      30000,
    );

    serverProcess.stdout.on('data', chunk => {
      const text = chunk.toString();
      process.stdout.write(`[server] ${text}`);
      const match = text.match(/CHAPERONE_PORT=(\d+)/);
      if (match) done(null, `http://127.0.0.1:${match[1]}`);
    });

    serverProcess.stderr.on('data', chunk => process.stderr.write(`[server] ${chunk}`));
    serverProcess.on('error', err => done(err));
    serverProcess.on('exit', code => {
      serverProcess = null;
      done(new Error(`Backend exited with code ${code} before reporting a port`));
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f4f1ea',
    title: 'Chaperone',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--chaperone-api-base=${apiBase}`],
    },
  });

  // Links to the outside world open in the real browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.CHAPERONE_DEV_SERVER) {
    mainWindow.loadURL(process.env.CHAPERONE_DEV_SERVER);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Native directory picker — the whole reason paths stop being hand-typed here.
ipcMain.handle('chaperone:pick-folder', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Choose a project folder',
    properties: ['openDirectory', 'createDirectory'],
    ...(options.defaultPath ? { defaultPath: options.defaultPath } : {}),
  });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});

app.whenReady().then(async () => {
  try {
    apiBase = await startServer();
  } catch (err) {
    dialog.showErrorBox('Chaperone could not start', String(err && err.message ? err.message : err));
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Don't leave the backend running after the UI is gone.
const stopServer = () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
};
app.on('window-all-closed', () => { stopServer(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', stopServer);
process.on('exit', stopServer);
