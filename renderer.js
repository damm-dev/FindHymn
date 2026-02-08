// renderer.js
// renderer.js
const { ipcRenderer, clipboard } = require('electron');
const io = require('socket.io-client');
const os = require('os'); // Added for IP detection
const socket = io('http://localhost:3000');

const liveButton = document.getElementById('liveButton');
const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const tabPrevious = document.getElementById('tab-previous');
const tabNew = document.getElementById('tab-new');
const categorySelect = document.getElementById('categorySelect');
const categoryButton = document.getElementById('categoryButton');
const categoryOptions = document.getElementById('categoryOptions');
const playButton = document.getElementById('playButton');
const clearSearchButton = document.getElementById('clearSearchButton');

// Media Controls Elements
const mediaControls = document.getElementById('mediaControls');
const playerPrev = document.getElementById('playerPrev'); // Note: In HTML, Prev/Next buttons might not have IDs yet! Check HTML.
// Wait, I checked HTML. 
// "Prev" button has onclick="ipcRenderer.send...". It does NOT have id="playerPrev" in the snippet I saw in Step 529.
// "Next" button also lacks ID.
// "Loop" has id="playerLoop".
// "Stop" has id="playerStop".
// "PlayPause" has id="playerPlayPause".

// Let's re-read HTML to be sure about IDs before adding JS.
// In Step 529:
// Prev: <button onclick="..." ...> (No ID)
// Next: <button ...> (No ID, No Onclick?) - Wait, the "Next" button in Step 529 has NO ID and NO onclick listener! It's dead code!
// I need to ADD IDs to index.html first for Prev/Next if I want JS listeners, OR add onclicks.
// But renderer.js lines 532-533 use `playerPrev.addEventListener`. So they expect IDs.

// ACTION:
// 1. Update index.html to add IDs `playerPrev` and `playerNext`.
// 2. Update renderer.js to select them.

const playerLoop = document.getElementById('playerLoop');
const playerStop = document.getElementById('playerStop');
const playerPlayPause = document.getElementById('playerPlayPause');
const playerSeek = document.getElementById('playerSeek');
const playerVolume = document.getElementById('playerVolume');
const fullscreenButton = document.getElementById('fullscreenButton');
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');
const playerSongTitle = document.getElementById('playerSongTitle');
const playerSongNumber = document.getElementById('playerSongNumber');
const currentTimeSpan = document.getElementById('currentTime');
const totalTimeSpan = document.getElementById('totalTime');

let currentTab = 'previous';
let currentCategory = 'Cantado';
let selectedFile = null;
let liveActive = false;
let isLooping = false; // New loop state

// ------------- DROPDOWN MENU LOGIC -------------
const configMenu = document.createElement('div');
configMenu.className = 'dropdown-menu';
configMenu.id = 'configMenu';
configMenu.innerHTML = `
  <div id="optSelectDesc" class="dropdown-item">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
    Elegir carpeta de videos
  </div>
  
  <div id="optServerMain" class="dropdown-item" style="justify-content: space-between;">
    <div style="display:flex; gap:6px; align-items:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
        Servidor
    </div>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
  </div>

  <div id="optClearCache" class="dropdown-item">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
    Borrar Caché y Reiniciar
  </div>
`;

// Create Submenu for Server
const serverSubMenu = document.createElement('div');
serverSubMenu.className = 'dropdown-menu';
serverSubMenu.id = 'serverSubMenu';
serverSubMenu.style.width = '200px';
serverSubMenu.innerHTML = `
    <!-- Toggle Server -->
    <div class="dropdown-item" style="justify-content: space-between; cursor: default;">
        <span>Estado</span>
        <label class="switch" style="position: relative; display: inline-block; width: 34px; height: 18px;">
            <input type="checkbox" id="serverToggleCheck" checked style="opacity: 0; width: 0; height: 0;">
            <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; box-shadow: inset 0 0 2px rgba(0,0,0,0.2);"></span>
            <style>
                .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
                input:checked + .slider { background-color: #16a34a; } /* Green */
                input:checked + .slider:before { transform: translateX(16px); }
            </style>
        </label>
    </div>

    <!-- Restart -->
    <div id="optServerRestart" class="dropdown-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Reiniciar
    </div>

    <!-- Edit Port -->
    <!-- Edit Port / Config -->
    <div id="optServerEdit" class="dropdown-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        Configurar
    </div>
`;
document.body.appendChild(serverSubMenu);

// Create Submenu for Tray (Bandeja)
const traySubMenu = document.createElement('div');
traySubMenu.className = 'dropdown-menu';
traySubMenu.id = 'traySubMenu';
traySubMenu.style.width = '240px';
traySubMenu.innerHTML = `
    <div style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #888; text-transform: uppercase;">Comportamiento</div>
    
    <!-- Option: Disabled -->
    <div id="optTrayDisabled" class="dropdown-item">
        <div style="width: 16px;"></div> <!-- Spacer/Check placeholder -->
        Deshabilitar
    </div>
    <!-- Option: Enabled + Show -->
    <div id="optTrayShow" class="dropdown-item">
        <div style="width: 16px;"></div>
        Habilitar y mostrar
    </div>
    <!-- Option: Enabled + Hide -->
    <div id="optTrayHide" class="dropdown-item">
        <div style="width: 16px;"></div>
        Habilitar y ocultar (Minimizado)
    </div>

    <div style="height: 1px; background: #eee; margin: 4px 0;"></div>

    <!-- Start with Windows -->
    <div class="dropdown-item" style="justify-content: space-between; cursor: default;">
        <span>Iniciar con Windows</span>
        <label class="switch">
            <input type="checkbox" id="checkStartWindows">
            <span class="slider round"></span>
        </label>
    </div>
`;
document.body.appendChild(traySubMenu);

configMenu.innerHTML = `
  <div id="optSelectDesc" class="dropdown-item">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
    Elegir carpeta de videos
  </div>
  
  <div id="optServerMain" class="dropdown-item" style="justify-content: space-between;">
    <div style="display:flex; gap:6px; align-items:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
        Servidor
    </div>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
  </div>

  <div id="optTrayMain" class="dropdown-item" style="justify-content: space-between;">
    <div style="display:flex; gap:6px; align-items:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v10H4z"></path><path d="M2 18h20"></path></svg>
        Bandeja / Inicio
    </div>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
  </div>

  <div id="optCheckUpdates" class="dropdown-item">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
    Buscar actualizaciones
  </div>

  <div id="optClearCache" class="dropdown-item">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
    Borrar Caché y Reiniciar
  </div>
`;
document.body.appendChild(configMenu);

