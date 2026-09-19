const { readJson, writeJsonDebounced } = require("./store");

const FILE = "economy.json";
const db = readJson(FILE, {}); // { guildId: { userId: { bal, lastDaily } } }

function bucket(guildId, userId) {
  if (!db[guildId]) db[guildId] = {};
  if (!db[guildId][userId]) db[guildId][userId] = { bal: 0, lastDaily: 0 };
  return db[guildId][userId];
}

function save() {
  writeJsonDebounced(FILE, db);
}

function get(guildId, userId) {
  return bucket(guildId, userId).bal;
}

function add(guildId, userId, amount) {
  const b = bucket(guildId, userId);
  b.bal = Math.max(0, b.bal + amount);
  save();
  return b.bal;
}

/** Trừ tiền, trả về false nếu không đủ. */
function spend(guildId, userId, amount) {
  const b = bucket(guildId, userId);
  if (b.bal < amount) return false;
  b.bal -= amount;
  save();
  return true;
}

function claimDaily(guildId, userId, amount) {
  const b = bucket(guildId, userId);
  const gap = Date.now() - (b.lastDaily || 0);
  const DAY = 24 * 60 * 60 * 1000;
  if (gap < DAY) return { ok: false, remainMs: DAY - gap };
  b.lastDaily = Date.now();
  b.bal += amount;
  save();
  return { ok: true, balance: b.bal };
}

function top(guildId, limit = 10) {
  const g = db[guildId] || {};
  return Object.entries(g)
    .sort((a, b) => b[1].bal - a[1].bal)
    .slice(0, limit)
    .map(([userId, v]) => ({ userId, bal: v.bal }));
}

module.exports = { get, add, spend, claimDaily, top };
