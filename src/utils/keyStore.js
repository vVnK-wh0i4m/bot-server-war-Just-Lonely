const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEYS_FILE = path.join(__dirname, "..", "..", "bot_keys.json");
const KEY_PREFIX = "vVnKwh0i4m_";
const KEY_EXPIRY_MS = 3 * 60 * 60 * 1000;

function loadKeys() {
  try {
    const data = JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
    if (!data.pending) data.pending = [];
    if (!data.used) data.used = {};
    if (!data.revoked) data.revoked = [];
    return data;
  } catch {
    return { pending: [], used: {}, revoked: [] };
  }
}

function saveKeys(data) {
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function generateKey() {
  const rand = crypto.randomBytes(12).toString("hex");
  return KEY_PREFIX + rand;
}

function createKey(guildId, guildName) {
  const data = loadKeys();
  const key = generateKey();
  const expiresAt = Date.now() + KEY_EXPIRY_MS;

  data.pending.push({
    key,
    guildId,
    guildName,
    createdAt: Date.now(),
    expiresAt,
    used: false,
  });

  saveKeys(data);
  return { key, expiresAt };
}

function redeemKey(key, userId, username) {
  const data = loadKeys();
  const idx = data.pending.findIndex((k) => k.key === key && !k.used);

  if (idx === -1) return { success: false, reason: "Key không tồn tại hoặc đã được sử dụng." };

  const entry = data.pending[idx];

  if (Date.now() > entry.expiresAt) {
    data.pending.splice(idx, 1);
    saveKeys(data);
    return { success: false, reason: "Key đã hết hạn." };
  }

  if (data.revoked.includes(key)) {
    data.pending.splice(idx, 1);
    saveKeys(data);
    return { success: false, reason: "Key đã bị thu hồi." };
  }

  entry.used = true;
  entry.usedBy = userId;
  entry.usedAt = Date.now();
  data.used[key] = {
    userId,
    username,
    guildId: entry.guildId,
    guildName: entry.guildName,
    usedAt: Date.now(),
    expiresAt: entry.expiresAt,
  };

  saveKeys(data);
  return {
    success: true,
    guildName: entry.guildName,
    expiresAt: entry.expiresAt,
  };
}

function revokeKey(key) {
  const data = loadKeys();
  if (!data.revoked.includes(key)) data.revoked.push(key);
  data.pending = data.pending.filter((k) => k.key !== key);
  delete data.used[key];
  saveKeys(data);
}

function revokeAll() {
  const data = loadKeys();
  const allKeys = [
    ...data.pending.map((k) => k.key),
    ...Object.keys(data.used),
  ];
  data.revoked = [...new Set([...data.revoked, ...allKeys])];
  data.pending = [];
  data.used = {};
  saveKeys(data);
  return allKeys.length;
}

function cleanExpired() {
  const data = loadKeys();
  const now = Date.now();
  const expired = data.pending.filter((k) => now > k.expiresAt);
  data.pending = data.pending.filter((k) => now <= k.expiresAt);
  saveKeys(data);
  return expired.length;
}

function getKeyStats() {
  const data = loadKeys();
  const now = Date.now();
  return {
    pending: data.pending.filter((k) => !k.used && now <= k.expiresAt).length,
    used: Object.keys(data.used).length,
    expired: data.pending.filter((k) => now > k.expiresAt).length,
    revoked: data.revoked.length,
    total: data.pending.length + Object.keys(data.used).length,
  };
}

function listKeys(showUsed = false) {
  const data = loadKeys();
  const now = Date.now();
  const result = [];

  for (const k of data.pending) {
    if (k.used && !showUsed) continue;
    result.push({
      key: k.key,
      guildName: k.guildName,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      used: k.used,
      usedBy: k.usedBy || null,
      expired: now > k.expiresAt,
    });
  }

  if (showUsed) {
    for (const [key, info] of Object.entries(data.used)) {
      result.push({
        key,
        guildName: info.guildName,
        createdAt: null,
        expiresAt: info.expiresAt,
        used: true,
        usedBy: info.userId,
        expired: now > info.expiresAt,
      });
    }
  }

  return result;
}

function validateKeyForWeb(key) {
  const data = loadKeys();
  const entry = data.pending.find((k) => k.key === key && !k.used);
  if (!entry) return { valid: false, reason: "not_found" };
  if (Date.now() > entry.expiresAt) return { valid: false, reason: "expired" };
  if (data.revoked.includes(key)) return { valid: false, reason: "revoked" };
  return { valid: true, guildName: entry.guildName, expiresAt: entry.expiresAt };
}

module.exports = {
  loadKeys,
  saveKeys,
  generateKey,
  createKey,
  redeemKey,
  revokeKey,
  revokeAll,
  cleanExpired,
  getKeyStats,
  listKeys,
  validateKeyForWeb,
  KEY_PREFIX,
  KEY_EXPIRY_MS,
};
