let currentAccountId = null;
let currentFolder = 'INBOX';
let currentMessages = [];
let currentPage = 1;
let hasMore = true;
let currentPageSize = 50;
let pageCache = new Map();
let knownMaxPage = 1;
let isLoadingPage = false;
let previewWindow = null;
let selectedMessage = null;

// --- 自定义右键菜单实现 ---
function createContextMenu() {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.display = 'none';
  document.body.appendChild(menu);
  document.addEventListener('click', () => { menu.style.display = 'none'; });
  return menu;
}

const appContextMenu = createContextMenu();

async function openExternalLink(url) {
  if (!url) return;
  await window.secxAPI.openExternal(url);
}

async function copyToClipboard(text) {
  if (!text) return;
  await window.secxAPI.clipboardWriteText(text);
}

async function pasteFromClipboardIntoActive() {
  const txt = await window.secxAPI.clipboardReadText();
  const el = document.activeElement;
  if (!el) return;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const v = el.value || '';
    el.value = v.slice(0, start) + txt + v.slice(end);
    el.selectionStart = el.selectionEnd = start + txt.length;
    el.focus();
  } else if (el.isContentEditable) {
    document.execCommand('insertText', false, txt);
  }
}

function showContextMenuAt(menu, x, y, items) {
  menu.innerHTML = '';
  items.forEach(it => {
    const div = document.createElement('div');
    div.className = 'item' + (it.disabled ? ' disabled' : '');
    div.textContent = it.label;
    if (!it.disabled) div.addEventListener('click', () => { it.click(); menu.style.display = 'none'; });
    menu.appendChild(div);
  });
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
}

document.addEventListener('contextmenu', async (e) => {
  // ignore if inside modal context that has its own menu
  const target = e.target;
  const anchor = target.closest && target.closest('a');
  const hasSelection = String(window.getSelection()).trim().length > 0;
  const canPaste = true; // assume paste allowed, will check activeElement later
  const items = [];
  if (anchor && anchor.href) {
    items.push({ label: '在浏览器中打开', click: () => openExternalLink(anchor.href) });
    items.push({ label: '复制链接', click: () => copyToClipboard(anchor.href) });
  }
  items.push({ label: '复制', disabled: !hasSelection, click: async () => { const s = String(window.getSelection()); await copyToClipboard(s); } });
  items.push({ label: '粘贴', disabled: false, click: pasteFromClipboardIntoActive });
  items.push({ label: '全选', click: () => document.execCommand('selectAll') });

  e.preventDefault();
  showContextMenuAt(appContextMenu, e.clientX, e.clientY, items);
});


// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  const config = await window.secxAPI.getConfig();
  currentPageSize = config.general.mailPageSize || 50;
  await applyI18n();
  await loadAccounts();
  bindEvents();
  window.secxAPI.onI18nChanged(() => applyI18n());
});

async function applyI18n() {
  const elements = document.querySelectorAll('[data-i18n]');
  for (const el of elements) {
    const key = el.getAttribute('data-i18n');
    const fallbackText = el.textContent.trim();
    const translated = await window.secxAPI.t(key);
    el.textContent = translated === key ? fallbackText : translated;
  }

  const titleElements = document.querySelectorAll('[data-i18n-title]');
  for (const el of titleElements) {
    const key = el.getAttribute('data-i18n-title');
    const fallbackTitle = el.getAttribute('title') || '';
    const translated = await window.secxAPI.t(key);
    el.setAttribute('title', translated === key ? fallbackTitle : translated);
  }

  document.title = await window.secxAPI.t('appName');
  document.getElementById('appTitle').textContent = await window.secxAPI.t('appName');
}