// HOVER HANDLING
// HOVER HANDLING - SERVER
const optServerMain = configMenu.querySelector('#optServerMain');
// Logic moved below to be consistent with Tray logic

// Keep Check for leaving either menu
configMenu.addEventListener('mouseleave', (e) => {
  // Check if moving to serverSubMenu or traySubMenu
  if (e.relatedTarget && (serverSubMenu.contains(e.relatedTarget) || traySubMenu.contains(e.relatedTarget))) return;
  serverSubMenu.classList.remove('active');
  traySubMenu.classList.remove('active');
});
serverSubMenu.addEventListener('mouseleave', (e) => {
  // Check if moving back to configMenu
  if (e.relatedTarget && configMenu.contains(e.relatedTarget)) return;
  serverSubMenu.classList.remove('active');
});
traySubMenu.addEventListener('mouseleave', (e) => {
  if (e.relatedTarget && configMenu.contains(e.relatedTarget)) return;
  traySubMenu.classList.remove('active');
});

// HOVER HANDLING - TRAY
const optTrayMain = configMenu.querySelector('#optTrayMain');
if (optTrayMain) {
  optTrayMain.addEventListener('mouseenter', async () => {
    // Initializing Checkboxes/State
    const config = await ipcRenderer.invoke('get-tray-config');

    updateTrayMenuUI(config);

    const rect = optTrayMain.getBoundingClientRect();
    traySubMenu.style.top = `${rect.top}px`;
    traySubMenu.style.left = `${rect.right + 2}px`;
    traySubMenu.classList.add('active');
    serverSubMenu.classList.remove('active'); // Close sibling
  });
}

// Ensure Server Menu Closes Tray Menu
if (optServerMain) {
  optServerMain.addEventListener('mouseenter', () => {
    const rect = optServerMain.getBoundingClientRect();
    serverSubMenu.style.top = `${rect.top}px`;
    serverSubMenu.style.left = `${rect.right + 2}px`;
    serverSubMenu.classList.add('active');
    traySubMenu.classList.remove('active'); // Close sibling
  });
}

function updateTrayMenuUI(config) {
  // Spacer Reset
  const checkHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  document.querySelector('#optTrayDisabled > div').innerHTML = config.mode === 'disabled' ? checkHTML : '';
  document.querySelector('#optTrayShow > div').innerHTML = config.mode === 'show' ? checkHTML : '';
  document.querySelector('#optTrayHide > div').innerHTML = config.mode === 'hide' ? checkHTML : '';

  document.getElementById('checkStartWindows').checked = config.startWithWindows;
}

// Remove inline styles from switch since they are now global
const switchInput = serverSubMenu.querySelector('#serverToggleCheck');
if (switchInput) switchInput.style = ""; // Clear inline styles
// Remove the inner style block
const styleBlock = serverSubMenu.querySelector('style');
if (styleBlock) styleBlock.remove();

// Reusing settingsMenu logic but generalized
// We can remove the manual creation of settingsMenu if we want, or adapt it.
// Let's adapt settingsMenu to be the "Projection Menu" explicitly
const settingsMenu = document.createElement('div'); // Ensure settingsMenu is defined if not already
if (settingsMenu) {
  settingsMenu.className = 'dropdown-menu';
  settingsMenu.id = 'projectionMenu';
  settingsMenu.style.top = '';
  settingsMenu.style.left = '';
  // Reset specific styles that conflict with class
  settingsMenu.style.backgroundColor = '';
  settingsMenu.style.backdropFilter = '';
  settingsMenu.style.border = '';
  settingsMenu.style.borderRadius = '';
  settingsMenu.style.padding = '';
  settingsMenu.style.boxShadow = '';
}

// 2. toggleMenu: Modified to prevent aggressive closing if we are opening a submenu
function toggleMenu(trigger, menu) {
  const isActive = menu.classList.contains('active');

  // Close ALL dropdowns IF we are opening a root menu (like configMenu)
  // But if we are opening a submenu, we might want to keep the parent open?
  // Current logic: closes everything except 'menu'. 
  // If 'menu' is a submenu, this closes the parent! That's the bug.

  if (menu.id !== 'serverSubMenu' && menu.id !== 'traySubMenu') {
    document.querySelectorAll('.dropdown-menu').forEach(m => {
      if (m !== menu && m.id !== 'serverSubMenu' && m.id !== 'traySubMenu') m.classList.remove('active');
      // If we are opening configMenu, close submenus too?
      if (menu.id === 'configMenu' && (m.id === 'serverSubMenu' || m.id === 'traySubMenu')) m.classList.remove('active');
    });
  } else {
    // Opening submenu: Do NOT close other menus (specifically configMenu)
    // Close sibling submenus
    if (menu.id === 'serverSubMenu') document.getElementById('traySubMenu').classList.remove('active');
    if (menu.id === 'traySubMenu') document.getElementById('serverSubMenu').classList.remove('active');
  }

  if (!isActive) {
    const rect = trigger.getBoundingClientRect();
    menu.style.top = `${rect.top}px`; // Align top-to-top for submenu style

    if (menu.id === 'serverSubMenu') {
      // Position to the right of the item
      menu.style.left = `${rect.right - 5}px`;
      menu.style.top = `${rect.top - 10}px`;
    } else {
      // Standard dropdown
      menu.style.top = `${rect.bottom + 5}px`;
      menu.style.left = `${rect.left}px`;
    }

    menu.classList.add('active');
  } else {
    menu.classList.remove('active');
  }
}

// Global click to close menus
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-menu') && !e.target.closest('.menu-item')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
  }
});

// Cleaned up References
const aboutModal = document.getElementById('aboutModal');
const closeAbout = document.getElementById('closeAbout');
const githubLink = document.getElementById('githubLink');
const btnConfig = document.getElementById('btnConfig');
const btnProjection = document.getElementById('btnProjection');
const btnAbout = document.getElementById('btnAbout');

// New Pill Elements
const ipLabel = document.getElementById('ipLabel');
const btnCopyIP = document.getElementById('btnCopyIP');
const monitorPillControls = document.getElementById('monitorPillControls');


