const { app, BrowserWindow, ipcMain, protocol, shell } = require('electron');
const path = require('path');
const { initConfig, getConfig, setConfig } = require('./config');
const { initI18n, t } = require('./i18n');
const { encrypt, decrypt } = require('./security');
const { registerMailHandlers } = require('./mail/handlers');

let mainWindow = null;
let mailtoWindow = null;
let settingsWindow = null;
let previewWindow = null;
let refreshTimer = null;

function startAutoRefresh() {
  stopAutoRefresh();
  const cfg = getConfig();
  if (!cfg.general.autoRefresh || !cfg.accounts.length) return;

  const interval = Math.max(60, cfg.general.refreshInterval) * 1000;
  refreshTimer = setInterval(() => {
    if (mainWindow) {
      mainWindow.webContents.send('mail:auto-refresh');
    }
  }, interval);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 在 app.whenReady 最后启动
app.whenReady().then(() => {
  // ... 原有初始化
  startAutoRefresh();
});

// 配置变更时重启定时器
ipcMain.handle('config:set', (_, key, value) => {
  setConfig(key, value);
  if (key.startsWith('general.autoRefresh') || key.startsWith('general.refreshInterval')) {
    startAutoRefresh();
  }
  if (key === 'general.language') {
    const { initI18n } = require('./i18n');
    initI18n();
    // 通知所有窗口刷新语言
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('i18n:changed');
    });
  }
  return true;
});


// 单实例锁，处理 mailto 协议
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const mailtoArg = commandLine.find(arg => arg.startsWith('mailto:'));
    if (mailtoArg) openMailtoWindow(mailtoArg);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 在 createMainWindow 之前补充
function getWindowBounds() {
  const cfg = getConfig();
  return cfg.windowBounds || { width: 1100, height: 720 };
}

function saveWindowBounds() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  setConfig('windowBounds', bounds);
}

function createMainWindow() {
  const bounds = getWindowBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 记忆窗口状态
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);
  mainWindow.on('close', saveWindowBounds);

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopAutoRefresh();
  });
}

function openMailtoWindow(mailtoUrl) {
  if (!getConfig().general.mailtoEnabled) return;

  if (mailtoWindow) {
    mailtoWindow.focus();
    mailtoWindow.webContents.send('mailto-data', mailtoUrl);
    return;
  }

  mailtoWindow = new BrowserWindow({
    width: 560,
    height: 480,
    resizable: true,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mailtoWindow.setMenuBarVisibility(false);
  mailtoWindow.loadFile(path.join(__dirname, '../renderer/mailto.html'));
  mailtoWindow.webContents.on('did-finish-load', () => {
    mailtoWindow.webContents.send('mailto-data', mailtoUrl);
  });

  mailtoWindow.on('closed', () => { mailtoWindow = null; });
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 640,
    height: 520,
    resizable: false,
    parent: mainWindow,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function openPreviewWindow(message) {
  if (!message) return;

  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.focus();
    previewWindow.webContents.send('mail:preview-data', message);
    return;
  }

  previewWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 520,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  previewWindow.setMenuBarVisibility(false);
  previewWindow.loadFile(path.join(__dirname, '../renderer/preview.html'));

  previewWindow.once('ready-to-show', () => {
    previewWindow.show();
  });

  previewWindow.webContents.on('did-finish-load', () => {
    if (!previewWindow.isDestroyed()) {
      previewWindow.webContents.send('mail:preview-data', message);
    }
  });

  previewWindow.on('closed', () => {
    previewWindow = null;
  });
}

// === IPC 注册 ===
ipcMain.handle('config:get', () => getConfig());
ipcMain.handle('i18n:t', (_, key) => t(key));
ipcMain.handle('security:encrypt', (_, data) => encrypt(data));
ipcMain.handle('security:decrypt', (_, data) => decrypt(data));
ipcMain.handle('window:openSettings', () => openSettingsWindow());
ipcMain.handle('window:openPreview', (_, message) => openPreviewWindow(message));
ipcMain.handle('app:getVersion', () => app.getVersion());

// 注册 mailto 协议
ipcMain.handle('mailto:register', () => {
  if (process.platform === 'win32') {
    app.setAsDefaultProtocolClient('mailto');
  }
  return true;
});
ipcMain.handle('mailto:unregister', () => {
  if (process.platform === 'win32') {
    app.removeAsDefaultProtocolClient('mailto');
  }
  return true;
});
ipcMain.handle('mailto:isRegistered', () => {
  return app.isDefaultProtocolClient('mailto');
});

app.whenReady().then(() => {
  initConfig();
  initI18n();
  registerMailHandlers();

  // 处理启动时的 mailto 参数
  const mailtoArg = process.argv.find(arg => arg.startsWith('mailto:'));
  if (mailtoArg && getConfig().general.mailtoEnabled) {
    openMailtoWindow(mailtoArg);
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 外链用系统浏览器打开
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});