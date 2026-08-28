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
let selectedHymn = null; // { file, tab, category, display }
let selectedFile = null;
let liveActive = false;
let isLooping = false; // New loop state
let selectedResultIndex = -1;
let currentResults = [];

// Projection Preview Elements & State
const projectionPreviewContainer = document.getElementById('projectionPreviewContainer');
const previewVideo = document.getElementById('previewVideo');
const previewWelcome = document.getElementById('previewWelcome');
const btnMinimizePreview = document.getElementById('btnMinimizePreview');
const btnClosePreview = document.getElementById('btnClosePreview');
const iconMinPreview = document.getElementById('iconMinPreview');
const iconMaxPreview = document.getElementById('iconMaxPreview');
const previewHeaderTitle = document.getElementById('previewHeaderTitle');

let isPreviewMinimized = false;
let isPreviewVisible = false;

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

  <div id="optTutorial" class="dropdown-item">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
    Tutorial
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
// Refactored Monitor & Projection Loader
async function openProjectionMenu(trigger) {
  toggleMenu(trigger, settingsMenu);
  if (settingsMenu.classList.contains('active')) {
    // Clear and build menu options
    settingsMenu.innerHTML = '';

    // 1. Vista Previa Toggle Item
    const checkHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const togglePreviewItem = document.createElement('div');
    togglePreviewItem.className = 'dropdown-item';
    togglePreviewItem.style.justifyContent = 'space-between';
    togglePreviewItem.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
        Vista previa en pantalla
      </div>
      <div style="width: 14px; display: flex; align-items: center; justify-content: center;">${isPreviewVisible ? checkHTML : ''}</div>
    `;
    togglePreviewItem.addEventListener('click', () => {
      togglePreviewVisibility();
      settingsMenu.classList.remove('active');
    });
    settingsMenu.appendChild(togglePreviewItem);

    const separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.backgroundColor = '#eee';
    separator.style.margin = '4px 0';
    settingsMenu.appendChild(separator);

    // 2. Monitores Title
    const monitorTitle = document.createElement('div');
    monitorTitle.style.padding = '6px 12px';
    monitorTitle.style.fontSize = '11px';
    monitorTitle.style.fontWeight = 'bold';
    monitorTitle.style.color = '#888';
    monitorTitle.style.textTransform = 'uppercase';
    monitorTitle.textContent = 'MONITORES';
    settingsMenu.appendChild(monitorTitle);

    const monitorList = document.createElement('div');
    monitorList.style.marginTop = '2px';
    settingsMenu.appendChild(monitorList);

    // Load monitors
    try {
      const result = await ipcRenderer.invoke('get-monitors');
      monitorList.innerHTML = '';

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
            updateMonitorPill();
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

  // Option: Tutorial
  if (e.target.id === 'optTutorial' || e.target.closest('#optTutorial')) {
    configMenu.classList.remove('active');
    openTutorialModal(0);
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

// Toast Notification Helper (Modified to support action)
function showToast(message, type = 'info', action = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Icon based on type
  let icon = '';
  if (type === 'success') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" color="#4ade80"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  else if (type === 'error') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" color="#f87171"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  else icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" color="#60a5fa"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  toast.innerHTML = `
    ${icon}
    <div style="flex-grow:1;">${message}</div>
  `;

  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.style.marginLeft = '12px';
    btn.style.padding = '4px 10px';
    btn.style.borderRadius = '6px';
    btn.style.border = '1px solid rgba(255,255,255,0.2)';
    btn.style.background = 'rgba(255,255,255,0.1)';
    btn.style.color = 'white';
    btn.style.fontSize = '11px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = 'bold';
    btn.onclick = action.callback;
    toast.appendChild(btn);
  }

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
  showToast("Actualización lista.", 'success', {
    label: "REINICIAR AHORA",
    callback: () => ipcRenderer.send('restart-app')
  });
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

// ————— Interactive Spotlight Guided Tour Logic —————
const tutorialSpotlightOverlay = document.getElementById('tutorialSpotlightOverlay');
const spotlightHoleRect = document.getElementById('spotlightHoleRect');
const spotlightRing = document.getElementById('spotlightRing');
const spotlightCard = document.getElementById('spotlightCard');
const spotlightStepBadge = document.getElementById('spotlightStepBadge');
const spotlightTitle = document.getElementById('spotlightTitle');
const spotlightBody = document.getElementById('spotlightBody');
const spotlightDots = document.getElementById('spotlightDots');
const btnSpotlightPrev = document.getElementById('btnSpotlightPrev');
const btnSpotlightNext = document.getElementById('btnSpotlightNext');
const btnExitSpotlight = document.getElementById('btnExitSpotlight');

let currentSpotlightStep = 0;
let spotlightTypeTimer = null;

const spotlightSteps = [
  {
    badge: 'PASO 1 DE 8 • BÚSQUEDA Y ATAJOS',
    title: 'Navegación con Teclado',
    targetId: 'searchBoxWrapper',
    body: `
      <div style="display: flex; flex-direction: column; gap: 7px;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e293b;">
          <span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 5px; font-weight: 800; font-size: 11px;">↑ / ↓</span>
          <span><strong>Flechas:</strong> Muévete entre los resultados de búsqueda.</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e293b;">
          <span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 5px; font-weight: 800; font-size: 11px;">ENTER</span>
          <span><strong>Doble Enter:</strong> 1º elige, 2º proyecta de inmediato.</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e293b;">
          <span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 5px; font-weight: 800; font-size: 11px;">ESC</span>
          <span><strong>Escape:</strong> Borra la búsqueda al instante.</span>
        </div>
      </div>
    `
  },
  {
    badge: 'PASO 2 DE 8 • SERVIDOR MÓVIL',
    title: 'Control desde el Celular',
    targetId: 'btnCopyIP',
    body: `
      <div style="display: flex; flex-direction: column; gap: 7px; font-size: 13px; color: #334155;">
        <div>Ingresa a esta <strong>dirección IP</strong> desde el navegador de tu celular (conectado al mismo Wi-Fi).</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 7px 10px; border-radius: 8px; font-size: 12px; color: #1e293b;">
          📱 <strong>Control Remoto:</strong> Busca y reproduce himnos directamente desde tu teléfono.
        </div>
      </div>
    `
  },
  {
    badge: 'PASO 3 DE 8 • PANTALLAS',
    title: 'Elegir Monitor de Proyección',
    targetId: 'monitorSelectorSection',
    body: `
      <div style="display: flex; flex-direction: column; gap: 7px; font-size: 13px; color: #334155;">
        <div>Selecciona en qué pantalla o proyector se verá la letra:</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 7px 10px; border-radius: 8px; font-size: 12px; color: #1e293b; line-height: 1.4;">
          🖥️ <strong>Monitores (1, 2...):</strong> Haz clic en el número de monitor deseado para enviar la proyección automáticamente a esa pantalla.
        </div>
      </div>
    `
  },
  {
    badge: 'PASO 4 DE 8 • PROYECCIÓN',
    title: 'Botón "En Curso"',
    targetId: 'liveButton',
    body: `
      <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #334155;">
        <div>Abre o cierra la ventana de proyección:</div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></span>
          <span><strong>Rojo:</strong> Proyección activa y visible en la iglesia.</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #9ca3af;"></span>
          <span><strong>Gris:</strong> Proyección cerrada (haz clic para abrirla).</span>
        </div>
      </div>
    `
  },
  {
    badge: 'PASO 5 DE 8 • REPRODUCCIÓN',
    title: 'Controles de Video',
    targetId: 'playerPlayPause',
    targetGroup: 'playback',
    body: `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; color: #334155;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 6px;"><strong>▶ / ⏸</strong> Play y Pausa</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 6px;"><strong>⏮ / ⏭</strong> Anterior / Siguiente</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 6px;"><strong>🔁</strong> Repetir en bucle</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 6px;"><strong>⏹</strong> Detener video</div>
      </div>
    `
  },
  {
    badge: 'PASO 6 DE 8 • PANTALLA COMPLETA',
    title: 'Maximizar la Proyección',
    targetId: 'fullscreenButton',
    body: `
      <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #334155;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 8px; font-size: 12.5px; color: #0f172a; line-height: 1.45;">
          <strong>⛶ Pantalla Completa:</strong> Maximiza o restaura la proyección con 1 solo clic desde tu barra, sin necesidad de mover el ratón a la pantalla de proyección.
        </div>
      </div>
    `
  },
  {
    badge: 'PASO 7 DE 8 • VISTA PREVIA',
    title: 'Mini Monitor en Vivo',
    targetId: 'btnOpenMiniPreview',
    fallbackTargetId: 'projectionPreviewContainer',
    body: `
      <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #334155;">
        <div>Monitorea en tiempo real lo que se proyecta en la iglesia:</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 7px 10px; border-radius: 8px; font-size: 12px; color: #1e293b; line-height: 1.4;">
          • Haz clic en <strong>"Vista Previa"</strong> para abrir el monitor flotante.<br>
          • Puedes arrastrarlo para moverlo, cambiar su tamaño o minimizarlo.
        </div>
      </div>
    `
  },
  {
    badge: 'PASO 8 DE 8 • ¡LISTO!',
    title: '¡Todo Listo!',
    targetId: 'btnConfig',
    body: `
      <div style="font-size: 13.5px; color: #1e293b; padding: 2px 0;">
        Puedes volver a ver este tutorial en cualquier momento desde <strong style="color: #0f172a;">Opciones > Tutorial</strong>.
      </div>
    `
  }
];

function openTutorialModal(step = 0) {
  currentSpotlightStep = step;
  if (tutorialSpotlightOverlay) tutorialSpotlightOverlay.style.display = 'block';
  renderSpotlightStep(currentSpotlightStep);
}

function closeTutorialModal() {
  if (tutorialSpotlightOverlay) tutorialSpotlightOverlay.style.display = 'none';
  if (spotlightTypeTimer) clearTimeout(spotlightTypeTimer);
  ipcRenderer.invoke('set-store-value', 'hasSeenTutorial_v2', true);

  if (searchInput && searchInput.value) {
    searchInput.value = '';
    clearSearchResults();
    updateClearButtonVisibility();
  }
}

function renderSpotlightStep(step) {
  if (step < 0) step = 0;
  if (step >= spotlightSteps.length) step = spotlightSteps.length - 1;
  currentSpotlightStep = step;

  const data = spotlightSteps[step];
  if (spotlightStepBadge) spotlightStepBadge.textContent = data.badge;
  if (spotlightTitle) spotlightTitle.textContent = data.title;
  if (spotlightBody) spotlightBody.innerHTML = data.body;

  // Render Dots
  if (spotlightDots) {
    spotlightDots.innerHTML = '';
    spotlightSteps.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.style.cssText = `width: ${idx === step ? '18px' : '6px'}; height: 6px; border-radius: 9999px; background: ${idx === step ? '#2563eb' : '#cbd5e1'}; transition: all 0.25s ease; cursor: pointer;`;
      dot.onclick = () => renderSpotlightStep(idx);
      spotlightDots.appendChild(dot);
    });
  }

  // Buttons State
  if (btnSpotlightPrev) {
    btnSpotlightPrev.style.display = step === 0 ? 'none' : 'block';
  }
  if (btnSpotlightNext) {
    if (step === spotlightSteps.length - 1) {
      btnSpotlightNext.textContent = '¡Comenzar!';
      btnSpotlightNext.style.background = '#16a34a';
    } else {
      btnSpotlightNext.textContent = 'Siguiente';
      btnSpotlightNext.style.background = '#000000';
    }
  }

  // Handle Target & Positioning
  let targetEl = null;
  if (data.targetId) {
    targetEl = document.getElementById(data.targetId);
    if (!isElementVisible(targetEl) && data.fallbackTargetId) {
      const fallback = document.getElementById(data.fallbackTargetId);
      if (isElementVisible(fallback)) {
        targetEl = fallback;
      }
    }
  }

  // If group: e.g. center playback controls
  if (data.targetGroup === 'playback') {
    const prev = document.getElementById('playerPrev');
    const stop = document.getElementById('playerStop');
    if (prev && stop) {
      targetEl = prev.parentElement || targetEl;
    }
  }

  // Vista Previa: Ensure target is btnOpenMiniPreview if closed, or container if open
  if (data.targetId === 'btnOpenMiniPreview') {
    const btnPreview = document.getElementById('btnOpenMiniPreview');
    const container = document.getElementById('projectionPreviewContainer');
    if (isElementVisible(container)) {
      targetEl = container;
    } else if (btnPreview) {
      targetEl = btnPreview;
    }
  }

  // Keep search clean on step 0
  if (step === 0 && searchInput) {
    searchInput.value = '';
    clearSearchResults();
    updateClearButtonVisibility();
  }

  positionSpotlightOnElement(targetEl);
}

function isElementVisible(el) {
  if (!el) return false;
  if (el.classList && el.classList.contains('hidden')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function positionSpotlightOnElement(targetEl) {
  if (!spotlightHoleRect || !spotlightRing || !spotlightCard) return;

  if (!isElementVisible(targetEl)) {
    // Center card, hide hole
    spotlightHoleRect.setAttribute('width', '0');
    spotlightHoleRect.setAttribute('height', '0');
    spotlightRing.style.opacity = '0';

    spotlightCard.style.top = '50%';
    spotlightCard.style.left = '50%';
    spotlightCard.style.transform = 'translate(-50%, -50%)';
    return;
  }

  spotlightCard.style.transform = 'none';

  let rect = targetEl.getBoundingClientRect();

  const pad = 6;
  const x = Math.max(4, rect.left - pad);
  const y = Math.max(4, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  // Set SVG hole
  spotlightHoleRect.setAttribute('x', x.toString());
  spotlightHoleRect.setAttribute('y', y.toString());
  spotlightHoleRect.setAttribute('width', w.toString());
  spotlightHoleRect.setAttribute('height', h.toString());
  spotlightHoleRect.setAttribute('rx', '14');

  // Set Ring
  spotlightRing.style.opacity = '1';
  spotlightRing.style.left = `${x}px`;
  spotlightRing.style.top = `${y}px`;
  spotlightRing.style.width = `${w}px`;
  spotlightRing.style.height = `${h}px`;

  // Position Card
  const cardW = 380;
  const cardH = spotlightCard.offsetHeight || 190;
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  let cardLeft = Math.max(16, Math.min(x + w / 2 - cardW / 2, winW - cardW - 16));
  let cardTop = y + h + 14;

  // If in top bar / header (near top), position below and align
  if (y < 90) {
    cardTop = y + h + 14;
    if (x > winW / 2) {
      cardLeft = Math.max(16, Math.min(x + w - cardW, winW - cardW - 16));
    } else {
      cardLeft = Math.max(16, Math.min(x, winW - cardW - 16));
    }
  } else if (cardTop + cardH > winH - 20) {
    // If near bottom, place above
    cardTop = Math.max(16, y - cardH - 14);
  }

  spotlightCard.style.left = `${cardLeft}px`;
  spotlightCard.style.top = `${cardTop}px`;
}

if (btnSpotlightPrev) {
  btnSpotlightPrev.addEventListener('click', () => {
    if (currentSpotlightStep > 0) renderSpotlightStep(currentSpotlightStep - 1);
  });
}

if (btnSpotlightNext) {
  btnSpotlightNext.addEventListener('click', () => {
    if (currentSpotlightStep < spotlightSteps.length - 1) {
      renderSpotlightStep(currentSpotlightStep + 1);
    } else {
      closeTutorialModal();
    }
  });
}

if (btnExitSpotlight) {
  btnExitSpotlight.addEventListener('click', closeTutorialModal);
}

// Window resize repositioning
window.addEventListener('resize', () => {
  if (tutorialSpotlightOverlay && tutorialSpotlightOverlay.style.display === 'block') {
    renderSpotlightStep(currentSpotlightStep);
  }
});

// Keyboard navigation support for spotlight tour
window.addEventListener('keydown', (e) => {
  if (tutorialSpotlightOverlay && tutorialSpotlightOverlay.style.display === 'block') {
    if (e.key === 'Escape' && currentSpotlightStep > 0) {
      closeTutorialModal();
    } else if (e.key === 'ArrowRight' && currentSpotlightStep > 0) {
      if (currentSpotlightStep < spotlightSteps.length - 1) {
        renderSpotlightStep(currentSpotlightStep + 1);
      }
    } else if (e.key === 'ArrowLeft' && currentSpotlightStep > 0) {
      renderSpotlightStep(currentSpotlightStep - 1);
    }
  }
});

// Auto-launch tutorial on first update/run
(async () => {
  try {
    const hasSeen = await ipcRenderer.invoke('get-store-value', 'hasSeenTutorial_v2');
    if (!hasSeen) {
      setTimeout(() => {
        openTutorialModal(0);
      }, 700);
    }
  } catch (e) {}
})();

// Old menu logic removed
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

// ————— Live Projection Preview (Direct Window Capture & Draggable) —————
let previewStream = null;
let isDraggingPreview = false;
let dragStartX = 0, dragStartY = 0, initialLeft = 0, initialTop = 0;

const btnOpenMiniPreview = document.getElementById('btnOpenMiniPreview');

function updatePreviewContainerUI() {
  if (!projectionPreviewContainer) return;
  if (isPreviewVisible) {
    projectionPreviewContainer.classList.remove('hidden');
    if (btnOpenMiniPreview) btnOpenMiniPreview.style.display = 'none';
    startWindowCapture();
  } else {
    projectionPreviewContainer.classList.add('hidden');
    if (btnOpenMiniPreview) btnOpenMiniPreview.style.display = 'flex';
    stopWindowCapture();
  }

  if (isPreviewMinimized) {
    projectionPreviewContainer.classList.add('minimized');
    if (iconMinPreview) iconMinPreview.style.display = 'none';
    if (iconMaxPreview) iconMaxPreview.style.display = 'block';
  } else {
    projectionPreviewContainer.classList.remove('minimized');
    if (iconMinPreview) iconMinPreview.style.display = 'block';
    if (iconMaxPreview) iconMaxPreview.style.display = 'none';
  }
}

function togglePreviewMinimize() {
  isPreviewMinimized = !isPreviewMinimized;
  updatePreviewContainerUI();
  ipcRenderer.invoke('set-store-value', 'previewMinimized', isPreviewMinimized);
}

function togglePreviewVisibility(visible) {
  isPreviewVisible = (visible !== undefined) ? visible : !isPreviewVisible;
  updatePreviewContainerUI();
  ipcRenderer.invoke('set-store-value', 'previewVisible', isPreviewVisible);
}

if (btnMinimizePreview) btnMinimizePreview.addEventListener('click', togglePreviewMinimize);
if (previewHeaderTitle) previewHeaderTitle.addEventListener('dblclick', togglePreviewMinimize);
if (btnClosePreview) btnClosePreview.addEventListener('click', () => togglePreviewVisibility(false));
if (btnOpenMiniPreview) btnOpenMiniPreview.addEventListener('click', () => togglePreviewVisibility(true));

// Draggable & Resizable functionality
let isResizingPreview = false;
let resizeDirection = null; // 'right' or 'left'
let resizeStartX = 0, resizeStartWidth = 0, resizeInitialLeft = 0;

const previewHeader = document.getElementById('previewHeader');
if (previewHeader) {
  previewHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDraggingPreview = true;
    previewHeader.style.cursor = 'grabbing';

    const rect = projectionPreviewContainer.getBoundingClientRect();
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialLeft = rect.left;
    initialTop = rect.top;

    projectionPreviewContainer.style.right = 'auto';
    projectionPreviewContainer.style.bottom = 'auto';
    projectionPreviewContainer.style.left = `${initialLeft}px`;
    projectionPreviewContainer.style.top = `${initialTop}px`;
  });
}

// Corner Resize Handles
const previewResizeHandleRight = document.getElementById('previewResizeHandleRight');
const previewResizeHandleLeft = document.getElementById('previewResizeHandleLeft');

if (previewResizeHandleRight) {
  previewResizeHandleRight.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingPreview = true;
    resizeDirection = 'right';
    resizeStartX = e.clientX;
    resizeStartWidth = projectionPreviewContainer.offsetWidth;
    const rect = projectionPreviewContainer.getBoundingClientRect();
    projectionPreviewContainer.style.right = 'auto';
    projectionPreviewContainer.style.bottom = 'auto';
    projectionPreviewContainer.style.left = `${rect.left}px`;
    projectionPreviewContainer.style.top = `${rect.top}px`;
  });
}

if (previewResizeHandleLeft) {
  previewResizeHandleLeft.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingPreview = true;
    resizeDirection = 'left';
    resizeStartX = e.clientX;
    resizeStartWidth = projectionPreviewContainer.offsetWidth;
    const rect = projectionPreviewContainer.getBoundingClientRect();
    resizeInitialLeft = rect.left;
    projectionPreviewContainer.style.right = 'auto';
    projectionPreviewContainer.style.bottom = 'auto';
    projectionPreviewContainer.style.left = `${rect.left}px`;
    projectionPreviewContainer.style.top = `${rect.top}px`;
  });
}

window.addEventListener('mousemove', (e) => {
  if (isResizingPreview && projectionPreviewContainer) {
    const deltaX = e.clientX - resizeStartX;
    const minW = 200;
    const maxW = Math.min(window.innerWidth - 30, 900);

    if (resizeDirection === 'right') {
      const newWidth = Math.max(minW, Math.min(resizeStartWidth + deltaX, maxW));
      projectionPreviewContainer.style.width = `${newWidth}px`;
    } else if (resizeDirection === 'left') {
      const newWidth = Math.max(minW, Math.min(resizeStartWidth - deltaX, maxW));
      const adjustedLeft = resizeInitialLeft - (newWidth - resizeStartWidth);
      if (adjustedLeft >= 10) {
        projectionPreviewContainer.style.left = `${adjustedLeft}px`;
      }
      projectionPreviewContainer.style.width = `${newWidth}px`;
    }
    return;
  }

  if (!isDraggingPreview || !projectionPreviewContainer) return;
  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;

  let newLeft = initialLeft + deltaX;
  let newTop = initialTop + deltaY;

  const containerWidth = projectionPreviewContainer.offsetWidth;
  const containerHeight = projectionPreviewContainer.offsetHeight;
  const maxLeft = window.innerWidth - containerWidth - 10;
  const maxTop = window.innerHeight - containerHeight - 60;

  newLeft = Math.max(10, Math.min(newLeft, maxLeft));
  newTop = Math.max(45, Math.min(newTop, maxTop));

  projectionPreviewContainer.style.left = `${newLeft}px`;
  projectionPreviewContainer.style.top = `${newTop}px`;
});

window.addEventListener('mouseup', () => {
  if (isResizingPreview && projectionPreviewContainer) {
    isResizingPreview = false;
    resizeDirection = null;
    ipcRenderer.invoke('set-store-value', 'previewWidth', projectionPreviewContainer.offsetWidth);
    ipcRenderer.invoke('set-store-value', 'previewPosition', {
      top: projectionPreviewContainer.style.top,
      left: projectionPreviewContainer.style.left
    });
  }

  if (isDraggingPreview && projectionPreviewContainer) {
    isDraggingPreview = false;
    if (previewHeader) previewHeader.style.cursor = 'grab';
    ipcRenderer.invoke('set-store-value', 'previewPosition', {
      top: projectionPreviewContainer.style.top,
      left: projectionPreviewContainer.style.left
    });
  }
});

// Auto-clamp preview container position within viewport bounds
function clampPreviewPosition() {
  if (!projectionPreviewContainer) return;

  const containerWidth = projectionPreviewContainer.offsetWidth || 320;
  const containerHeight = projectionPreviewContainer.offsetHeight || 240;

  const minLeft = 10;
  const minTop = 45;
  const maxLeft = Math.max(minLeft, window.innerWidth - containerWidth - 10);
  const maxTop = Math.max(minTop, window.innerHeight - containerHeight - 60);

  if (containerWidth > window.innerWidth - 20) {
    const newWidth = Math.max(200, window.innerWidth - 30);
    projectionPreviewContainer.style.width = `${newWidth}px`;
  }

  const rect = projectionPreviewContainer.getBoundingClientRect();
  let currentLeft = rect.left;
  let currentTop = rect.top;

  let clamped = false;
  if (currentLeft > maxLeft) {
    currentLeft = maxLeft;
    clamped = true;
  }
  if (currentLeft < minLeft) {
    currentLeft = minLeft;
    clamped = true;
  }
  if (currentTop > maxTop) {
    currentTop = maxTop;
    clamped = true;
  }
  if (currentTop < minTop) {
    currentTop = minTop;
    clamped = true;
  }

  projectionPreviewContainer.style.right = 'auto';
  projectionPreviewContainer.style.bottom = 'auto';
  projectionPreviewContainer.style.left = `${currentLeft}px`;
  projectionPreviewContainer.style.top = `${currentTop}px`;
}

// Keep preview container in-bounds on window resize
window.addEventListener('resize', () => {
  clampPreviewPosition();
});

// Load and restore preview state on startup
(async () => {
  try {
    const savedPos = await ipcRenderer.invoke('get-store-value', 'previewPosition');
    const savedWidth = await ipcRenderer.invoke('get-store-value', 'previewWidth');
    const savedMin = await ipcRenderer.invoke('get-store-value', 'previewMinimized');
    const savedVis = await ipcRenderer.invoke('get-store-value', 'previewVisible');

    if (savedVis !== undefined && savedVis !== null) isPreviewVisible = savedVis;
    if (savedMin !== undefined && savedMin !== null) isPreviewMinimized = savedMin;
    if (savedWidth && projectionPreviewContainer) {
      projectionPreviewContainer.style.width = `${savedWidth}px`;
    }
    if (savedPos && savedPos.left && savedPos.top && projectionPreviewContainer) {
      projectionPreviewContainer.style.right = 'auto';
      projectionPreviewContainer.style.bottom = 'auto';
      projectionPreviewContainer.style.left = savedPos.left;
      projectionPreviewContainer.style.top = savedPos.top;
    }
    clampPreviewPosition();
    updatePreviewContainerUI();
  } catch (e) {
    console.warn("Could not load preview settings:", e);
  }
})();

// Direct window stream capture
async function startWindowCapture() {
  if (!isPreviewVisible) return;
  try {
    const sourceId = await ipcRenderer.invoke('get-video-source-id');
    if (!sourceId) {
      stopWindowCapture();
      return;
    }

    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
      previewStream = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 320,
          maxWidth: 1280,
          minHeight: 180,
          maxHeight: 720,
          maxFrameRate: 30
        }
      }
    });

    previewStream = stream;
    if (previewVideo) {
      previewVideo.srcObject = stream;
      previewVideo.style.display = 'block';
      if (previewWelcome) previewWelcome.style.display = 'none';
      previewVideo.onloadedmetadata = () => {
        if (previewVideo.videoWidth && previewVideo.videoHeight) {
          const wrapper = document.getElementById('previewContentWrapper');
          if (wrapper) {
            wrapper.style.aspectRatio = `${previewVideo.videoWidth} / ${previewVideo.videoHeight}`;
          }
        }
      };
      const p = previewVideo.play();
      if (p !== undefined) p.catch(() => {});
    }
  } catch (err) {
    console.warn("Could not capture projection window stream:", err);
    stopWindowCapture();
  }
}

function stopWindowCapture() {
  if (previewStream) {
    previewStream.getTracks().forEach(t => t.stop());
    previewStream = null;
  }
  if (previewVideo) {
    previewVideo.srcObject = null;
    previewVideo.style.display = 'none';
  }
  if (previewWelcome) {
    previewWelcome.style.display = 'flex';
  }
}

if (previewWelcome) {
  previewWelcome.addEventListener('click', () => {
    ipcRenderer.invoke('toggle-live', true);
  });
}

// ————— Hymn Selection & Playback Helpers —————
function selectHymn(item) {
  if (!item) return;
  selectedHymn = {
    file: item.file,
    tab: item.tab || currentTab,
    category: item.category || currentCategory,
    display: item.display
  };
  selectedFile = item.file;
  searchInput.value = item.display;
  updateSongInfo(item.display);
  clearSearchResults();
  updateClearButtonVisibility();
}

async function playSelectedHymn() {
  if (!selectedHymn && !selectedFile) {
    const q = searchInput.value.trim();
    if (q) {
      const items = await ipcRenderer.invoke('search', {
        query: q,
        tab: currentTab,
        category: currentCategory
      });
      if (items && items.length > 0) {
        selectHymn(items[0]);
      }
    }
  }

  const hymnToPlay = selectedHymn || (selectedFile ? {
    file: selectedFile,
    tab: currentTab,
    category: currentCategory,
    display: searchInput.value || selectedFile
  } : null);

  if (!hymnToPlay || !hymnToPlay.file) {
    showToast("Por favor selecciona un himno primero", 'info');
    return;
  }

  try {
    const res = await ipcRenderer.invoke('play', {
      file: hymnToPlay.file,
      tab: hymnToPlay.tab || currentTab,
      category: hymnToPlay.category || currentCategory
    });

    if (res && res.success) {
      updateSongInfo(hymnToPlay.display || searchInput.value || hymnToPlay.file);
    } else if (res && !res.success) {
      showToast(res.error || "No se pudo reproducir el himno", 'error');
    }
  } catch (err) {
    console.error("Error al reproducir himno:", err);
    showToast(`Error al reproducir: ${err.message}`, 'error');
  }
}

function updateSelectionVisuals() {
  const resultItems = resultsDiv.querySelectorAll('.search-result-item');
  resultItems.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.style.backgroundColor = 'black';
      item.style.color = 'white';
      item.style.paddingLeft = '1.5rem';
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.style.backgroundColor = 'transparent';
      item.style.color = '#1f2937';
      item.style.paddingLeft = '1.0rem';
    }
  });

  if (typeof currentSpotlightStep !== 'undefined' && currentSpotlightStep === 0 && typeof positionSpotlightOnElement === 'function' && typeof searchInput !== 'undefined') {
    positionSpotlightOnElement(searchInput);
  }
}

// Listener for Search Input Navigation & Enter (2-step flow)
searchInput.addEventListener('keydown', (e) => {
  const isResultsOpen = resultsDiv.classList.contains('active-results') && currentResults.length > 0;
  const resultItems = resultsDiv.querySelectorAll('.search-result-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (isResultsOpen && resultItems.length > 0) {
      selectedResultIndex = (selectedResultIndex + 1) % resultItems.length;
      updateSelectionVisuals();
    } else if (!isResultsOpen && searchInput.value.trim()) {
      doSearch();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (isResultsOpen && resultItems.length > 0) {
      selectedResultIndex = (selectedResultIndex - 1 + resultItems.length) % resultItems.length;
      updateSelectionVisuals();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (isResultsOpen) {
      // 1er ENTER: Seleccionar / Elegir el himno de los resultados
      const indexToSelect = selectedResultIndex >= 0 ? selectedResultIndex : 0;
      if (currentResults[indexToSelect]) {
        selectHymn(currentResults[indexToSelect]);
        // El himno queda seleccionado y la lista cerrada.
        // El próximo Enter reproducirá directamente.
      }
    } else {
      // 2do ENTER: Reproducir el himno seleccionado (o el texto actual)
      playSelectedHymn();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    searchInput.value = '';
    selectedHymn = null;
    selectedFile = null;
    clearSearchResults();
    updateClearButtonVisibility();
    searchInput.focus();
  }
});

// Global Escape shortcut to easily clear search from anywhere
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    const activeDropdown = document.querySelector('.dropdown-menu.active');
    if (activeDropdown) {
      activeDropdown.classList.remove('active');
      return;
    }

    if (categoryOptions && categoryOptions.classList.contains('active-menu')) {
      categoryOptions.classList.remove('active-menu');
      return;
    }

    if (searchInput.value || resultsDiv.classList.contains('active-results') || selectedHymn) {
      searchInput.value = '';
      selectedHymn = null;
      selectedFile = null;
      clearSearchResults();
      updateClearButtonVisibility();
      searchInput.focus();
    }
  }
});

ipcRenderer.on('video-window-opened', () => {
  setLiveButtonState(true);
  startWindowCapture();
});
ipcRenderer.on('video-window-closed', () => {
  setLiveButtonState(false);
  stopWindowCapture();
});

playButton.addEventListener('click', () => {
  playSelectedHymn();
});

// Init UI: Load persistent tab & preview settings
(async () => {
  const savedTab = await ipcRenderer.invoke('get-store-value', 'lastTab');
  if (savedTab === 'new' || savedTab === 'previous') {
    currentTab = savedTab;
  }
  updateTabVisuals();

  // Set initial display of categorySelect based on loaded tab
  categorySelect.style.display = currentTab === 'previous' ? 'none' : 'block';

  // Load persistent preview settings, size & position
  const savedVis = await ipcRenderer.invoke('get-store-value', 'previewVisible');
  if (savedVis !== undefined && savedVis !== null) isPreviewVisible = savedVis;
  const savedMin = await ipcRenderer.invoke('get-store-value', 'previewMinimized');
  if (savedMin !== undefined && savedMin !== null) isPreviewMinimized = savedMin;

  const savedWidth = await ipcRenderer.invoke('get-store-value', 'previewWidth');
  if (savedWidth && typeof savedWidth === 'number' && savedWidth >= 200 && projectionPreviewContainer) {
    projectionPreviewContainer.style.width = `${savedWidth}px`;
  }

  const savedPos = await ipcRenderer.invoke('get-store-value', 'previewPosition');
  if (savedPos && savedPos.top && savedPos.left && projectionPreviewContainer) {
    projectionPreviewContainer.style.right = 'auto';
    projectionPreviewContainer.style.bottom = 'auto';
    projectionPreviewContainer.style.left = savedPos.left;
    projectionPreviewContainer.style.top = savedPos.top;
  }

  updatePreviewContainerUI();
  startWindowCapture();
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

  // Update input value and selectedHymn based on current key
  const keyMatch = searchInput.value.match(/^(\d{1,4})/);
  if (keyMatch) {
    const key = keyMatch[1];
    const items = await ipcRenderer.invoke('search', {
      query: key,
      tab: currentTab,
      category: currentCategory
    });
    if (items && items.length > 0) {
      selectHymn(items[0]);
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

  // Update input value and selectedHymn based on current key
  const keyMatch = searchInput.value.match(/^(\d{1,4})/);
  if (keyMatch) {
    const key = keyMatch[1];
    const items = await ipcRenderer.invoke('search', {
      query: key,
      tab: currentTab,
      category: currentCategory
    });
    if (items && items.length > 0) {
      selectHymn(items[0]);
    }
  }
  clearSearchResults();
});

// selector categoría
const categoryButtonText = document.getElementById('categoryButtonText');

function toggleCategoryMenu() {
  const isActive = categoryOptions.classList.contains('active-menu');
  if (isActive) {
    categoryOptions.classList.remove('active-menu');
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
    const option = e.target.closest('[data-value]');
    if (option) {
      e.stopPropagation();
      currentCategory = option.dataset.value;

      if (categoryButtonText) {
        categoryButtonText.textContent = currentCategory.toUpperCase();
      }

      categoryOptions.classList.remove('active-menu');
      clearSearchResults();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (categorySelect && !categorySelect.contains(e.target)) {
      categoryOptions.classList.remove('active-menu');
    }
  });
}

// limpiar resultados
function clearSearchResults() {
  resultsDiv.innerHTML = '';
  resultsDiv.classList.remove('active-results'); // Hide via animation class
  selectedResultIndex = -1;
  currentResults = [];
}

// muestra resultados
function renderSearchResults(items) {
  resultsDiv.innerHTML = '';
  selectedResultIndex = -1;
  currentResults = items || [];

  if (!items || !items.length) {
    resultsDiv.classList.remove('active-results');
    return;
  }

  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.textContent = item.display;
    div.dataset.index = index;

    div.style.padding = '0.6rem 1.0rem';
    div.style.cursor = 'pointer';
    div.style.color = '#1f2937';
    div.style.fontSize = '1rem';
    div.style.fontWeight = '500';
    div.style.borderBottom = '1px solid #f3f4f6';
    div.style.transition = 'all 0.1s ease';

    div.addEventListener('mouseenter', () => {
      selectedResultIndex = index;
      updateSelectionVisuals();
    });

    div.addEventListener('mouseleave', () => {
      div.style.backgroundColor = 'transparent';
      div.style.color = '#1f2937';
      div.style.paddingLeft = '1.0rem';
    });

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      selectHymn(item);
      searchInput.focus();
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
    selectedHymn = null;
    selectedFile = null;
    return;
  }

  // If input matches already selected hymn display, don't reopen dropdown
  if (selectedHymn && selectedHymn.display === q) {
    return;
  }

  const items = await ipcRenderer.invoke('search', {
    query: q,
    tab: currentTab,
    category: currentCategory
  });
  renderSearchResults(items);
}

searchInput.addEventListener('input', () => {
  updateClearButtonVisibility();
  doSearch();
});
searchInput.addEventListener('focus', () => {
  updateClearButtonVisibility();
  if (searchInput.value.trim() && (!selectedHymn || selectedHymn.display !== searchInput.value.trim())) {
    doSearch();
  }
});

function updateClearButtonVisibility() {
  if (clearSearchButton) {
    clearSearchButton.style.display = searchInput.value.trim() ? 'block' : 'none';
    if (searchInput.value.trim()) {
      clearSearchButton.classList.remove('hidden');
    } else {
      clearSearchButton.classList.add('hidden');
    }
  }
}

clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  selectedHymn = null;
  selectedFile = null;
  clearSearchResults();
  updateClearButtonVisibility();
  searchInput.focus();
});

// click fuera cierra dropdowns
document.addEventListener('click', event => {
  if (categorySelect && !categorySelect.contains(event.target))
    categoryOptions.classList.add('hidden');
  if (resultsDiv && !resultsDiv.contains(event.target) && event.target !== searchInput)
    clearSearchResults();
});

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

  const match = items.find(item => item.display.startsWith(targetStr)) || items[0];

  if (match) {
    selectHymn(match);
    playSelectedHymn();
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
  if (!displayString) {
    playerSongTitle.textContent = '-';
    playerSongNumber.textContent = '';
    currentHymnNumber = null;
    return;
  }

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

  if ((selectedHymn || selectedFile) && !isPlaying) {
    if (playerSeek.value == 0 && currentTimeSpan.textContent === "0:00") {
      playSelectedHymn();
      return;
    }
  }

  ipcRenderer.send('media-command', { action: isPlaying ? 'pause' : 'play' });
});

playerSeek.addEventListener('mousedown', () => isDraggingSeek = true);
playerSeek.addEventListener('mouseup', () => {
  isDraggingSeek = false;
  const targetPercent = parseFloat(playerSeek.value);
  ipcRenderer.send('media-command', { action: 'seek', value: targetPercent });
  if (previewVideo && previewVideo.duration) {
    previewVideo.currentTime = (targetPercent / 100) * previewVideo.duration;
  }
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
  } else {
    iconCollapse.style.display = 'block';
    iconExpand.style.display = 'none';
  }

  if (projectionPreviewContainer) {
    projectionPreviewContainer.style.bottom = isCompact ? '74px' : '104px';
  }

  ipcRenderer.invoke('set-store-value', 'playerCompact', isCompact);
});

// Load Compact Preference
(async () => {
  const isCompact = await ipcRenderer.invoke('get-store-value', 'playerCompact');
  if (isCompact) {
    mediaControls.classList.add('compact');
    iconCollapse.style.display = 'none';
    iconExpand.style.display = 'block';
    if (projectionPreviewContainer) {
      projectionPreviewContainer.style.bottom = '74px';
    }
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
        selectHymn({
          file: data.file,
          tab: data.tab || currentTab,
          category: data.category || currentCategory,
          display: data.display || data.file
        });
        playSelectedHymn();
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