// ------------- MONITOR PILL LOGIC -------------
async function updateMonitorPill() {
  if (!monitorPillControls) return;

  try {
    const result = await ipcRenderer.invoke('get-monitors');
    const list = result?.list || result || [];
    const selected = result?.selected || null;

    monitorPillControls.innerHTML = '';

    if (!list || list.length === 0) return;

    list.forEach((m, i) => {
      const btn = document.createElement('div');
      btn.className = 'mon-btn';
      btn.textContent = (i + 1).toString();
      btn.title = m.label || `Monitor ${m.id}`;

      if (m.id === selected) {
        btn.classList.add('active');
      }

      btn.onclick = async () => {
        try {
          await ipcRenderer.invoke('set-monitor', m.id);
          // Broadcast to mobile
          const updated = await ipcRenderer.invoke('get-monitors');
          socket.emit('status', { type: 'monitors-list', data: updated });

          // Local update
          updateMonitorPill();
          // Update menu if open?
        } catch (err) { console.error(err); }
      };

      monitorPillControls.appendChild(btn);
    });

  } catch (err) { console.error(err); }
}

// Init Pill
updateMonitorPill();


// We removed configPathOption from here, now it's separate button


const monitorTitle = document.createElement('div');
monitorTitle.textContent = 'Seleccionar Monitor';
monitorTitle.style.padding = '8px 12px';
monitorTitle.style.fontSize = '11px';
monitorTitle.style.fontWeight = 'bold';
monitorTitle.style.color = '#888';
monitorTitle.style.textTransform = 'uppercase'; // Match Comportamiento
monitorTitle.textContent = 'MONITORES';
settingsMenu.appendChild(monitorTitle);

const monitorList = document.createElement('div');
monitorList.style.marginTop = '4px';
settingsMenu.appendChild(monitorList);

// ------------- MENU HANDLERS -------------

// Setup Config Button
if (btnConfig) {
  btnConfig.addEventListener('click', () => toggleMenu(btnConfig, configMenu));
}

// Setup Projection Button
// Setup Projection Button
// Refactored Monitor Loader
async function openProjectionMenu(trigger) {
  toggleMenu(trigger, settingsMenu);
  if (settingsMenu.classList.contains('active')) {
    // Load monitors (reuse existing logic)
    try {
      const result = await ipcRenderer.invoke('get-monitors');
      monitorList.innerHTML = '';

      // Handle response format
      const list = result?.list || result || [];
      const selected = result?.selected || null;

      if (!list || list.length === 0) {
        monitorList.innerHTML = '<div style="padding:8px;text-align:center;color:#999;font-size:12px;">No se encontraron pantallas adicionales.</div>';
        return;
      }

      list.forEach(m => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = m.label || `Monitor ${m.id}`;
        if (m.id === selected) {
          item.style.fontWeight = 'bold';
          item.style.backgroundColor = '#e0e7ff';
        }
        item.addEventListener('click', async () => {
          try {
            await ipcRenderer.invoke('set-monitor', m.id);

            // Broadcast change to mobile
            const updated = await ipcRenderer.invoke('get-monitors');
            socket.emit('status', { type: 'monitors-list', data: updated });

            settingsMenu.classList.remove('active');
            updateMonitorPill(); // Sync local pill logic immediately!
            updateMonitorPill(); // Sync local pill logic immediately!
          } catch (err) {
            console.error('Error setting monitor:', err);
          }
        });
        monitorList.appendChild(item);
      });
    } catch (err) {
      console.error('Error loading monitors:', err);
      monitorList.innerHTML = '<div style="padding:8px;text-align:center;color:#ef4444;font-size:12px;">Error al cargar las pantallas. Intenta de nuevo.</div>';
    }
  }
}

// Ensure updateServerStatusPill is defined and working
async function updateServerStatusPill() {
  const ipLabel = document.getElementById('ipLabel');
  const keywordPill = document.getElementById('keywordPill');
  const keywordContent = document.getElementById('keywordContent');
  const keywordEye = document.getElementById('keywordEye');

  try {
    const config = await ipcRenderer.invoke('get-server-config');
    const ip = getLocalIP();
    const full = `${ip}:${config.port}`;

    if (ipLabel) ipLabel.textContent = full;

    // Keyword Pill Logic
    if (keywordPill) {
      if (config.authEnabled) {
        keywordPill.style.display = 'flex';
        // Reset state
        if (keywordContent) {
          keywordContent.dataset.real = config.keyword;
          keywordContent.dataset.hidden = 'true';
          keywordContent.textContent = '•'.repeat(config.keyword.length);
        }
      } else {
        keywordPill.style.display = 'none';
      }
    }

  } catch (e) { console.error("Error updating server pill:", e); }
}

// Initialize logic
updateServerStatusPill();

// Keyword Eye Toggle
const keywordEye = document.getElementById('keywordEye');
const keywordContent = document.getElementById('keywordContent');

if (keywordEye && keywordContent) {
  keywordEye.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = keywordContent.dataset.hidden === 'true';
    if (isHidden) {
      keywordContent.textContent = keywordContent.dataset.real;
      keywordContent.dataset.hidden = 'false';
      // Optional: Change Eye Icon
    } else {
      keywordContent.textContent = '•'.repeat(keywordContent.dataset.real.length);
      keywordContent.dataset.hidden = 'true';
    }
  });
}

const keywordPill = document.getElementById('keywordPill');
if (keywordPill && keywordContent) {
  keywordPill.addEventListener('click', () => {
    const realKeyword = keywordContent.dataset.real;
    if (realKeyword) {
      clipboard.writeText(realKeyword);

      // Visual Feedback
      const wasHidden = keywordContent.dataset.hidden === 'true';

      // Save original styles
      const originalColor = keywordContent.style.color;
      const originalSpacing = keywordContent.style.letterSpacing;

      keywordContent.textContent = "COPIADO";
      keywordContent.style.color = "#4ade80"; // Green
      keywordContent.style.letterSpacing = "normal";

      setTimeout(() => {
        // Restore styling
        keywordContent.style.color = originalColor;
        keywordContent.style.letterSpacing = originalSpacing;

        // Restore text based on state (which might have changed if user somehow clicked eye? No, propagation stopped)
        // Check current state just to be safe
        if (keywordContent.dataset.hidden === 'true') {
          keywordContent.textContent = '•'.repeat(keywordContent.dataset.real.length);
        } else {
          keywordContent.textContent = keywordContent.dataset.real;
        }
      }, 1500);
    }
  });
}

