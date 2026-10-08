// 조작 화면(웹 페이지)에서 쓸 수 있는 앱 기능만 골라서 열어 준다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tufApp', {
  info: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  setOpenAtLogin: (on) => ipcRenderer.invoke('app:open-at-login', on),
  setMini: (on) => ipcRenderer.invoke('win:mini', on),
  onUpdate: (cb) => ipcRenderer.on('update-status', (_e, status) => cb(status)),
});
