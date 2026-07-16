// src/renderer/js/settings.js
let config = null;
let pendingConfig = null;
let isMailtoRegistered = false;

async function initSettings() {
  config = await window.secxAPI.getConfig();
  pendingConfig = JSON.parse(JSON.stringify(config));
  isMailtoRegistered = await window.secxAPI.isMailtoRegistered();

  // 填充值
  document.getElementById('settingLanguage').value = config.general.language;
  document.getElementById('settingAutoRefresh').checked = config.general.autoRefresh;
  document.getElementById('settingRefreshInterval').value = config.general.refreshInterval;
  document.getElementById('settingMailPageSize').value = config.general.mailPageSize || 30;
  document.getElementById('settingDevTools').checked = config.general.allowDevTools;
  
  document.getElementById('settingEncryptCred').checked = config.security.encryptCredentials;
  document.getElementById('settingMicrosoftSSL').checked = config.security.microsoftLoginSSL;
  document.getElementById('settingMailJS').checked = config.security.allowMailJavaScript;

  // MailTo 注册状态
  document.getElementById('settingMailto').checked = isMailtoRegistered && config.general.mailtoEnabled;

  // Tab 切换
  document.querySelectorAll('.setting-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.setting-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById('tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.remove('hidden');
    });
  });

  // 绑定变更事件
  document.getElementById('settingLanguage').addEventListener('change', async (e) => {
    pendingConfig.general.language = e.target.value;
    await window.secxAPI.setConfig('general.language', e.target.value);
  });
  document.getElementById('settingAutoRefresh').addEventListener('change', (e) => {
    pendingConfig.general.autoRefresh = e.target.checked;
  });
  document.getElementById('settingRefreshInterval').addEventListener('change', (e) => {
    pendingConfig.general.refreshInterval = parseInt(e.target.value, 10);
  });
  document.getElementById('settingMailPageSize').addEventListener('change', (e) => {
    pendingConfig.general.mailPageSize = parseInt(e.target.value, 10);
  });
  document.getElementById('settingDevTools').addEventListener('change', (e) => {
    pendingConfig.general.allowDevTools = e.target.checked;
  });
  
  document.getElementById('settingEncryptCred').addEventListener('change', (e) => {
    pendingConfig.security.encryptCredentials = e.target.checked;
  });
  document.getElementById('settingMicrosoftSSL').addEventListener('change', (e) => {
    pendingConfig.security.microsoftLoginSSL = e.target.checked;
  });
  document.getElementById('settingMailJS').addEventListener('change', (e) => {
    pendingConfig.security.allowMailJavaScript = e.target.checked;
  });

  document.getElementById('settingMailto').addEventListener('change', (e) => {
    pendingConfig.general.mailtoEnabled = e.target.checked;
  });

  document.getElementById('btnApply').addEventListener('click', saveSettings);
  document.getElementById('btnOk').addEventListener('click', async () => {
    await saveSettings();
    window.close();
  });
  document.getElementById('btnCancel').addEventListener('click', () => window.close());

  // 多语言文本
  await applyI18n();
  window.secxAPI.onI18nChanged(async () => {
    await applyI18n();
  });
}

document.addEventListener('DOMContentLoaded', initSettings);

async function saveSettings() {
  const saveTasks = [
    window.secxAPI.setConfig('general.language', pendingConfig.general.language),
    window.secxAPI.setConfig('general.autoRefresh', pendingConfig.general.autoRefresh),
    window.secxAPI.setConfig('general.refreshInterval', pendingConfig.general.refreshInterval),
    window.secxAPI.setConfig('general.mailPageSize', pendingConfig.general.mailPageSize),
    window.secxAPI.setConfig('general.allowDevTools', pendingConfig.general.allowDevTools),
    window.secxAPI.setConfig('security.encryptCredentials', pendingConfig.security.encryptCredentials),
    window.secxAPI.setConfig('security.microsoftLoginSSL', pendingConfig.security.microsoftLoginSSL),
    window.secxAPI.setConfig('security.allowMailJavaScript', pendingConfig.security.allowMailJavaScript),
    window.secxAPI.setConfig('general.mailtoEnabled', pendingConfig.general.mailtoEnabled)
  ];

  if (pendingConfig.general.mailtoEnabled !== config.general.mailtoEnabled) {
    if (pendingConfig.general.mailtoEnabled) {
      await window.secxAPI.registerMailto();
    } else {
      await window.secxAPI.unregisterMailto();
    }
  }

  await Promise.all(saveTasks);
  config = JSON.parse(JSON.stringify(pendingConfig));
}

async function applyI18n() {
  const elements = document.querySelectorAll('[data-i18n]');
  for (const el of elements) {
    const key = el.getAttribute('data-i18n');
    const fallbackText = el.textContent.trim();
    const translated = await window.secxAPI.t(key);
    el.textContent = translated === key ? fallbackText : translated;
  }
}

function bindSetting(elementId, configKey, valueGetter) {
  document.getElementById(elementId).addEventListener('change', async (e) => {
    const value = valueGetter(e);
    await window.secxAPI.setConfig(configKey, value);
  });
}