if (btnProjection) {
  btnProjection.addEventListener('click', () => {
    // Refresh pill on opening menu too just in case
    updateMonitorPill();
    openProjectionMenu(btnProjection);
  });
}

// IP Logic
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if ('IPv4' !== iface.family || iface.internal !== false) {
        continue;
      }
      return iface.address;
    }
  }
  return 'localhost';
}

if (ipLabel) {
  // Initial load handled by updateServerStatusPill()
  // const ip = getLocalIP(); 
  // const port = '3000'; 
  // const full = `${ip}:${port}`;
  // ipLabel.textContent = full; 

  if (btnCopyIP) {
    btnCopyIP.addEventListener('click', () => {
      // Re-fetch current text content which should be correct
      const currentText = ipLabel.textContent;
      clipboard.writeText(`http://${currentText}`);

      const originalText = currentText;
      ipLabel.textContent = "Copiado!";
      ipLabel.style.color = "#16a34a"; // Green

      setTimeout(() => {
        ipLabel.textContent = originalText; // Restore original
        ipLabel.style.color = "#444";
      }, 1500);
    });
  }
}

// Config Option Click
document.addEventListener('click', async (e) => {
  // Option: Restart Server (Old) - Removed as it's now in submenu
  // if (e.target.id === 'optRestartServer') { ... } 

  // Option: Server Menu (Open Submenu)
  if (e.target.closest('#optServerMain')) {
    // Don't close main config menu yet? Or maybe shift focus?
    // UI pattern: Open submenu next to item.
    e.stopPropagation(); // prevent closing
    toggleMenu(document.getElementById('optServerMain'), serverSubMenu);

    // Update toggle state
    const status = await ipcRenderer.invoke('get-server-status');
    document.getElementById('serverToggleCheck').checked = status.running;
  }

  // Option: Server Toggle
  if (e.target.id === 'serverToggleCheck') {
    const isChecked = e.target.checked;
    ipcRenderer.invoke('toggle-server', isChecked);
    // Wait a bit?
  }

  // Option: Restart Server (New)
  if (e.target.closest('#optServerRestart')) {
    serverSubMenu.classList.remove('active');
    configMenu.classList.remove('active');

    // Visual feedback for restart
    const switchInput = document.getElementById('serverToggleCheck');
    if (switchInput) switchInput.checked = false;

    const success = await ipcRenderer.invoke('restart-server');

    if (switchInput) switchInput.checked = success;

    if (success) showToast("Servidor reiniciado correctamente.", 'success');
    else showToast("Error al reiniciar el servidor.", 'error');
  }

  // Option: Edit Port / Config (New Modal)
  if (e.target.closest('#optServerEdit')) {
    serverSubMenu.classList.remove('active');
    configMenu.classList.remove('active');
    openServerSettings();
  }

  // TRAY OPTIONS
  if (e.target.closest('#optTrayDisabled')) {
    await ipcRenderer.invoke('set-tray-config', { mode: 'disabled' });
    traySubMenu.classList.remove('active');
    // Optionally update visual feedback immediately if menu stays open
    // updateTrayMenuUI({mode: 'disabled', startWithWindows: document.getElementById('checkStartWindows').checked});
  }
  if (e.target.closest('#optTrayShow')) {
    await ipcRenderer.invoke('set-tray-config', { mode: 'show' });
    traySubMenu.classList.remove('active');
  }
  if (e.target.closest('#optTrayHide')) {
    await ipcRenderer.invoke('set-tray-config', { mode: 'hide' });
    traySubMenu.classList.remove('active');
  }

  // Windows Start Toggle (Delegate because it's in a label)
  if (e.target.id === 'checkStartWindows') {
    const isChecked = e.target.checked;
    await ipcRenderer.invoke('toggle-start-with-windows', isChecked);
  }

  // Option: Check for Updates
  if (e.target.id === 'optCheckUpdates' || e.target.closest('#optCheckUpdates')) {
    configMenu.classList.remove('active');
    showToast("Buscando actualizaciones...", 'info');
    ipcRenderer.send('check-for-updates');
  }

  // Option: Select Folder
  if (e.target.id === 'optSelectDesc') {
    configMenu.classList.remove('active');
    const folderPath = await ipcRenderer.invoke('select-video-folder');
    if (folderPath) {
      const success = await ipcRenderer.invoke('set-video-folder', folderPath);
      if (success) {
        searchInput.value = '';
        clearSearchResults();
        searchInput.focus();
      }
    }
  }

  // Option: Clear Cache
  if (e.target.id === 'optClearCache') {
    console.log("Requesting Cache Clear...");
    configMenu.classList.remove('active');
    // No need to wait for result as app will restart
    ipcRenderer.invoke('clear-cache');
  }
});


// SERVER SETTINGS MODAL LOGIC
const serverSettingsModal = document.getElementById('serverSettingsModal');
const serverSettingsCard = document.getElementById('serverSettingsCard');
const inputServerPort = document.getElementById('inputServerPort');
const checkServerAuth = document.getElementById('checkServerAuth');
const inputServerKeyword = document.getElementById('inputServerKeyword');
const btnCancelServer = document.getElementById('btnCancelServerSettings');
const btnSaveServer = document.getElementById('btnSaveServerSettings');

// Initial State Handlers
if (checkServerAuth) {
  checkServerAuth.addEventListener('change', (e) => {
    inputServerKeyword.disabled = !e.target.checked;
    inputServerKeyword.style.opacity = e.target.checked ? '1' : '0.5';
  });
}
if (btnCancelServer) btnCancelServer.addEventListener('click', closeServerSettings);
if (btnSaveServer) btnSaveServer.addEventListener('click', saveServerSettings);

async function openServerSettings() {
  // 1. Get Config
  // We assume handlers exist in main process (created in Phase 1 Part 2)
  const config = await ipcRenderer.invoke('get-server-config'); // { port, authEnabled, keyword }

  inputServerPort.value = config.port || 3000;
  if (checkServerAuth) {
    checkServerAuth.checked = !!config.authEnabled;
    inputServerKeyword.disabled = !config.authEnabled;
    inputServerKeyword.style.opacity = config.authEnabled ? '1' : '0.5';
  }
  if (inputServerKeyword) inputServerKeyword.value = config.keyword || '';

  serverSettingsModal.classList.add('active');
}

