const i18next = require('i18next');
const { app } = require('electron');
const { getConfig } = require('../config');
const zhCN = require('./zh-CN.json');
const en = require('./en.json');

let inited = false;

function initI18n() {
  const cfg = getConfig();
  let lang = cfg.general.language;

  if (Array.isArray(lang)) {
    lang = lang.find(item => typeof item === 'string' && item) || lang[0];
  }
  if (typeof lang !== 'string') {
    if (lang && typeof lang.toString === 'function') {
      lang = String(lang);
    } else {
      lang = '';
    }
  }

  if (lang === 'system' || !lang) {
    const locale = (app && typeof app.getLocale === 'function') ? app.getLocale() : process.env.LANG;
    lang = locale || 'en';
  }

  if (typeof lang === 'string') {
    lang = lang.trim();
    if (lang.toLowerCase().startsWith('zh')) {
      lang = 'zh-CN';
    } else if (lang.toLowerCase().startsWith('en')) {
      lang = 'en';
    } else {
      lang = 'en';
    }
  } else {
    lang = 'en';
  }

  try {
    i18next.init({
      lng: lang,
      supportedLngs: ['en', 'zh-CN'],
      fallbackLng: 'en',
      resources: {
        'zh-CN': { translation: zhCN },
        'en': { translation: en }
      }
    });
    inited = true;
  } catch (err) {
    console.error('Failed to init i18n, fallback to en', err);
    i18next.init({
      lng: 'en',
      supportedLngs: ['en', 'zh-CN'],
      fallbackLng: 'en',
      resources: {
        'zh-CN': { translation: zhCN },
        'en': { translation: en }
      }
    });
    inited = true;
  }
}

function t(key) {
  if (!inited) initI18n();
  return i18next.t(key);
}

module.exports = { initI18n, t };