function bindEvents() {
  // 账户
  document.getElementById('btnAddAccount').addEventListener('click', () => {
    document.getElementById('accountModal').classList.remove('hidden');
  });

  // 账户 Tab 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById('tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.remove('hidden');
    });
  });

  // Microsoft 登录
  document.getElementById('btnMicrosoftLogin').addEventListener('click', async () => {
    try {
      const result = await window.secxAPI.mail.startMicrosoftLogin();
      if (result.success) {
        await loadAccounts();
        document.getElementById('accountModal').classList.add('hidden');
      }
    } catch (e) {
      alert('登录失败：' + e.message);
    }
  });

  // 自定义账户保存
  document.getElementById('btnSaveCustom').addEventListener('click', async () => {
    const account = {
      type: 'imap',
      email: document.getElementById('inputEmail').value.trim(),
      password: document.getElementById('inputPassword').value,
      imap: {
        host: document.getElementById('inputImapServer').value.trim(),
        port: parseInt(document.getElementById('inputImapPort').value)
      },
      smtp: {
        host: document.getElementById('inputSmtpServer').value.trim(),
        port: parseInt(document.getElementById('inputSmtpPort').value)
      }
    };
    await window.secxAPI.mail.addAccount(account);
    await loadAccounts();
    document.getElementById('accountModal').classList.add('hidden');
  });

  // 刷新
  document.getElementById('btnRefresh').addEventListener('click', loadMessages);

  // 写邮件
  document.getElementById('btnCompose').addEventListener('click', () => {
    document.getElementById('composeModal').classList.remove('hidden');
  });

  // 发送邮件
  document.getElementById('btnSendMail').addEventListener('click', async () => {
    if (!currentAccountId) { alert('请先选择账户'); return; }
    const mail = {
      to: document.getElementById('composeTo').value,
      subject: document.getElementById('composeSubject').value,
      body: document.getElementById('composeBody').value
    };
    try {
      await window.secxAPI.mail.sendMail(currentAccountId, mail);
      alert('发送成功');
      document.getElementById('composeModal').classList.add('hidden');
    } catch (e) {
      alert('发送失败：' + e.message);
    }
  });

  document.getElementById('btnCancelSend').addEventListener('click', () => {
    document.getElementById('composeModal').classList.add('hidden');
  });

  // 删除邮件
  document.getElementById('btnDelete').addEventListener('click', async () => {
    const selected = document.querySelector('.mail-item.active');
    if (!selected) return;
    const uid = selected.dataset.uid;
    if (!confirm('确定删除这封邮件？')) return;
    try {
      await window.secxAPI.mail.deleteMessage(currentAccountId, uid);
      await loadMessages();
      document.getElementById('mailContent').innerHTML = '';
    } catch (e) {
      alert('删除失败：' + e.message);
    }
  });

  // 移动邮件
  document.getElementById('btnMove').addEventListener('click', async () => {
    const selected = document.querySelector('.mail-item.active');
    if (!selected) { alert('请先选择邮件'); return; }
    try {
      const folders = await window.secxAPI.mail.listFolders(currentAccountId);
      const select = document.getElementById('moveFolderSelect');
      select.innerHTML = '';
      folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.path;
        opt.textContent = f.name;
        select.appendChild(opt);
      });
      document.getElementById('moveModal').classList.remove('hidden');
    } catch (e) {
      alert('无法加载文件夹：' + e.message);
    }
  });

  document.getElementById('btnCancelMove').addEventListener('click', () => {
    document.getElementById('moveModal').classList.add('hidden');
  });

  document.getElementById('btnConfirmMove').addEventListener('click', async () => {
    const selected = document.querySelector('.mail-item.active');
    if (!selected) return;
    const uid = selected.dataset.uid;
    const dest = document.getElementById('moveFolderSelect').value;
    try {
      await window.secxAPI.mail.moveMessage(currentAccountId, uid, dest);
      document.getElementById('moveModal').classList.add('hidden');
      await loadMessages();
      document.getElementById('mailContent').innerHTML = '';
    } catch (e) {
      alert('移动失败：' + e.message);
    }
  });

  // 设置
  document.getElementById('btnSettings').addEventListener('click', () => {
    window.secxAPI.openSettings();
  });

  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  });
  document.getElementById('btnNextPage').addEventListener('click', () => {
    if (hasMore || currentPage < knownMaxPage) goToPage(currentPage + 1);
  });

  // 关于
  document.getElementById('btnAbout').addEventListener('click', async () => {
    document.getElementById('aboutVersion').textContent = await window.secxAPI.getAppVersion();
    document.getElementById('aboutModal').classList.remove('hidden');
  });
  document.getElementById('btnCloseAbout').addEventListener('click', () => {
    document.getElementById('aboutModal').classList.add('hidden');
  });
}

async function loadAccounts() {
  const accounts = await window.secxAPI.mail.listAccounts();
  const list = document.getElementById('accountList');
  list.innerHTML = '';
  
  accounts.forEach(acc => {
    const li = document.createElement('li');
    li.textContent = acc.email;
    li.dataset.id = acc.id;
    if (acc.id === currentAccountId) li.classList.add('active');
    li.addEventListener('click', () => selectAccount(acc.id));
    list.appendChild(li);
  });

  if (accounts.length > 0 && !currentAccountId) {
    selectAccount(accounts[0].id);
  }
}