function closeServerSettings() {
  serverSettingsModal.classList.remove('active');
}

// Toast Notification Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon based on type
  let iconHTML = '';
  if (type === 'success') {
    iconHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    iconHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `${iconHTML}<span>${message}</span>`;
  container.appendChild(toast);

  // Animate In
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Remove after 3s
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

async function saveServerSettings() {
  const port = parseInt(inputServerPort.value) || 3000;
  const authEnabled = checkServerAuth ? checkServerAuth.checked : false;
  const keyword = inputServerKeyword ? inputServerKeyword.value.trim() : '';

  if (authEnabled && !keyword) {
    showToast("Por favor ingresa una palabra clave.", 'error');
    return;
  }

  // Send to Main
  const success = await ipcRenderer.invoke('set-server-config', { port, authEnabled, keyword });
  if (success) {
    showToast("Configuración guardada y servidor reiniciado.", 'success');
    closeServerSettings();
    // Update local status pill
    updateServerStatusPill();
  } else {
    showToast("Error al guardar configuración.", 'error');
  }
}




// 3. Acerca de
const aboutModalCard = document.getElementById('aboutModalCard');

// ————— Update Event Listeners —————
ipcRenderer.on('checking-for-update', () => {
  // We already show "Buscando..." on button click, but this handles auto-check too
  // showToast("Buscando actualizaciones...", 'info'); 
});

ipcRenderer.on('update-available', () => {
  showToast("Nueva actualización disponible. Descargando...", 'info');
});

ipcRenderer.on('update-not-available', () => {
  showToast("La aplicación ya está actualizada.", 'success');
});

ipcRenderer.on('update-error', (event, message) => {
  showToast(`Error al buscar actualizaciones: ${message}`, 'error');
});

ipcRenderer.on('update-downloaded', () => {
  showToast("Actualización descargada. Reinicia para aplicar.", 'success');
  // Optional: Add a button to restart
  // For now, let's just use the toast.
});

function openAboutModal() {
  aboutModal.classList.add('active');
}

function closeAboutModal() {
  aboutModal.classList.remove('active');
}

if (btnAbout) btnAbout.addEventListener('click', openAboutModal);
if (closeAbout) closeAbout.addEventListener('click', closeAboutModal);

// Close on backdrop click
aboutModal.addEventListener('click', (e) => {
  if (e.target === aboutModal) closeAboutModal();
});
if (githubLink) {
  githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    require('electron').shell.openExternal('https://github.com/damm-dev');
  });
}

// Old menu logic removed
// document.body.appendChild(settingsMenu); removed (it's reused above)
if (!document.getElementById('projectionMenu')) {
  document.body.appendChild(settingsMenu);
}

// settingsIcon click handler removed (merged above)

// Close settings menu when clicking outside
// This logic is now handled by the global click listener for dropdown menus.

function setLiveButtonState(isLive) {
  liveActive = isLive;
  // Use 'live-active' class on the new En Curso button (liveButton)
  if (liveActive) {
    liveButton.classList.add('live-active');
  } else {
    liveButton.classList.remove('live-active');
  }

  // Sync to mobile
  socket.emit('status', {
    type: 'live-state',
    data: { active: liveActive }
  });
}

// Logic: Clicking Live button toggles window (Open/Close)
liveButton.addEventListener('click', () => {
  // If active (Red), close it.
  // If inactive (Gray), open it.
  // We send 'toggle-live' with the DESIRED state (!liveActive)
  ipcRenderer.invoke('toggle-live', !liveActive);
});

// Listener for SEARCH Enter
searchInput.addEventListener('input', () => {
  // Show/Hide clear button
  if (searchInput.value) {
    clearSearchButton.classList.remove('hidden');
  } else {
    clearSearchButton.classList.add('hidden');
  }
});

clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchButton.classList.add('hidden');
  clearSearchResults();
  searchInput.focus();
});


// Keyboard Navigation State
let selectedResultIndex = -1;

// Listener for Search Input Navigation & Enter
searchInput.addEventListener('keydown', (e) => {
  const resultItems = resultsDiv.querySelectorAll('.search-result-item');
  // Allow navigation even if list is empty if we want to handle other keys? No.
  if (resultItems.length === 0 && e.key !== 'Enter') return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (resultItems.length > 0) {
      selectedResultIndex = (selectedResultIndex + 1) % resultItems.length;
      updateSelection(resultItems);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (resultItems.length > 0) {
      selectedResultIndex = (selectedResultIndex - 1 + resultItems.length) % resultItems.length;
      updateSelection(resultItems);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedResultIndex !== -1 && resultItems[selectedResultIndex]) {
      resultItems[selectedResultIndex].click(); // Select it
      playButton.click(); // Trigger Play logic
    } else if (resultItems.length > 0) {
      // Automatic first selection if none selected
      resultItems[0].click();
      playButton.click();
    } else if (selectedFile) {
      // Just play/replay if already selected
      playButton.click();
    }
  }
});

function updateSelection(items) {
  items.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.style.backgroundColor = '#f3f4f6'; // Highlight
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.style.backgroundColor = '';
    }
  });
}

ipcRenderer.on('video-window-opened', () => setLiveButtonState(true));
ipcRenderer.on('video-window-closed', () => {
  setLiveButtonState(false);
  // mediaControls.style.display = 'none'; // KEEP VISIBLE per request
});

playButton.addEventListener('click', () => {
  if (selectedFile) {
    ipcRenderer.invoke('play', {
      file: selectedFile,
      tab: currentTab,
      category: currentCategory
    });
    // Update player info from search input or known selection
    // The search input usually holds the display string when a file is selected
    if (searchInput.value) {
      updateSongInfo(searchInput.value);
    }
  }
});

// Init UI: Load persistent tab
(async () => {
  const savedTab = await ipcRenderer.invoke('get-store-value', 'lastTab');
  if (savedTab === 'new' || savedTab === 'previous') {
    currentTab = savedTab;
  }
  updateTabVisuals();

  // Set initial display of categorySelect based on loaded tab
  categorySelect.style.display = currentTab === 'previous' ? 'none' : 'block';

  // Fade in the tabs now that state is steady
  const tabContainer = document.getElementById('tabContainer');
  if (tabContainer) tabContainer.style.opacity = '1';
})();

