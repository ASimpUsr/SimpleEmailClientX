const { Client } = require('@microsoft/microsoft-graph-client');
const { shell, BrowserWindow } = require('electron');
const { getConfig } = require('../config');

const CLIENT_ID = '7fb58687-b9e5-49e4-835b-30205891e533'; // 用户需自行在 Azure 注册应用
const REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
const SCOPES = ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite', 'offline_access'];

async function startMicrosoftLogin() {
  const config = getConfig();
  
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
    `&response_mode=query`;

  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 480,
      height: 640,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.setMenuBarVisibility(false);
    authWindow.loadURL(authUrl);

    if (!config.security.microsoftLoginSSL) {
      authWindow.webContents.session.setCertificateVerifyProc((_, callback) => callback(0));
    }

    let completed = false;

    // 用 will-navigate 捕获重定向，比 will-redirect 更可靠
    authWindow.webContents.on('will-navigate', (_, url) => {
      if (url.startsWith(REDIRECT_URI)) {
        completed = true;
        const code = new URL(url).searchParams.get('code');
        authWindow.close();
        if (code) {
          exchangeToken(code).then(resolve).catch(reject);
        } else {
          reject(new Error('授权失败：未获取到授权码'));
        }
      }
    });

    // 兜底：地址栏变化也检测
    authWindow.webContents.on('did-navigate', (_, url) => {
      if (url.startsWith(REDIRECT_URI) && !completed) {
        completed = true;
        const code = new URL(url).searchParams.get('code');
        authWindow.close();
        if (code) {
          exchangeToken(code).then(resolve).catch(reject);
        } else {
          reject(new Error('授权失败'));
        }
      }
    });

    authWindow.on('closed', () => {
      if (!completed) {
        reject(new Error('用户取消登录'));
      }
    });
  });
}

async function exchangeToken(code) {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES.join(' '),
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error_description);

  // 获取用户信息
  const client = Client.init({
    authProvider: (done) => done(null, data.access_token)
  });

  const user = await client.api('/me').get();
  
  return {
    success: true,
    account: {
      type: 'graph',
      email: user.mail || user.userPrincipalName,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000
    }
  };
}

async function ensureToken(account) {
  if (Date.now() < account.expiresAt) return account.accessToken;
  
  // 刷新 token
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES.join(' '),
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  if (data.error) throw new Error('Token refresh failed');
  
  account.accessToken = data.access_token;
  account.refreshToken = data.refresh_token;
  account.expiresAt = Date.now() + data.expires_in * 1000;
  
  // 保存更新后的账户
  return data.access_token;
}

function createClient(account) {
  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await ensureToken(account);
        done(null, token);
      } catch (e) {
        done(e, null);
      }
    }
  });
}

async function listFolders(account) {
  const client = createClient(account);
  const result = await client.api('/me/mailFolders').get();
  return result.value.map(f => ({
    name: f.displayName,
    path: f.id
  }));
}

async function listMessages(account, folderId, page = 1, pageSize = 30) {
  const client = createClient(account);
  const offset = Math.max(0, (page - 1) * pageSize);
  const query = client
    .api(`/me/mailFolders/${folderId}/messages`)
    .orderby('receivedDateTime desc')
    .top(pageSize);

  if (offset > 0) {
    query.skip(offset);
  }

  const result = await query.get();
  
  return result.value.map(m => ({
    uid: m.id,
    subject: m.subject,
    from: m.from?.emailAddress?.address || '',
    date: new Date(m.receivedDateTime).toLocaleString()
  }));
}

async function getMessage(account, messageId) {
  const client = createClient(account);
  const m = await client.api(`/me/messages/${messageId}`).get();
  
  return {
    uid: m.id,
    subject: m.subject,
    from: m.from?.emailAddress?.address || '',
    date: new Date(m.receivedDateTime).toLocaleString(),
    html: m.body.contentType === 'html' ? m.body.content : '',
    text: m.body.contentType === 'text' ? m.body.content : ''
  };
}

async function sendMail(account, mail) {
  const client = createClient(account);
  const message = {
    message: {
      subject: mail.subject,
      body: {
        contentType: 'text',
        content: mail.body
      },
      toRecipients: [
        { emailAddress: { address: mail.to } }
      ]
    },
    saveToSentItems: true
  };
  await client.api('/me/sendMail').post(message);
  return true;
}

async function deleteMessage(account, messageId) {
  const client = createClient(account);
  await client.api(`/me/messages/${messageId}`).delete();
  return true;
}

module.exports = {
  startMicrosoftLogin,
  listFolders,
  listMessages,
  getMessage,
  sendMail,
  deleteMessage
};