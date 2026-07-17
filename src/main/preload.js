const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('secxAPI', {
  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),

  // 多语言
  t: (key) => ipcRenderer.invoke('i18n:t', key),

  // 安全
  encrypt: (data) => ipcRenderer.invoke('security:encrypt', data),
  decrypt: (data) => ipcRenderer.invoke('security:decrypt', data),

  // 窗口
  openSettings: () => ipcRenderer.invoke('window:openSettings'),
  openPreview: (message) => ipcRenderer.invoke('window:openPreview', message),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // MailTo
  registerMailto: () => ipcRenderer.invoke('mailto:register'),
  unregisterMailto: () => ipcRenderer.invoke('mailto:unregister'),
  isMailtoRegistered: () => ipcRenderer.invoke('mailto:isRegistered'),
  onMailtoData: (callback) => ipcRenderer.on('mailto-data', (_, url) => callback(url)),
  onI18nChanged: (callback) => ipcRenderer.on('i18n:changed', callback),
  onMailPreviewData: (callback) => ipcRenderer.on('mail:preview-data', (_, message) => callback(message)),

  // 邮件操作
  mail: {
    listAccounts: () => ipcRenderer.invoke('mail:listAccounts'),
    addAccount: (acc) => ipcRenderer.invoke('mail:addAccount', acc),
    removeAccount: (id) => ipcRenderer.invoke('mail:removeAccount', id),
    listFolders: (accId) => ipcRenderer.invoke('mail:listFolders', accId),
    listMessages: (accId, folder, page, pageSize) => ipcRenderer.invoke('mail:listMessages', accId, folder, page, pageSize),
    getMessage: (accId, uid, folder) => ipcRenderer.invoke('mail:getMessage', accId, uid, folder),
    sendMail: (accId, mail) => ipcRenderer.invoke('mail:sendMail', accId, mail),
    deleteMessage: (accId, uid) => ipcRenderer.invoke('mail:deleteMessage', accId, uid),
    moveMessage: (accId, uid, dest) => ipcRenderer.invoke('mail:moveMessage', accId, uid, dest),

    // Microsoft 登录
    startMicrosoftLogin: () => ipcRenderer.invoke('mail:microsoft:login'),
    microsoftCallback: (code) => ipcRenderer.invoke('mail:microsoft:callback', code)
  }
});