function updateTabVisuals() {
  if (currentTab === 'previous') {
    tabPrevious.classList.add('tab-active');
    tabPrevious.classList.remove('tab-inactive');
    tabNew.classList.remove('tab-active');
    tabNew.classList.add('tab-inactive');
  } else {
    tabNew.classList.add('tab-active');
    tabNew.classList.remove('tab-inactive');
    tabPrevious.classList.remove('tab-active');
    tabPrevious.classList.add('tab-inactive');
  }
}

// pestañas
tabPrevious.addEventListener('click', async () => {
  if (currentTab === 'previous') return;
  currentTab = 'previous';
  updateTabVisuals();
  categorySelect.style.display = 'none';
  ipcRenderer.invoke('set-store-value', 'lastTab', 'previous'); // Save

  // Update input value and selectedFile based on current key
  const keyMatch = searchInput.value.match(/^(\d{3})/);
  if (keyMatch) {
    const key = keyMatch[1];
    const items = await ipcRenderer.invoke('search', {
      query: key,
      tab: currentTab,
      category: currentCategory
    });
    if (items.length > 0) {
      searchInput.value = items[0].display;
      selectedFile = items[0].file;
    }
  }
  clearSearchResults();
});

tabNew.addEventListener('click', async () => {
  if (currentTab === 'new') return;
  currentTab = 'new';
  updateTabVisuals();
  categorySelect.style.display = 'block';
  ipcRenderer.invoke('set-store-value', 'lastTab', 'new'); // Save

  // Update input value and selectedFile based on current key
  const keyMatch = searchInput.value.match(/^(\d{3})/);
  if (keyMatch) {
    const key = keyMatch[1];
    const items = await ipcRenderer.invoke('search', {
      query: key,
      tab: currentTab,
      category: currentCategory
    });
    if (items.length > 0) {
      searchInput.value = items[0].display;
      selectedFile = items[0].file;
    }
  }
  clearSearchResults();
});

// selector categoría
const categoryButtonText = document.getElementById('categoryButtonText');

function toggleCategoryMenu() {
  // Check if it HAS the class 'active-menu'
  const isActive = categoryOptions.classList.contains('active-menu');
  if (isActive) {
    categoryOptions.classList.remove('active-menu');
    // Wait for transition then hide? CSS transitions handle opacity.
    // For simple pointer-events handling, removing active-menu is enough if CSS sets pointer-events:none
  } else {
    categoryOptions.classList.add('active-menu');
  }
}

if (categoryButton) {
  categoryButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCategoryMenu();
  });
}

// Using event delegation for the new DIV options structure
if (categoryOptions) {
  categoryOptions.addEventListener('click', (e) => {
    // Find the closest div with data-value (the option item)
    const option = e.target.closest('[data-value]');
    if (option) {
      // Prevent event bubbling 
      e.stopPropagation();

      currentCategory = option.dataset.value;

      // Update text inside span (Force text update)
      if (categoryButtonText) {
        categoryButtonText.textContent = currentCategory.toUpperCase();
      }

      // Hide dropdown
      categoryOptions.classList.remove('active-menu');

      // Clear results 
      clearSearchResults();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    // If click is NOT inside categorySelect (the button + menu wrapper)
    if (categorySelect && !categorySelect.contains(e.target)) {
      categoryOptions.classList.remove('active-menu');
    }
  });
}

// limpiar resultados
function clearSearchResults() {
  resultsDiv.innerHTML = '';
  resultsDiv.classList.remove('active-results'); // Hide via animation class
}

// muestra resultados
function renderSearchResults(items) {
  // Clear inner but keep container logic
  resultsDiv.innerHTML = '';
  selectedResultIndex = -1; // Reset selection on new search

  if (!items.length) {
    resultsDiv.classList.remove('active-results');
    return;
  }

  items.forEach(item => {
    const div = document.createElement('div');
    div.textContent = item.display;

    // Styling: Bigger text, padding, Black Hover effect (INLINE STYLES for reliability)
    // Styling: Bigger text, padding, Black Hover effect (INLINE STYLES for reliability)
    div.style.padding = '0.5rem 1.0rem'; // Reduced padding for density
    div.style.cursor = 'pointer';
    div.style.color = '#1f2937'; // gray-800
    div.style.fontSize = '1rem';
    div.style.fontWeight = '500';
    div.style.borderBottom = '1px solid #f3f4f6';
    div.style.transition = 'all 0.1s ease'; // Faster item hover

    div.addEventListener('mouseenter', () => {
      div.style.backgroundColor = 'black';
      div.style.color = 'white';
      div.style.paddingLeft = '1.75rem';
    });
    div.addEventListener('mouseleave', () => {
      div.style.backgroundColor = 'transparent';
      div.style.color = '#1f2937';
      div.style.paddingLeft = '1.25rem';
    });

    div.addEventListener('click', () => {
      selectedFile = item.file;
      updateSongInfo(item.display);
      // Removed: searchInput.value = display; (User pref: keep text?)
      // Actually user complained "if I click search box without modifying text...".
      // Let's NOT clear the search input text on selection, just hide results?
      // Or behave standard?
      // Standard: keep text.
      // searchInput.value = display; // <-- Can comment this out if user wants to keep typing?
      // Most users expect it to fill. Let's keep filling but ENSURE re-play works.
      searchInput.value = item.display;
      clearSearchResults();

      // Auto-Play Removed per user request.
      // playButton.click(); 
    });
    resultsDiv.appendChild(div);
  });

  // Show with animation
  resultsDiv.classList.add('active-results');
}

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) {
    clearSearchResults();
    selectedFile = null;
    return;
  }
  const items = await ipcRenderer.invoke('search', {
    query: q,
    tab: currentTab,
    category: currentCategory
  });
  renderSearchResults(items);
  selectedFile = null;
}

searchInput.addEventListener('input', () => {
  updateClearButtonVisibility();
  doSearch();
});
searchInput.addEventListener('focus', () => {
  updateClearButtonVisibility();
  doSearch();
});

function updateClearButtonVisibility() {
  clearSearchButton.style.display =
    searchInput.value.trim() ? 'block' : 'none';
}
clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchResults();
  selectedFile = null;
  updateClearButtonVisibility();
  searchInput.focus();
});

// click fuera cierra dropdowns
document.addEventListener('click', event => {
  if (!categorySelect.contains(event.target))
    categoryOptions.classList.add('hidden');
  if (!resultsDiv.contains(event.target) && event.target !== searchInput)
    clearSearchResults();
});

