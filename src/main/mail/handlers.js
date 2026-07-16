const { ipcMain } = require('electron');
const { getConfig, setConfig } = require('../config');
const { encrypt, decrypt } = require('../security');
const imap = require('./imap');
const smtp = require('./smtp');
const graph = require('./graph');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getAccountById(id) {
  const config = getConfig();
  return config.accounts.find(a => a.id === id);
}

function registerMailHandlers() {
  // 账户管理
  ipcMain.handle('mail:listAccounts', () => {
    const config = getConfig();
    return config.accounts.map(a => ({
      id: a.id,
      email: a.email,
      type: a.type
    }));
  });

  ipcMain.handle('mail:addAccount', async (_, accountData) => {
    const config = getConfig();
    const account = { ...accountData, id: generateId() };
    
    // 加密密码
    if (config.security.encryptCredentials && account.password) {
      account.password = encrypt(account.password);
    }
    
    config.accounts.push(account);
    setConfig('accounts', config.accounts);
    return account.id;
  });

  ipcMain.handle('mail:removeAccount', (_, id) => {
    const config = getConfig();
    config.accounts = config.accounts.filter(a => a.id !== id);
    setConfig('accounts', config.accounts);
    return true;
  });

  // Microsoft 登录
  ipcMain.handle('mail:microsoft:login', async () => {
    const result = await graph.startMicrosoftLogin();
    if (result.success) {
      const config = getConfig();
      const account = {
        ...result.account,
        id: generateId()
      };
      
      // 加密 token
      if (config.security.encryptCredentials) {
        account.accessToken = encrypt(account.accessToken);
        account.refreshToken = encrypt(account.refreshToken);
      }
      
      config.accounts.push(account);
      setConfig('accounts', config.accounts);
      return { success: true, accountId: account.id };
    }
    return result;
  });

  // 文件夹列表
  ipcMain.handle('mail:listFolders', async (_, accountId) => {
    const account = getAccountById(accountId);
    if (!account) throw new Error('账户不存在');
    
    if (account.type === 'graph') {
      // 解密 token
      const acc = { ...account };
      if (getConfig().security.encryptCredentials) {
        acc.accessToken = decrypt(account.accessToken);
        acc.refreshToken = decrypt(account.refreshToken);
      }
      return await graph.listFolders(acc);
    } else {
      return await imap.listFolders(account);
    }
  });

  // 邮件列表
  ipcMain.handle('mail:listMessages', async (_, accountId, folder, page = 1, pageSize = 30) => {
    const account = getAccountById(accountId);
    if (!account) throw new Error('账户不存在');
    
    if (account.type === 'graph') {
      const acc = { ...account };
      if (getConfig().security.encryptCredentials) {
        acc.accessToken = decrypt(account.accessToken);
        acc.refreshToken = decrypt(account.refreshToken);
      }
      return await graph.listMessages(acc, folder, page, pageSize);
    } else {
      return await imap.listMessages(account, folder, page, pageSize);
    }
  });

  // 邮件详情
  ipcMain.handle('mail:getMessage', async (_, accountId, uid, folder) => {
    const account = getAccountById(accountId);
    if (!account) throw new Error('账户不存在');
    
    if (account.type === 'graph') {
      const acc = { ...account };
      if (getConfig().security.encryptCredentials) {
        acc.accessToken = decrypt(account.accessToken);
        acc.refreshToken = decrypt(account.refreshToken);
      }
      return await graph.getMessage(acc, uid);
    } else {
      return await imap.getMessage(account, uid, folder || 'INBOX');
    }
  });

  // 发送邮件
  ipcMain.handle('mail:sendMail', async (_, accountId, mail) => {
    const account = getAccountById(accountId);
    if (!account) throw new Error('账户不存在');
    
    if (account.type === 'graph') {
      const acc = { ...account };
      if (getConfig().security.encryptCredentials) {
        acc.accessToken = decrypt(account.accessToken);
        acc.refreshToken = decrypt(account.refreshToken);
      }
      return await graph.sendMail(acc, mail);
    } else {
      return await smtp.sendMail(account, mail);
    }
  });

  // 删除邮件
  ipcMain.handle('mail:deleteMessage', async (_, accountId, uid, folder) => {
    const account = getAccountById(accountId);
    if (!account) throw new Error('账户不存在');
    
    if (account.type === 'graph') {
      const acc = { ...account };
      if (getConfig().security.encryptCredentials) {
        acc.accessToken = decrypt(account.accessToken);
        acc.refreshToken = decrypt(account.refreshToken);
      }
      return await graph.deleteMessage(acc, uid);
    } else {
      return await imap.deleteMessage(account, uid, folder || 'INBOX');
    }
  });

  // 移动邮件
  ipcMain.handle('mail:moveMessage', async (_, accountId, uid, destination) => {
    const account = getAccountById(accountId);
    if (!account) throw new Error('账户不存在');
    
    if (account.type === 'imap') {
      return await imap.moveMessage(account, uid, destination);
    }
    // Graph 暂未实现移动
    throw new Error('当前账户类型不支持移动邮件');
  });
}

module.exports = { registerMailHandlers };

ipcMain.handle('mail:updateAccount', async (_, id, updates) => {
  const config = getConfig();
  const index = config.accounts.findIndex(a => a.id === id);
  if (index === -1) throw new Error('账户不存在');

  // 密码变更时重新加密
  if (updates.password && config.security.encryptCredentials) {
    updates.password = encrypt(updates.password);
  }

  config.accounts[index] = { ...config.accounts[index], ...updates };
  setConfig('accounts', config.accounts);
  return true;
});