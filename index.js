// index.js
const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store').default;

// ————— Carga los JSON de mapeo —————
const mappingPrev = require('./mapping_previous.json');
const mappingNewPista = require('./mapping_new_pista.json');
const mappingNewCantado = require('./mapping_new_cantado.json');
// ————————————————————————————————

const store = new Store();
app.disableHardwareAcceleration();

// Fijar AppUserModelId en Windows para mantener el anclaje en la barra de tareas tras actualizar
if (process.platform === 'win32') {
  app.setAppUserModelId('com.damm.findhymn');
}

// ————— Single Instance Lock —————
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[main] Ya hay otra instancia de Find Hymn ejecutándose. Cerrando instancia duplicada.');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Si intentan abrir una segunda instancia, enfoca y restaura la ventana principal existente
    if (mainWin && !mainWin.isDestroyed()) {
      if (mainWin.isMinimized()) mainWin.restore();
      if (!mainWin.isVisible()) mainWin.show();
      mainWin.focus();
    }
  });
}

// Start Local Server
const { fork } = require('child_process');
let serverProcess = null;
const serverPath = path.join(__dirname, 'server', 'server.js');

function stopServer() {
  if (serverProcess) {
    try {
      serverProcess.removeAllListeners();
      serverProcess.kill();
    } catch (e) {
      console.error('Error stopping server process:', e);
    }
    serverProcess = null;
  }
}

function startServer(port = 3000) {
  if (!gotTheLock) return; // Do not start server if we don't have the lock
  stopServer();
  if (fs.existsSync(serverPath)) {
    // Pass port and auth config
    const authEnabled = store.get('authEnabled', false);
    const authKeyword = store.get('authKeyword', '');

    const child = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: port,
        AUTH_ENABLED: authEnabled,
        AUTH_KEYWORD: authKeyword
      }
    });
    serverProcess = child;
    child.on('exit', () => {
      if (serverProcess === child) {
        serverProcess = null;
      }
    });
    console.log(`Mobile server started on port ${port} with PID:`, serverProcess.pid);
  } else {
    console.error('Server script not found at:', serverPath);
  }
}

// Auto-start default
if (gotTheLock) {
  const savedPort = store.get('serverPort', 3000); // Default 3000
  startServer(savedPort);
}


let mainWin = null;
let videoWin = null;

const AUTO_LAUNCH_KEY = 'startWithWindows';
const TRAY_CONFIG_KEY = 'trayConfig'; // { mode: 'disabled'|'show'|'hide' }

let tray = null;
let isQuitting = false;
let themeListenerRegistered = false;

function getThemeTrayIcon() {
  const { nativeTheme } = require('electron');
  const iconWhite = path.join(__dirname, 'public/icons/icon-white.ico');
  const iconBlack = path.join(__dirname, 'public/icons/icon-Black.ico');
  const defaultIcon = path.join(__dirname, 'public/icons/icon.ico');

  const candidate = nativeTheme.shouldUseDarkColors ? iconWhite : iconBlack;
  if (fs.existsSync(candidate)) return candidate;
  return defaultIcon;
}

