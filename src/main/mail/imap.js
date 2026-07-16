const { ImapFlow } = require('imapflow');
const { decrypt } = require('../security');
const { getConfig } = require('../config');

// 网易邮箱域名列表
const NETEASE_DOMAINS = ['163.com', '126.com', 'yeah.net', 'netease.com', 'vip.163.com'];

function isNeteaseEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return NETEASE_DOMAINS.includes(domain);
}

function createImapClient(account) {
  const lock = await client.getMailboxLock(folder);
  const password = config.security.encryptCredentials ? decrypt(account.password) : account.password;
  
  const options = {
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.port === 993,
    auth: {
      user: account.email,
      pass: password
    },
    logger: false
  };

  // 网易邮箱必须发送客户端 ID，否则拦截登录
  if (isNeteaseEmail(account.email)) {
    options.id = {
      name: 'SimpleEmailClientX',
      version: '1.0.0',
      vendor: 'ASimpUsr'
    };
  }

  return new ImapFlow(options);
}

async function listFolders(account) {
  const client = createImapClient(account);
  try {
    await client.connect();
    const tree = await client.listTree();
    const folders = [];
    
    function traverse(node, pathPrefix = '') {
      if (node.path) {
        folders.push({
          name: node.name,
          path: node.path,
          delimiter: node.delimiter
        });
      }
      if (node.folders) {
        node.folders.forEach(child => traverse(child, node.path));
      }
    }
    traverse(tree);
    return folders;
  } finally {
    await client.close();
  }
}

async function listMessages(account, folder, page = 1, pageSize = 30) {
  const client = createImapClient(account);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const total = client.mailbox.exists;
      const start = Math.max(1, total - (page * pageSize) + 1);
      const end = total - ((page - 1) * pageSize);
      
      if (start > end) return [];
      
      const messages = [];
      for await (const msg of client.fetch(`${start}:${end}`, {
        envelope: true,
        uid: true,
        internalDate: true
      })) {
        messages.push({
          uid: msg.uid.toString(),
          subject: msg.envelope.subject,
          from: msg.envelope.from?.[0]?.address || '',
          date: msg.internalDate?.toLocaleString() || ''
        });
      }
      return messages.reverse();
    } finally {
      lock.release();
    }
  } finally {
    await client.close();
  }
}

const { simpleParser } = require('mailparser');

// 替换 getMessage 函数
async function getMessage(account, uid, folder = 'INBOX') {
  const client = createImapClient(account);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const { content } = await client.download(uid);
      const parsed = await simpleParser(content);
      
      return {
        uid: uid,
        subject: parsed.subject || '',
        from: parsed.from?.text || '',
        date: parsed.date?.toLocaleString() || '',
        html: parsed.html || '',
        text: parsed.text || '',
        attachments: parsed.attachments || []
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.close();
  }
}

async function deleteMessage(account, uid, folder = 'INBOX') {
  const client = createImapClient(account);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageDelete(uid);
      return true;
    } finally {
      lock.release();
    }
  } finally {
    await client.close();
  }
}

async function moveMessage(account, uid, destination) {
  const client = createImapClient(account);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageMove(uid, destination);
      return true;
    } finally {
      lock.release();
    }
  } finally {
    await client.close();
  }
}

module.exports = {
  listFolders,
  listMessages,
  getMessage,
  deleteMessage,
  moveMessage,
  isNeteaseEmail
};