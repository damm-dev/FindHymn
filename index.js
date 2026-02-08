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

// Start Local Server
const { fork } = require('child_process');
let serverProcess = null;
const serverPath = path.join(__dirname, 'server', 'server.js');



function startServer(port = 3000) {
  if (fs.existsSync(serverPath)) {
    // Pass port and auth config
    const authEnabled = store.get('authEnabled', false);
    const authKeyword = store.get('authKeyword', '');

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: port,
        AUTH_ENABLED: authEnabled,
        AUTH_KEYWORD: authKeyword
      }
    });
    console.log(`Mobile server started on port ${port} with PID:`, serverProcess.pid);
  } else {
    console.error('Server script not found at:', serverPath);
  }
}

// Auto-start default
const savedPort = store.get('serverPort', 3000); // Default 3000
startServer(savedPort);


let mainWin = null;
let videoWin = null;

const AUTO_LAUNCH_KEY = 'startWithWindows';
const TRAY_CONFIG_KEY = 'trayConfig'; // { mode: 'disabled'|'show'|'hide' }

let tray = null;
let isQuitting = false;

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
    const iconPath = path.join(__dirname, 'icon.png'); // Need an icon. Usually included. Or use default.
    // Assuming icon.png exists or fallback to empty for now (might show default electron icon)
    // If no icon, Tray might fail. Let's try to use empty if not found, or standard.
    // For now, let's assume we can use a system icon or skip if path invalid.
    // Better: Helper function
    const { nativeTheme } = require('electron');

    // Resolve Absolute Paths for Icons
    const iconWhite = path.join(__dirname, 'public/icons/icon-white.ico');
    const iconBlack = path.join(__dirname, 'public/icons/icon-Black.ico');
    const defaultIcon = path.join(__dirname, 'public/icons/icon.ico');

    const getThemeIcon = () => {
      // On Windows: Dark Taskbar usually means White Icon needed. Light Taskbar means Black Icon.
      // However, nativeTheme.shouldUseDarkColors often tells us about App Mode, not System Taskbar.
      // In Windows 10/11, standard behavior:
      // Dark System Mode -> Dark Taskbar -> White Icon
      // Light System Mode -> Light Taskbar -> Black Icon
      return nativeTheme.shouldUseDarkColors ? iconWhite : iconBlack;
    };

    // Initial creation
    tray = new Tray(getThemeIcon());

    // Listener for theme changes
    nativeTheme.on('updated', () => {
      if (tray) tray.setImage(getThemeIcon());
    });

  }

  tray.setToolTip('Find Hymn V2.0');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mostrar App', click: () => mainWin && mainWin.show() },
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

  tray.on('click', () => {
    if (mainWin) {
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

function createWindow() {
  const state = store.get('mainWindowState', {});
  const trayConfig = store.get(TRAY_CONFIG_KEY, { mode: 'disabled' });

  // Decide if show or hide on start
  const startHidden = trayConfig.mode === 'hide';

  mainWin = new BrowserWindow({
    x: state.x, y: state.y,
    width: state.width || 1280, height: state.height || 800,
    show: !startHidden, // Modified
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

  if (state.isMaximized && !startHidden) mainWin.maximize();

  mainWin.loadFile('index.html');

  // Initialize Tray based on config
  updateTray();

  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify();

  // Close vs Minimize (Tray Logic)
  mainWin.on('close', (event) => {
    const mode = store.get(TRAY_CONFIG_KEY, { mode: 'disabled' }).mode;
    if (mode !== 'disabled' && !isQuitting) {
      event.preventDefault();
      mainWin.hide();
      return false;
    }

    // Normal closing
    if (mainWin) {
      const bounds = mainWin.getBounds();
      store.set('mainWindowState', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: mainWin.isMaximized()
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
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
app.on('activate', () => {
  if (!mainWin) createWindow();
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

// ————— Auto-Updater —————
autoUpdater.on('checking-for-update', () => {
  if (mainWin) mainWin.webContents.send('checking-for-update');
});

autoUpdater.on('update-available', () => {
  if (mainWin) mainWin.webContents.send('update-available');
});

autoUpdater.on('update-not-available', () => {
  if (mainWin) mainWin.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  if (mainWin) mainWin.webContents.send('update-error', err.message);
});

autoUpdater.on('update-downloaded', () => {
  if (mainWin) mainWin.webContents.send('update-downloaded');
});

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
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
  if (!videoWin) return;
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

    // If window is open, move it!
    if (videoWin && !videoWin.isDestroyed()) {
      videoWin.setBounds({
        x: target.bounds.x + 50, // Center or reset
        y: target.bounds.y + 50,
        width: 1000,
        height: 700
      });
      videoWin.maximize();
      // Optionally reload or ensure content?
      // videoWin.reload(); 
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
      // Stop playback and reset to welcome screen
      videoWin.reload();
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

// Restart Server Handler
// Restart Server Handler (Modified for custom port)
ipcMain.handle('restart-server', async () => {
  console.log('Restarting server process...');
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
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
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
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

function createVideoWindow(targetDisplay) {
  // Load saved state or calculate default relative to target display
  const savedState = store.get('videoWindowState', {});

  let bounds = {
    x: targetDisplay.bounds.x + 50,
    y: targetDisplay.bounds.y + 50,
    width: 1000,
    height: 700
  };

  // Use saved bounds if they are valid? 
  // We prefer to respect the Target Monitor first. 
  // Only restore detailed bounds if we are mostly sure it's same config.
  // For simplicity: If savedState exists, we override x/y/w/h 
  // BUT we must ensure it's on the correct display if possible, or trust the user moved it.
  // Let's trust the saved state strictly if it exists.
  if (savedState.width && savedState.height) {
    bounds = savedState;
  } else {
    // Default positioning if no state
  }

  videoWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    autoHideMenuBar: true,
    menuBarVisible: false,
    frame: true, // Native Windows Title Bar
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  if (savedState.isMaximized) {
    videoWin.maximize();
  }

  // Save state on changes
  const saveState = () => {
    if (!videoWin || videoWin.isDestroyed()) return;
    try {
      const b = videoWin.getBounds();
      store.set('videoWindowState', {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        isMaximized: videoWin.isMaximized()
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

ipcMain.handle('search', async (event, { query, tab, category }) => {
  let dir, mapping;
  let basePath = getBasePath();

  // Adjust basePath if it ends with 'videos' to avoid duplication
  if (path.basename(basePath).toLowerCase() === 'videos') {
    basePath = path.dirname(basePath);
  }

  if (tab === 'previous') {
    dir = path.join(basePath, 'videos', 'Anterior');
    mapping = mappingPrev;
  } else {
    if (category.toLowerCase() === 'pista') {
      dir = path.join(basePath, 'videos', 'Nuevo', 'Pista');
      mapping = mappingNewPista;
    } else if (category.toLowerCase() === 'cantado') {
      dir = path.join(basePath, 'videos', 'Nuevo', 'Cantado');
      mapping = mappingNewCantado;
    } else {
      dir = path.join(basePath, 'videos', 'Nuevo');
      mapping = {};
    }
  }

  try {
    console.log('[DEBUG-SEARCH] Searching in:', dir);
    let files = await fs.promises.readdir(dir);
    files = files.filter(f => f.toLowerCase().endsWith('.mp4') &&
      path.basename(f, '.mp4').toLowerCase().includes(query.toLowerCase())
    );
    console.log(`[DEBUG-SEARCH] Found ${files.length} matches for "${query}"`);
    return files.map(f => {
      const m = f.match(/^(\d{3})/);
      const num = m ? m[1] : '';
      const rawTitle = f.replace(/^\d{3}\s*-\s*/, '').replace(/\.mp4$/i, '');
      const title = mapping[num] || rawTitle;
      return { file: f, display: `${num} – ${title}` };
    });
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
    const baseDir = (tab === 'previous')
      ? path.join(basePath, 'videos', 'Anterior')
      : path.join(basePath, 'videos', 'Nuevo', category);
    const fullPath = path.join(baseDir, file);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `No se encontró:\n${fullPath}` };
    }

    if (videoWin && !videoWin.isDestroyed()) {
      videoWin.focus(); // Bring to front
      // If it was minimized, restore? 
      // videoWin.restore(); 
      videoWin.webContents.send('set-video', fullPath);
    } else {
      const targetDisplay = getTargetDisplay();
      createVideoWindow(targetDisplay);

      // Wait for load to send video
      videoWin.webContents.once('did-finish-load', () => {
        videoWin.webContents.send('set-video', fullPath);
        event.sender.send('video-window-opened');
      });
    }
    return { success: true };
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