function updateTray() {
  const trayConfig = store.get(TRAY_CONFIG_KEY, { mode: 'disabled' });
  const mode = trayConfig.mode;

  if (mode === 'disabled') {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }

  if (!tray) {
    const { nativeTheme } = require('electron');

    // Initial creation
    tray = new Tray(getThemeTrayIcon());

    // Listener for theme changes (register once)
    if (!themeListenerRegistered) {
      themeListenerRegistered = true;
      nativeTheme.on('updated', () => {
        if (tray) tray.setImage(getThemeTrayIcon());
      });
    }

    tray.on('click', () => {
      if (mainWin && !mainWin.isDestroyed()) {
        if (mainWin.isVisible()) {
          if (mainWin.isMinimized()) {
            mainWin.restore();
            mainWin.focus();
          } else {
            mainWin.hide();
          }
        } else {
          mainWin.show();
          mainWin.focus();
        }
      }
    });
  }

  tray.setToolTip('Find Hymn V2.0');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mostrar App', click: () => mainWin && !mainWin.isDestroyed() && mainWin.show() },
    {
      label: 'Reiniciar Servidor', click: () => {
        const port = store.get('serverPort', 3000);
        startServer(port);
      }
    },
    { type: 'separator' },
    {
      label: 'Salir', click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function isBoundsVisibleOnAnyDisplay(bounds) {
  if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return false;
  const displays = screen.getAllDisplays();
  const centerX = bounds.x + (bounds.width || 800) / 2;
  const centerY = bounds.y + (bounds.height || 600) / 2;
  return displays.some(d => {
    const b = d.bounds;
    return centerX >= b.x && centerX <= b.x + b.width &&
           centerY >= b.y && centerY <= b.y + b.height;
  });
}

function createWindow() {
  const state = store.get('mainWindowState', {});
  const trayConfig = store.get(TRAY_CONFIG_KEY, { mode: 'disabled' });

  // Decide if show or hide on start
  const startHidden = trayConfig.mode === 'hide';
  const validPosition = isBoundsVisibleOnAnyDisplay(state);

  mainWin = new BrowserWindow({
    x: validPosition ? state.x : undefined,
    y: validPosition ? state.y : undefined,
    width: state.width || 1280,
    height: state.height || 800,
    icon: path.join(__dirname, 'public/icons/icon.ico'),
    show: false, // Wait for ready-to-show to prevent progressive rendering / blank flash
    backgroundColor: '#f3f4f6',
    autoHideMenuBar: true,
    menuBarVisible: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff00',
      symbolColor: '#000000',
      height: 35
    },
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWin.once('ready-to-show', () => {
    if (!startHidden) {
      if (state.isMaximized) mainWin.maximize();
      mainWin.show();
      mainWin.focus();
    }
  });

  // Fallback in case ready-to-show is delayed
  setTimeout(() => {
    if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible() && !startHidden) {
      if (state.isMaximized) mainWin.maximize();
      mainWin.show();
    }
  }, 1000);

  mainWin.loadFile('index.html');

  // Initialize Tray based on config
  updateTray();

  // Check for updates on startup
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Close vs Minimize (Tray Logic)
  mainWin.on('close', (event) => {
    const mode = store.get(TRAY_CONFIG_KEY, { mode: 'disabled' }).mode;
    if (mode !== 'disabled' && !isQuitting) {
      event.preventDefault();
      mainWin.hide();
      return false;
    }

    // Normal closing
    if (mainWin && !mainWin.isDestroyed()) {
      const isMax = mainWin.isMaximized();
      const bounds = isMax ? mainWin.getNormalBounds() : mainWin.getBounds();
      store.set('mainWindowState', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: isMax
      });
    }
    // Cleanup videoWin
    if (videoWin && !videoWin.isDestroyed()) {
      try { videoWin.close(); } catch (e) { }
      videoWin = null;
    }
  });

  mainWin.on('closed', () => mainWin = null);
}

app.whenReady().then(() => {
  if (!gotTheLock) return;
  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('activate', () => {
  if (!mainWin) createWindow();
});

// ————— Auto-Updater —————
autoUpdater.on('before-quit-for-update', () => {
  isQuitting = true;
  stopServer();
});

autoUpdater.on('checking-for-update', () => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('checking-for-update');
});

autoUpdater.on('update-available', () => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('update-available');
});

autoUpdater.on('update-not-available', () => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('update-error', err.message);
});

autoUpdater.on('update-downloaded', () => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('update-downloaded');
});

ipcMain.on('check-for-updates', () => {
  if (!app.isPackaged) {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('update-not-available');
    }
    return;
  }
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.on('restart-app', () => {
  isQuitting = true;
  stopServer();
  if (videoWin && !videoWin.isDestroyed()) {
    try { videoWin.close(); } catch (e) { }
    videoWin = null;
  }
  autoUpdater.quitAndInstall(false, true);
});

function getBasePath() {
  const configuredPath = store.get('videoPath');
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, '..');
  } else {
    return __dirname;
  }
}

// ————— Generic Store Handlers —————
ipcMain.handle('get-store-value', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store-value', (event, key, value) => {
  store.set(key, value);
});

// Video Window Controls Handler
ipcMain.on('video-window-control', (event, action) => {
  if (!videoWin || videoWin.isDestroyed()) return;
  switch (action) {
    case 'minimize': videoWin.minimize(); break;
    case 'maximize':
      if (videoWin.isMaximized()) videoWin.unmaximize();
      else videoWin.maximize();
      break;
    case 'close': videoWin.close(); break;
  }
});

// ————— IPC Handlers —————
ipcMain.handle('select-video-folder', async () => {
  const result = await dialog.showOpenDialog(mainWin, { properties: ['openDirectory'] });
  return (result.canceled || !result.filePaths.length) ? null : result.filePaths[0];
});

ipcMain.handle('set-video-folder', (event, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) {
    store.set('videoPath', folderPath);
    return true;
  }
  return false;
});

