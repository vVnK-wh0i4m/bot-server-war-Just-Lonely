// Quản lý quyền người dùng toàn cục — data/access.json
//   blacklist: user bị BOT LÀM NGƠ hoàn toàn (mọi lệnh prefix/slash/component)
//   perms:     quyền chạy nhóm lệnh bị hạn chế (mặc định TẤT CẢ đều bật — dev tắt đi)
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "access.json");

// Các quyền bị hạn chế — mặc định true, dev panel toggle tắt
const FLAGS = {
  spam: "📢 Lệnh spam (?spam ?ngon ?nhay)",
  inf: "♾️ Chạy chế độ `inf` (spam vô hạn)",
  clearchat: "🧹 ?clearchat (đẩy trôi chat)",
  stop: "🛑 ?stop (dừng spam của người khác)",
};

const DEFAULT_PERMS = Object.fromEntries(Object.keys(FLAGS).map((f) => [f, true]));

let state = { blacklist: {}, perms: {} };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      state = Object.assign({ blacklist: {}, perms: {} }, parsed);
    }
  } catch (err) {
    logger.warn(`access load: ${err.message}`);
    state = { blacklist: {}, perms: {} };
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    logger.warn(`access save: ${err.message}`);
  }
}

function isBlocked(id) {
  return Boolean(state.blacklist[String(id)]);
}

function block(id, reason, byTag) {
  const s = String(id).trim();
  if (!/^\d{5,25}$/.test(s)) return false;
  state.blacklist[s] = { reason: (reason || "Không rõ").slice(0, 100), by: byTag || "?", at: Date.now() };
  save();
  return true;
}

function unblock(id) {
  const s = String(id).trim();
  if (!state.blacklist[s]) return false;
  delete state.blacklist[s];
  save();
  return true;
}

function listBlocked() {
  return Object.entries(state.blacklist).map(([id, v]) => ({ id, ...v }));
}

// Quyền của user — merge default (mặc định bật hết)
function perms(id) {
  return Object.assign({}, DEFAULT_PERMS, state.perms[String(id)] || {});
}

function setPerm(id, flag, value) {
  if (!(flag in FLAGS)) return false;
  const s = String(id).trim();
  if (!/^\d{5,25}$/.test(s)) return false;
  const cur = state.perms[s] || {};
  cur[flag] = Boolean(value);
  // dọn record nếu về đúng default — giữ file gọn
  if (Object.keys(FLAGS).every((f) => Boolean(cur[f]) === DEFAULT_PERMS[f])) delete state.perms[s];
  else state.perms[s] = cur;
  save();
  return true;
}

function canUse(id, flag) {
  if (isBlocked(id)) return false;
  return perms(id)[flag] !== false;
}

function profile(id) {
  const s = String(id);
  const bl = state.blacklist[s];
  return {
    blocked: Boolean(bl),
    blacklistReason: bl?.reason || null,
    blacklistBy: bl?.by || null,
    blacklistAt: bl?.at || null,
    perms: perms(s),
  };
}

load();

module.exports = { FLAGS, isBlocked, block, unblock, listBlocked, perms, setPerm, canUse, profile };