// 在 loadAccounts 函数后补充
function bindAccountContextMenu() {
  document.querySelectorAll('#accountList li').forEach(li => {
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const id = li.dataset.id;
      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.style.position = 'fixed';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.innerHTML = `
        <div class="menu-item" data-action="edit">编辑账户</div>
        <div class="menu-item danger" data-action="delete">删除账户</div>
      `;
      document.body.appendChild(menu);

      menu.querySelector('[data-action="edit"]').onclick = () => {
        editAccount(id);
        menu.remove();
      };
      menu.querySelector('[data-action="delete"]').onclick = () => {
        if (confirm('确定删除该账户？本地缓存将一并清除')) {
          window.secxAPI.mail.removeAccount(id);
          currentAccountId = null;
          loadAccounts();
        }
        menu.remove();
      };

      document.addEventListener('click', () => menu.remove(), { once: true });
    });
  });
}

async function selectAccount(accountId) {
  currentAccountId = accountId;
  document.querySelectorAll('#accountList li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === accountId);
  });
  await loadFolders();
  await loadMessages();
}

async function loadFolders() {
  const folders = await window.secxAPI.mail.listFolders(currentAccountId);
  const tree = document.getElementById('folderTree');
  tree.innerHTML = '';
  
  folders.forEach(folder => {
    const li = document.createElement('li');
    li.textContent = folder.name;
    li.dataset.path = folder.path;
    if (folder.path === currentFolder) li.classList.add('active');
    li.addEventListener('click', () => {
      currentFolder = folder.path;
      document.querySelectorAll('#folderTree li').forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      loadMessages();
    });
    tree.appendChild(li);
  });
}

async function loadMessages() {
  if (!currentAccountId) return;
  currentPage = 1;
  currentMessages = [];
  hasMore = true;
  pageCache.clear();
  knownMaxPage = 1;

  const list = document.getElementById('mailList');
  list.innerHTML = `<div style="padding:20px;text-align:center;color:#888;">${await window.secxAPI.t('common.loading')}</div>`;
  renderPagination();

  await goToPage(1);
}

async function goToPage(pageNumber) {
  if (pageNumber < 1 || isLoadingPage) return;
  if (pageNumber > 1 && !hasMore && pageNumber > knownMaxPage) return;

  isLoadingPage = true;
  const list = document.getElementById('mailList');
  list.innerHTML = `<div style="padding:20px;text-align:center;color:#888;">${await window.secxAPI.t('common.loading')}</div>`;
  renderPagination();

  try {
    const cachedMessages = pageCache.get(pageNumber);
    if (cachedMessages) {
      currentPage = pageNumber;
      currentMessages = cachedMessages;
      renderMessages(cachedMessages);
      renderPagination();
      return;
    }

    const result = await window.secxAPI.mail.listMessages(currentAccountId, currentFolder, pageNumber, currentPageSize);
    const messages = result.messages || result;
    pageCache.set(pageNumber, messages);
    currentPage = pageNumber;
    currentMessages = messages;

    if (messages.length === 0) {
      hasMore = false;
      knownMaxPage = Math.max(1, pageNumber - 1);
    } else if (messages.length < currentPageSize) {
      hasMore = false;
      knownMaxPage = Math.max(knownMaxPage, pageNumber);
    } else {
      hasMore = true;
      knownMaxPage = Math.max(knownMaxPage, pageNumber);
    }

    renderMessages(messages);
  } catch (e) {
    list.innerHTML = `<div style="padding:20px;color:#d13438;">加载失败：${e.message}</div>`;
  } finally {
    isLoadingPage = false;
    renderPagination();
  }
}

async function renderMessages(messages) {
  const list = document.getElementById('mailList');
  list.innerHTML = '';

  if (!messages.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:#888;">${await window.secxAPI.t('common.noMessages')}</div>`;
    return;
  }

  const noSenderText = await window.secxAPI.t('common.noSender');
  const noSubjectText = await window.secxAPI.t('common.noSubject');

  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'mail-item';
    div.dataset.uid = msg.uid;
    div.innerHTML = `
      <div class="from">${msg.from || noSenderText}</div>
      <div class="subject">${msg.subject || noSubjectText}</div>
      <div class="date">${msg.date || ''}</div>
    `;
    div.addEventListener('click', () => {
      document.querySelectorAll('.mail-item').forEach(m => m.classList.remove('active'));
      div.classList.add('active');
      selectedMessage = msg;
      loadMessageDetail(msg.uid);
    });

    div.addEventListener('dblclick', async () => {
      const detail = await window.secxAPI.mail.getMessage(currentAccountId, msg.uid, currentFolder);
      if (!detail) {
        alert('无法获取邮件详情');
        return;
      }
      window.secxAPI.openPreview(detail);
    });
    list.appendChild(div);
  });
}