// ————— Tray & System Config IPCs —————
ipcMain.handle('get-tray-config', () => {
  const config = store.get(TRAY_CONFIG_KEY, { mode: 'disabled' });
  const startWithWindows = app.getLoginItemSettings().openAtLogin;
  return { mode: config.mode, startWithWindows };
});

ipcMain.handle('set-tray-config', (event, { mode }) => {
  store.set(TRAY_CONFIG_KEY, { mode });
  updateTray(); // Refresh functionality
});

ipcMain.handle('toggle-start-with-windows', (event, shouldStart) => {
  app.setLoginItemSettings({
    openAtLogin: shouldStart,
    openAsHidden: false // We control hidden state via app logic reading TRAY_CONFIG_KEY
  });
  return true;
});

// ————— Monitor & Media Handlers —————

ipcMain.handle('get-monitors', () => {
  const selected = store.get('selectedMonitorId');
  const displays = screen.getAllDisplays();

  const list = displays.map((d, i) => {
    // d.bounds is standard, but some environments might have d.size
    const w = d.bounds ? d.bounds.width : (d.size ? d.size.width : 0);
    const h = d.bounds ? d.bounds.height : (d.size ? d.size.height : 0);
    return {
      id: d.id,
      label: `Monitor ${i + 1} (${w}x${h})`,
      bounds: d.bounds,
      isPrimary: (d.id === screen.getPrimaryDisplay().id),
      width: w,
      height: h
    };
  });
  return { list, selected };
});

ipcMain.handle('set-monitor', (event, monitorId) => {
  const displays = screen.getAllDisplays();
  const target = displays.find(d => d.id === monitorId);

  if (target) {
    store.set('selectedMonitorId', monitorId);
    store.set('videoWindowState', {
      x: target.bounds.x + 50,
      y: target.bounds.y + 50,
      width: 1000,
      height: 700,
      isMaximized: true
    });

    // If window is open, move it!
    if (videoWin && !videoWin.isDestroyed()) {
      if (videoWin.isFullScreen()) videoWin.setFullScreen(false);
      if (videoWin.isMaximized()) videoWin.unmaximize();
      videoWin.setBounds({
        x: target.bounds.x + 50, // Center or reset
        y: target.bounds.y + 50,
        width: 1000,
        height: 700
      });
      videoWin.maximize();
    }
    return true;
  }
  return false;
});

// Bridge for media control: Main -> Video
ipcMain.on('media-command', (event, command) => {
  if (videoWin && !videoWin.isDestroyed()) {
    if (command.action === 'fullscreen') {
      videoWin.setFullScreen(!videoWin.isFullScreen());
    } else if (command.action === 'stop') {
      // Stop playback and reset to welcome screen without full page reload
      videoWin.webContents.send('media-command', command);
      // Notify renderer to reset UI
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('media-stopped');
      }
    } else {
      videoWin.webContents.send('media-command', command);
    }
  }
});

// Bridge for media status: Video -> Main
ipcMain.on('media-status', (event, status) => {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('media-status', status);
  }
});

// Restart Server Handler (Modified for custom port)
ipcMain.handle('restart-server', async () => {
  console.log('Restarting server process...');
  stopServer();

  const port = store.get('serverPort', 3000);
  startServer(port);
  return !!serverProcess;
});

// New: Get Server Config
ipcMain.handle('get-server-config', () => {
  return {
    port: store.get('serverPort', 3000),
    authEnabled: store.get('authEnabled', false),
    keyword: store.get('authKeyword', '')
  };
});

// New: Set Server Config (Replacing set-port)
ipcMain.handle('set-server-config', async (event, config) => {
  store.set('serverPort', config.port);
  store.set('authEnabled', config.authEnabled);
  store.set('authKeyword', config.keyword);

  // Restart server to apply changes
  startServer(config.port);
  return true;
});

// New: Toggle Server
ipcMain.handle('toggle-server', async (event, shouldOn) => {
  if (shouldOn) {
    if (!serverProcess) {
      const port = store.get('serverPort', 3000);
      startServer(port);
    }
  } else {
    stopServer();
  }
  return !!serverProcess;
});

// New: Get Server Status
ipcMain.handle('get-server-status', () => {
  return {
    running: !!serverProcess,
    port: store.get('serverPort', 3000)
  };
});

// Clear Cache & Storage Data Handler
ipcMain.handle('clear-cache', async () => {
  try {
    isQuitting = true;
    stopServer();
    const { session } = require('electron');
    if (session && session.defaultSession) {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData();
    }
    store.clear();
    app.relaunch();
    app.exit(0);
  } catch (err) {
    console.error('Error clearing cache:', err);
  }
});