// init UI
// Load tab persistence handles this now
// categorySelect.style.display = currentTab === 'previous' ? 'none' : 'block';

// ————— Media Control Logic —————
let isDraggingSeek = false;
let currentHymnNumber = null;

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

async function playNeighbor(offset) {
  if (currentHymnNumber === null) return;

  const targetNum = currentHymnNumber + offset;
  if (targetNum < 1) return; // Boundary check

  const targetStr = targetNum.toString().padStart(3, '0');

  // Search for the track
  const items = await ipcRenderer.invoke('search', {
    query: targetStr,
    tab: currentTab,
    category: currentCategory
  });

  // Find exact match for the number prefix
  const match = items.find(item => item.display.startsWith(targetStr));

  if (match) {
    selectedFile = match.file;
    playButton.click(); // Reuse existing play logic
    // FORCE UPDATE info
    updateSongInfo(match.display);
  }
}

playerStop.addEventListener('click', () => {
  ipcRenderer.send('media-command', { action: 'stop' });
});

playerLoop.addEventListener('click', () => {
  isLooping = !isLooping;
  playerLoop.style.color = isLooping ? '#4F46E5' : '#999'; // Blue when active
  ipcRenderer.send('media-command', { action: 'loop', value: isLooping });
});

playerPrev.addEventListener('click', () => playNeighbor(-1));
playerNext.addEventListener('click', () => playNeighbor(1));

function updateSongInfo(displayString) {
  // Expected format: "001 – Title"
  const parts = displayString.split('–').map(s => s.trim());
  if (parts.length >= 2) {
    const numStr = parts[0];
    const title = parts.slice(1).join(' – ');
    playerSongNumber.textContent = `Himno #${numStr}`;
    playerSongTitle.textContent = title;

    currentHymnNumber = parseInt(numStr, 10);

    // Disable prev if #1
    playerPrev.style.opacity = currentHymnNumber <= 1 ? '0.3' : '1';
    playerPrev.style.pointerEvents = currentHymnNumber <= 1 ? 'none' : 'auto';
  } else {
    playerSongTitle.textContent = displayString;
    playerSongNumber.textContent = '';
    currentHymnNumber = null;
  }
}

playerPlayPause.addEventListener('click', () => {
  const isPlaying = iconPlay.style.display === 'none';

  // If user clicks Footer Play on a finished song, 'play' command should restart it IF video window handles it.
  // If video window is at end, 'play' might do nothing without 'seek 0'.

  // Let's be robust: If ended (iconPlay visible), send 'play'.
  // If it was just selected from search but never loaded, we need 'load-media'.

  // The separate `playButton` (Big Black Button) handles loading.
  // The footer button is for control.

  // User complaint: "click search box... want to play again nothing happens".
  // This implies using the BIG Play button or Enter.
  // User request: Bottom Play Button should work even if not started yet.
  if (selectedFile && !isPlaying) {
    if (playerSeek.value == 0 && currentTimeSpan.textContent === "0:00") {
      // Assume never loaded.
      console.log("Starting media via Footer Play...");
      ipcRenderer.send('load-media', selectedFile);
      ipcRenderer.send('media-command', { action: 'play' });
      return;
    }
  }

  ipcRenderer.send('media-command', { action: isPlaying ? 'pause' : 'play' });
});

// Big Play Button Logic - Handles RELOAD/Replay
playButton.addEventListener('click', () => {
  if (selectedFile) {
    // Always send load-media to force replay/restart
    ipcRenderer.send('load-media', selectedFile);
    // Also ensure we are in play mode
    ipcRenderer.send('media-command', { action: 'play' });

    // Ensure live is active if desired?
    // if (!liveActive) setLiveButtonState(true); // Maybe? User logic prefers manual toggle usually, but loading often implies showing.
    // Let's force live on Load for convenience? - User didn't ask. Stick to requested.
  }
});

playerSeek.addEventListener('mousedown', () => isDraggingSeek = true);
playerSeek.addEventListener('mouseup', () => {
  isDraggingSeek = false;
  ipcRenderer.send('media-command', { action: 'seek', value: parseFloat(playerSeek.value) });
});
playerSeek.addEventListener('input', () => {
  updateSeekFill(); // Update visual fill while dragging
});

function updateSeekFill() {
  const min = playerSeek.min || 0;
  const max = playerSeek.max || 100;
  const val = playerSeek.value;
  const percentage = (val - min) * 100 / (max - min);

  // Set CSS variable or direct background style for the "Black Fill" effect
  // We use linear-gradient: Black up to X%, Gray after.
  playerSeek.style.backgroundImage = `linear-gradient(to right, black ${percentage}%, #e5e7eb ${percentage}%)`;
}

playerVolume.addEventListener('input', () => {
  ipcRenderer.send('media-command', { action: 'volume', value: parseFloat(playerVolume.value) });
});

fullscreenButton.addEventListener('click', () => {
  ipcRenderer.send('media-command', { action: 'fullscreen' });
});

// Update UI from Video Window status
ipcRenderer.on('media-status', (event, status) => {
  // Relay to Mobile
  if (io && socket) {
    socket.emit('status', {
      type: 'sync-status',
      data: {
        ...status,
        title: playerSongTitle.textContent,
        number: playerSongNumber.textContent
      }
    });
  }

  if (status.type === 'timeupdate') {
    if (!isDraggingSeek) {
      playerSeek.value = (status.currentTime / status.duration) * 100 || 0;
      updateSeekFill(); // Update fill on time update
      currentTimeSpan.textContent = formatTime(status.currentTime);
      totalTimeSpan.textContent = formatTime(status.duration);
    }
  } else if (status.type === 'play') {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    if (mediaControls.style.display === 'none') {
      mediaControls.style.display = 'flex';
    }
  } else if (status.type === 'pause') {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  } else if (status.type === 'ended') {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    playerSeek.value = 0;
    updateSeekFill(); // Reset fill
    currentTimeSpan.textContent = "0:00";
    // mediaControls.style.display = 'none'; // REMOVED auto-hide
  }
});