function renderPagination() {
  const paginationBar = document.getElementById('paginationBar');
  const paginationNumbers = document.getElementById('paginationNumbers');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  if (!paginationBar || !paginationNumbers || !prevBtn || !nextBtn) return;

  const totalPages = Math.max(1, knownMaxPage);
  if (totalPages <= 1 && !hasMore) {
    paginationBar.style.display = 'none';
    return;
  }

  paginationBar.style.display = 'flex';
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = !hasMore && currentPage >= totalPages;

  paginationNumbers.innerHTML = '';
  const pages = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis-start');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('ellipsis-end');
    pages.push(totalPages);
  }

  pages.forEach(page => {
    if (page === 'ellipsis-start' || page === 'ellipsis-end') {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.textContent = '…';
      paginationNumbers.appendChild(ellipsis);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'pagination-number';
    if (page === currentPage) btn.classList.add('active');
    btn.textContent = page;
    btn.addEventListener('click', () => goToPage(page));
    paginationNumbers.appendChild(btn);
  });
}

async function loadMessageDetail(uid) {
  try {
    const msg = await window.secxAPI.mail.getMessage(currentAccountId, uid, currentFolder);
    document.getElementById('mailSubject').textContent = msg.subject || '';
    document.getElementById('mailFrom').textContent = msg.from || '';
    document.getElementById('mailDate').textContent = msg.date || '';
    
    const contentEl = document.getElementById('mailContent');
    const config = await window.secxAPI.getConfig();

    // 附件列表
    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.length > 0) {
      attachmentsHtml = '<div class="attachments"><strong>附件：</strong><ul>';
      msg.attachments.forEach(att => {
        attachmentsHtml += `<li>${att.filename} (${formatSize(att.size)})</li>`;
      });
      attachmentsHtml += '</ul></div>';
    }

    const iframe = document.createElement('iframe');
    iframe.sandbox = config.security.allowMailJavaScript ? 'allow-same-origin' : '';
    if (!config.general.allowDevTools) {
      iframe.addEventListener('contextmenu', e => e.preventDefault());
    }

    const body = msg.html || msg.text || '<p>无内容</p>';
    const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><base target="_blank"><style>body{font-family:sans-serif;margin:0;padding:16px;word-wrap:break-word;} img{max-width:100%;}</style></head><body>${body}</body></html>`;
    iframe.srcdoc = doc;
    contentEl.innerHTML = attachmentsHtml;
    contentEl.appendChild(iframe);
    // 为 iframe 内部内容绑定右键菜单（仅在 srcdoc 同源时可用）
    iframe.addEventListener('load', () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          const anchor = ev.target.closest ? ev.target.closest('a') : null;
          const items = [];
          if (anchor && anchor.href) {
            items.push({ label: '在浏览器中打开', click: () => openExternalLink(anchor.href) });
            items.push({ label: '复制链接', click: () => copyToClipboard(anchor.href) });
          }
          const hasSelection = String(doc.getSelection()).trim().length > 0;
          items.push({ label: '复制', disabled: !hasSelection, click: async () => { const s = String(doc.getSelection()); await copyToClipboard(s); } });
          items.push({ label: '全选', click: () => { const win = iframe.contentWindow; win.document.execCommand('selectAll'); } });
          // 计算页面位置
          const rect = iframe.getBoundingClientRect();
          const x = rect.left + ev.clientX;
          const y = rect.top + ev.clientY;
          showContextMenuAt(appContextMenu, x, y, items);
        });
      } catch (e) {
        // 可能跨域或不支持，忽略
      }
    });
  } catch (e) {
    document.getElementById('mailContent').innerHTML = `<div style="padding:20px;color:#d13438;">无法预览邮件：${e.message}</div>`;
  }
}

function openPreviewWindow(message) {
  if (!message) return;
  window.openPreview(message);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}