// ————— Helpers for Window Management —————

function getTargetDisplay() {
  const displays = screen.getAllDisplays();
  const selectedId = store.get('selectedMonitorId');

  // 1. Try saved persistent ID
  if (selectedId) {
    const found = displays.find(d => d.id === selectedId);
    if (found) return found;
  }

  // 2. Fallback: If there's a 2nd monitor, use it.
  if (displays.length > 1) {
    const second = displays[1];
    // Auto-save this choice so it persists next time
    store.set('selectedMonitorId', second.id);
    return second;
  }

  // 3. Fallback: Main monitor
  return displays[0];
}

function isBoundsOnDisplay(bounds, display) {
  if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number' || !display || !display.bounds) {
    return false;
  }
  const centerX = bounds.x + (bounds.width || 1000) / 2;
  const centerY = bounds.y + (bounds.height || 700) / 2;
  const b = display.bounds;
  return centerX >= b.x && centerX <= b.x + b.width &&
         centerY >= b.y && centerY <= b.y + b.height;
}

function createVideoWindow(targetDisplay) {
  // Load saved state or calculate default relative to target display
  const savedState = store.get('videoWindowState', {});

  let bounds = {
    x: targetDisplay.bounds.x + 50,
    y: targetDisplay.bounds.y + 50,
    width: 1000,
    height: 700
  };

  // Respect Target Monitor first: only use savedState bounds if they lie within targetDisplay
  const savedOnTarget = isBoundsOnDisplay(savedState, targetDisplay);
  if (savedOnTarget && savedState.width && savedState.height) {
    bounds = savedState;
  }

  videoWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    icon: path.join(__dirname, 'public/icons/icon.ico'),
    autoHideMenuBar: true,
    menuBarVisible: false,
    frame: true, // Native Windows Title Bar
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  if (savedOnTarget ? savedState.isMaximized : (savedState.isMaximized !== false)) {
    videoWin.maximize();
  }

  // Save state on changes
  const saveState = () => {
    if (!videoWin || videoWin.isDestroyed()) return;
    try {
      const isMax = videoWin.isMaximized();
      const b = isMax ? videoWin.getNormalBounds() : videoWin.getBounds();
      store.set('videoWindowState', {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        isMaximized: isMax
      });
    } catch (e) { /* ignore */ }
  };

  videoWin.on('resize', saveState);
  videoWin.on('move', saveState);
  videoWin.on('maximize', saveState);
  videoWin.on('unmaximize', saveState);

  videoWin.loadFile('video.html');

  videoWin.on('closed', () => {
    videoWin = null;
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('video-window-closed');
    }
  });

  return videoWin;
}

