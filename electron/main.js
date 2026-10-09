// TUF Scoreboard 메인 프로세스
// - 앱이 켜지면 내장 송출 서버도 켜지고, 앱이 꺼지면 서버도 꺼진다 (docs/PLAN.md 1-1)
// - 창 X 버튼은 트레이로 숨기기, 실제 종료는 트레이 메뉴에서 확인 후
// - GitHub Releases 기반 자동 업데이트 (electron-updater)
const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { startServer } = require('./server');

const SRC_DIR = path.join(__dirname, '..', 'src');
const ICON = path.join(SRC_DIR, 'assets', 'icon.png');
const START_HIDDEN = process.argv.includes('--hidden');
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

let win = null;
let tray = null;
let server = null;
let quitting = false;
let normalBounds = null;
let updateStatus = { state: 'idle' };

if (!app.requestSingleInstanceLock()) {
  // 이미 실행 중이면 두 번째 실행은 기존 창만 띄우고 끝낸다 (포트 충돌 방지)
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(boot);
}

async function boot() {
  app.setAppUserModelId('com.tuf.scoreboard');
  try {
    server = await startServer({ dataDir: app.getPath('userData'), staticDir: SRC_DIR });
  } catch (err) {
    dialog.showErrorBox('TUF Scoreboard', `송출 서버를 시작하지 못했습니다.\n7777~7786 포트를 다른 프로그램이 쓰고 있는지 확인하세요.\n\n${err.message}`);
    app.exit(1);
    return;
  }
  createWindow();
  createTray();
  setupUpdater();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 300,
    show: false,
    title: 'TUF Scoreboard',
    icon: ICON,
    backgroundColor: '#0a0d13',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://127.0.0.1:${server.port}/control`);
  win.once('ready-to-show', () => {
    if (!START_HIDDEN) win.show();
  });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip(`TUF Scoreboard · 송출 중 (127.0.0.1:${server.port})`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '조작패널 열기', click: showWindow },
      { type: 'separator' },
      { label: '종료', click: confirmQuit },
    ])
  );
  tray.on('click', showWindow);
}

async function confirmQuit() {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['종료', '취소'],
    defaultId: 1,
    cancelId: 1,
    title: 'TUF Scoreboard 종료',
    message: '종료하면 방송 화면의 스코어보드가 사라집니다.',
    detail: '방송 중이라면 [취소]를 누르고 창만 닫아 두세요. 창을 닫아도 트레이에서 계속 송출됩니다.',
  });
  if (response === 0) {
    quitting = true;
    app.quit();
  }
}

app.on('before-quit', () => {
  quitting = true;
  if (server) server.close();
});

/* ---------- 자동 업데이트 ---------- */
function sendUpdate(status) {
  updateStatus = status;
  if (win && !win.isDestroyed()) win.webContents.send('update-status', status);
}

function checkForUpdates() {
  if (!app.isPackaged) {
    sendUpdate({ state: 'dev' });
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => sendUpdate({ state: 'error', message: String(err.message || err) }));
}

function setupUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdate({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'latest' }));
  autoUpdater.on('download-progress', (p) =>
    sendUpdate({ state: 'downloading', version: updateStatus.version, percent: Math.round(p.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => sendUpdate({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => sendUpdate({ state: 'error', message: String((err && err.message) || err) }));
  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_INTERVAL_MS);
}

/* ---------- 조작 화면과 통신 ---------- */
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  port: server.port,
  update: updateStatus,
  packaged: app.isPackaged,
  openAtLogin: app.getLoginItemSettings().openAtLogin,
}));

ipcMain.handle('update:check', () => {
  checkForUpdates();
  return true;
});

ipcMain.handle('update:install', () => {
  if (updateStatus.state !== 'ready') return false;
  quitting = true;
  if (server) server.flush();
  // 설치 화면 없이 조용히 덮어쓰고 바로 다시 실행 (BJ 입장에서는 재시작만 한 것처럼 보임)
  autoUpdater.quitAndInstall(true, true);
  return true;
});

ipcMain.handle('app:open-at-login', (_e, on) => {
  app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] });
  return app.getLoginItemSettings().openAtLogin;
});

// 미니 컨트롤러: 작은 창 + 항상 위
ipcMain.handle('win:mini', (_e, on) => {
  if (!win) return false;
  if (on) {
    if (!normalBounds) normalBounds = win.getBounds();
    win.setAlwaysOnTop(true, 'floating');
    win.setSize(480, 340);
  } else {
    win.setAlwaysOnTop(false);
    if (normalBounds) win.setBounds(normalBounds);
    normalBounds = null;
  }
  return on;
});
