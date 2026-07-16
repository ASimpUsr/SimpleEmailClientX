const Store = require('electron-store');
const { app } = require('electron');

let store = null;

const defaultConfig = {
  general: {
    language: 'system',     // system | zh-CN | en
    autoRefresh: true,
    refreshInterval: 300,   // 秒
    mailPageSize: 30,
    mailtoEnabled: false,
    allowDevTools: false
  },
  security: {
    encryptCredentials: true,
    microsoftLoginSSL: false,
    allowMailJavaScript: false
  },
  accounts: []
};

function initConfig() {
  store = new Store({
    name: 'secx-config',
    defaults: defaultConfig,
    encryptionKey: 'secx-vault' // 仅混淆，真正加密靠 safeStorage
  });
}

function getConfig() {
  if (!store) initConfig();
  return store.store;
}

function setConfig(keyPath, value) {
  if (!store) initConfig();

  if (value === undefined || value === null) {
    store.delete(keyPath);
  } else {
    store.set(keyPath, value);
  }

  // 语言变更通知
  if (keyPath === 'general.language') {
    const { initI18n } = require('./i18n');
    initI18n();
  }
  return true;
}

module.exports = { initConfig, getConfig, setConfig, defaultConfig };