function normalizeText(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

ipcMain.handle('search', async (event, { query, tab, category }) => {
  let dir, mapping;
  let basePath = getBasePath();

  // Adjust basePath if it ends with 'videos' to avoid duplication
  if (path.basename(basePath).toLowerCase() === 'videos') {
    basePath = path.dirname(basePath);
  }

  const safeCategory = (category || 'Cantado').toLowerCase();

  if (tab === 'previous') {
    dir = path.join(basePath, 'videos', 'Anterior');
    mapping = mappingPrev;
  } else {
    if (safeCategory === 'pista') {
      dir = path.join(basePath, 'videos', 'Nuevo', 'Pista');
      mapping = mappingNewPista;
    } else if (safeCategory === 'cantado') {
      dir = path.join(basePath, 'videos', 'Nuevo', 'Cantado');
      mapping = mappingNewCantado;
    } else {
      dir = path.join(basePath, 'videos', 'Nuevo');
      mapping = {};
    }
  }

  try {
    console.log('[DEBUG-SEARCH] Searching in:', dir);
    if (!fs.existsSync(dir)) {
      console.warn('[DEBUG-SEARCH] Directory does not exist:', dir);
      return [];
    }

    let files = await fs.promises.readdir(dir);
    const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));
    const normQuery = normalizeText(query);
    const isNumQuery = /^\d+$/.test(normQuery);
    const queryNumVal = isNumQuery ? parseInt(normQuery, 10) : null;
    const queryPadded = isNumQuery ? normQuery.padStart(3, '0') : null;

    const matches = [];

    for (const f of mp4Files) {
      const baseName = path.basename(f, '.mp4');
      const normBaseName = normalizeText(baseName);
      const m = f.match(/^(\d{1,4})/);
      const rawNum = m ? m[1] : '';
      const num = rawNum ? rawNum.padStart(3, '0') : '';
      const numVal = rawNum ? parseInt(rawNum, 10) : null;

      const rawTitle = f.replace(/^\d{1,4}\s*[-–—.]?\s*/, '').replace(/\.mp4$/i, '').trim();
      const title = (mapping && (mapping[num] || mapping[rawNum])) || rawTitle;
      const normTitle = normalizeText(title);
      const display = `${num || rawNum || ''} – ${title}`;
      const normDisplay = normalizeText(display);

      let matched = false;
      let score = 999;

      if (isNumQuery) {
        // Exact number match (e.g. user typed "1" and hymn is "001" or "1")
        if (numVal !== null && numVal === queryNumVal) {
          matched = true;
          score = 1;
        } else if (num.startsWith(queryPadded) || (rawNum && rawNum.startsWith(normQuery))) {
          matched = true;
          score = 10;
        } else if (num.includes(normQuery) || (rawNum && rawNum.includes(normQuery))) {
          matched = true;
          score = 20;
        } else if (normTitle.includes(normQuery) || normBaseName.includes(normQuery)) {
          matched = true;
          score = 30;
        }
      } else {
        // Text match
        if (normTitle.startsWith(normQuery)) {
          matched = true;
          score = 5;
        } else if (normTitle.includes(normQuery)) {
          matched = true;
          score = 15;
        } else if (normBaseName.includes(normQuery) || normDisplay.includes(normQuery)) {
          matched = true;
          score = 25;
        }
      }

      if (matched) {
        matches.push({
          file: f,
          display,
          numVal: numVal !== null ? numVal : 9999,
          score,
          tab,
          category: safeCategory === 'pista' ? 'Pista' : 'Cantado'
        });
      }
    }

    // Sort: score ascending, then numeric value ascending, then title
    matches.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.numVal !== b.numVal) return a.numVal - b.numVal;
      return a.display.localeCompare(b.display);
    });

    console.log(`[DEBUG-SEARCH] Found ${matches.length} matches for "${query}"`);
    return matches.map(item => ({
      file: item.file,
      display: item.display,
      tab: item.tab,
      category: item.category,
      score: item.score,
      numVal: item.numVal
    }));
  } catch (err) {
    console.error('[DEBUG-SEARCH] Error reading directory:', dir, err.message);
    return [];
  }
});

ipcMain.handle('play', async (event, { file, tab, category }) => {
  try {
    let basePath = getBasePath();
    if (path.basename(basePath).toLowerCase() === 'videos') {
      basePath = path.dirname(basePath);
    }
    const safeCategory = (category || 'Cantado');
    const baseDir = (tab === 'previous')
      ? path.join(basePath, 'videos', 'Anterior')
      : path.join(basePath, 'videos', 'Nuevo', safeCategory);
    const fullPath = path.join(baseDir, file);

    if (!fs.existsSync(fullPath)) {
      console.error('[main] Video file not found:', fullPath);
      return { success: false, error: `No se encontró el video:\n${fullPath}` };
    }

    if (videoWin && !videoWin.isDestroyed()) {
      if (videoWin.isMinimized()) videoWin.restore();
      videoWin.show();
      videoWin.focus(); // Bring to front
      videoWin.webContents.send('set-video', fullPath);
    } else {
      const targetDisplay = getTargetDisplay();
      createVideoWindow(targetDisplay);

      // Wait for load to send video
      videoWin.webContents.once('did-finish-load', () => {
        if (videoWin && !videoWin.isDestroyed()) {
          if (videoWin.isMinimized()) videoWin.restore();
          videoWin.show();
          videoWin.focus();
          videoWin.webContents.send('set-video', fullPath);
        }
        event.sender.send('video-window-opened');
      });
    }
    return { success: true, fullPath };
  } catch (err) {
    console.error('[main] Error en play:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('toggle-live', (event, liveActive) => {
  // Logic: "liveActive" is the TARGET state we want.
  if (liveActive) {
    // We want to OPEN
    if (!videoWin || videoWin.isDestroyed()) {
      const targetDisplay = getTargetDisplay();
      createVideoWindow(targetDisplay);
      videoWin.webContents.once('did-finish-load', () => {
        event.sender.send('video-window-opened');
      });
    } else {
      videoWin.focus();
    }
  } else {
    // We want to CLOSE
    if (videoWin && !videoWin.isDestroyed()) {
      videoWin.close();
      videoWin = null;
    }
  }
});

ipcMain.handle('get-video-source-id', () => {
  if (videoWin && !videoWin.isDestroyed() && typeof videoWin.getMediaSourceId === 'function') {
    return videoWin.getMediaSourceId();
  }
  return null;
});