// IPC for Stop action feedback (Reset UI)
ipcRenderer.on('media-stopped', () => {
  iconPlay.style.display = 'block';
  iconPause.style.display = 'none';
  playerSeek.value = 0;
  updateSeekFill(); // Reset fill
  currentTimeSpan.textContent = "0:00";
  totalTimeSpan.textContent = "0:00";
  updateSongInfo("-");

  // Sync Stop
  if (io && socket) {
    socket.emit('status', {
      type: 'sync-status',
      data: { type: 'stopped' }
    });
  }
});
// ————— Compact Mode Logic —————
const toggleCompactBtn = document.getElementById('toggleCompact');
const iconCollapse = document.getElementById('iconCollapse');
const iconExpand = document.getElementById('iconExpand');

toggleCompactBtn.addEventListener('click', () => {
  const isCompact = mediaControls.classList.toggle('compact');

  if (isCompact) {
    iconCollapse.style.display = 'none';
    iconExpand.style.display = 'block';
    // Adjust footer bottom position if needed, but height transition handles it visually
  } else {
    iconCollapse.style.display = 'block';
    iconExpand.style.display = 'none';
  }
  // Optional: Persist this preference?
  ipcRenderer.invoke('set-store-value', 'playerCompact', isCompact);
});

// Load Compact Preference
(async () => {
  const isCompact = await ipcRenderer.invoke('get-store-value', 'playerCompact');
  if (isCompact) {
    mediaControls.classList.add('compact');
    iconCollapse.style.display = 'none';
    iconExpand.style.display = 'block';
  }
})();
// Socket moved to top


socket.on('connect', () => {
  console.log('Connected to local remote server');
  socket.emit('register', 'desktop');
});

socket.on('command', (data) => {
  console.log('Remote command:', data);
  const { action } = data;

  switch (action) {
    case 'play':
      if (data.file) {
        // Play specific file from Search Result
        selectedFile = data.file;
        if (data.tab) currentTab = data.tab;
        if (data.category) currentCategory = data.category;

        ipcRenderer.invoke('play', {
          file: data.file,
          tab: data.tab,
          category: data.category
        });

        if (data.display) updateSongInfo(data.display);
      } else {
        // Resume if paused
        if (iconPlay.style.display !== 'none') playerPlayPause.click();
      }
      break;
    case 'pause':
      if (iconPlay.style.display === 'none') playerPlayPause.click();
      break;
    case 'playPause':
      playerPlayPause.click();
      break;
    case 'stop':
      playerStop.click();
      break;
    case 'next':
      playerNext.click();
      break;
    case 'prev':
      playerPrev.click();
      break;
    case 'seek':
      if (data.value !== undefined) {
        playerSeek.value = data.value;
        ipcRenderer.send('media-command', { action: 'seek', value: parseFloat(data.value) });
        updateSeekFill();
      }
      break;
    case 'volume':
      if (data.value !== undefined) {
        playerVolume.value = data.value;
        ipcRenderer.send('media-command', { action: 'volume', value: parseFloat(data.value) });
      }
      break;
    case 'search':
      if (data.query) {
        const queryStr = data.query.toString(); // Allow text or number
        // searchInput.value = queryStr; // Sync desktop input? Maybe annoying if typing.
        // Let's NOT sync input if it disrupts, but user might want to see it.
        // Kept it originally.

        // determine sources
        const sources = [];
        if (data.source === 'both') {
          sources.push('previous', 'new');
        } else if (data.source === 'previous') {
          sources.push('previous');
        } else {
          sources.push('new');
        }

        // Use category from mobile (data.category) or fallback to desktop current
        const searchCat = data.category || currentCategory;

        // Perform searches
        Promise.all(sources.map(async (tab) => {
          console.log(`[DEBUG-RENDERER] Invoking search - Query: ${queryStr}, Tab: ${tab}, Cat: ${searchCat}`);
          const items = await ipcRenderer.invoke('search', {
            query: queryStr,
            tab: tab,
            category: searchCat
          });
          console.log(`[DEBUG-RENDERER] Result for ${tab}: ${items.length} items`);
          // Tag items with source
          return items.map(i => ({ ...i, sourceTab: tab, category: searchCat }));
        })).then(results => {
          let finalResults = [];

          if (data.source === 'both' && results.length >= 2) {
            // Interleave: [Prev, New, Prev, New...]
            const prevItems = results.find(r => r.length > 0 && r[0].sourceTab === 'previous') || [];
            const newItems = results.find(r => r.length > 0 && r[0].sourceTab === 'new') || [];

            const maxLen = Math.max(prevItems.length, newItems.length);
            for (let i = 0; i < maxLen; i++) {
              if (i < prevItems.length) finalResults.push(prevItems[i]);
              if (i < newItems.length) finalResults.push(newItems[i]);
            }
          } else {
            finalResults = results.flat();
          }

          // We usually render on Desktop too?
          // renderSearchResults(flatResults); // Optional: update desktop UI too? 
          // If we update desktop UI, we might confuse the user if they look at desktop.
          // But usually remote reflects on desktop. Let's do it if we sync input.
          // But wait, if we render on desktop, we overwrite local state.
          // Let's just send back to mobile for now to be safe, or do both.
          // Original code did renderSearchResults.

          socket.emit('status', {
            type: 'search-results',
            data: finalResults
          });
        });
      }
      break;
    case 'load-media':
      // ... existing logic if any ...
      break;
    case 'get-monitors':
      ipcRenderer.invoke('get-monitors').then(res => {
        // Send full object: { list, selected }
        socket.emit('status', { type: 'monitors-list', data: res });
      });
      break;
    case 'set-monitor':
      if (data.id) {
        ipcRenderer.invoke('set-monitor', data.id).then(async () => {
          // Broadcast confirmation back to all (including the sender, to confirm)
          const res = await ipcRenderer.invoke('get-monitors');
          socket.emit('status', { type: 'monitors-list', data: res });
        });
      }
      break;
    case 'toggle-live':
      ipcRenderer.invoke('toggle-live', data.active);
      break;
    case 'fullscreen':
      ipcRenderer.send('media-command', { action: 'fullscreen' });
      break;
    case 'loop':
      ipcRenderer.send('media-command', { action: 'loop', value: data.value });
      break;
    case 'get-live-state':
      socket.emit('status', {
        type: 'live-state',
        data: { active: liveActive }
      });
      break;
    case 'seek-percent':
      // Fix: Send 'seek' action which video.html understands (value 0-100)
      ipcRenderer.send('media-command', { action: 'seek', value: data.percent });
      break;
  }
});

