const { safeStorage } = require('electron');

function encrypt(plainText) {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(plainText).toString('base64');
  }
  const buf = safeStorage.encryptString(plainText);
  return buf.toString('base64');
}

function decrypt(encryptedBase64) {
  if (!encryptedBase64) return '';
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(encryptedBase64, 'base64').toString();
    }
    const buf = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buf);
  } catch (e) {
    console.error('Decrypt failed:', e.message);
    return '';
  }
}

module.exports = { encrypt, decrypt };