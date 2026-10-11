const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const items = require("./items");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "inventory.json");

// data = { [userId]: { bag: { [itemKey]: qty }, effects: { shieldUntil, shieldType, luckPct, streakSaver, slotBonus, slotUntil } } }
let data = {};
let saveTimer = null;

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      data = parsed && typeof parsed === "object" ? parsed : {};
    }
  } catch (err) {
    logger.warn(`inventory load failed: ${err.message}`);
    data = {};
  }
}

function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data));
  } catch (err) {
    logger.error(`inventory save failed: ${err.message}`);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}

function rec(userId) {
  if (!data[userId]) {
    data[userId] = { bag: {}, effects: {} };
  }
  if (!data[userId].effects) data[userId].effects = {};
  return data[userId];
}

// ---------- túi đồ ----------
function addItem(userId, itemKey, qty = 1) {
  const r = rec(userId);
  r.bag[itemKey] = (r.bag[itemKey] || 0) + qty;
  scheduleSave();
  return r.bag[itemKey];
}

function removeItem(userId, itemKey, qty = 1) {
  const r = rec(userId);
  const have = r.bag[itemKey] || 0;
  if (have < qty) return false;
  r.bag[itemKey] = have - qty;
  if (r.bag[itemKey] <= 0) delete r.bag[itemKey];
  scheduleSave();
  return true;
}

function bagOf(userId) {
  const r = rec(userId);
  return Object.entries(r.bag)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => ({ key, qty, item: items.get(key) }))
    .filter((e) => e.item);
}

// ---------- hiệu ứng active ----------
function now() {
  return Date.now();
}

function isShielded(userId, kind) {
  // kind: "capture" | "cc"
  const r = rec(userId);
  const fx = r.effects;
  if (!fx.shieldUntil || fx.shieldUntil <= now()) return false;
  if (fx.shieldType === "all") return true;
  return fx.shieldType === kind;
}

function shieldInfo(userId) {
  const r = rec(userId);
  const fx = r.effects;
  if (!fx.shieldUntil || fx.shieldUntil <= now()) return null;
  return { type: fx.shieldType, until: fx.shieldUntil, left: fx.shieldUntil - now() };
}

function setShield(userId, type, minutes) {
  const r = rec(userId);
  const until = now() + minutes * 60000;
  // Không ghi đè khiên dài hơn đang có bằng khiên ngắn hơn
  if (r.effects.shieldUntil && r.effects.shieldUntil > until && r.effects.shieldType === "all") {
    scheduleSave();
    return r.effects.shieldUntil;
  }
  r.effects.shieldUntil = until;
  r.effects.shieldType = type;
  scheduleSave();
  return until;
}

// luck charm: % cộng thêm cho hành động kế tiếp — dùng 1 lần rồi mất
function popLuck(userId) {
  const r = rec(userId);
  const pct = r.effects.luckPct || 0;
  if (pct > 0) {
    r.effects.luckPct = 0;
    scheduleSave();
  }
  return pct;
}

function setLuck(userId, pct) {
  const r = rec(userId);
  r.effects.luckPct = Math.max(r.effects.luckPct || 0, pct);
  scheduleSave();
}

function hasLuck(userId) {
  return (rec(userId).effects.luckPct || 0) > 0;
}

// streak saver: giữ nguyên chuỗi khi fail 1 lần — dùng 1 lần rồi mất
function popStreakSaver(userId) {
  const r = rec(userId);
  if (r.effects.streakSaver) {
    r.effects.streakSaver = false;
    scheduleSave();
    return true;
  }
  return false;
}

function setStreakSaver(userId) {
  const r = rec(userId);
  r.effects.streakSaver = true;
  scheduleSave();
}

// double drop: nhân đôi phần thưởng box/mayman kế tiếp — dùng 1 lần rồi mất
function popDoubleDrop(userId) {
  const r = rec(userId);
  if (r.effects.doubleDrop) {
    r.effects.doubleDrop = false;
    scheduleSave();
    return true;
  }
  return false;
}

function setDoubleDrop(userId) {
  const r = rec(userId);
  r.effects.doubleDrop = true;
  scheduleSave();
}

// slot bonus tạm thời
function slotBonusFor(userId) {
  const r = rec(userId);
  if (!r.effects.slotUntil || r.effects.slotUntil <= now()) return 0;
  return r.effects.slotBonus || 0;
}

function setSlotBonus(userId, slots, minutes) {
  const r = rec(userId);
  const until = now() + minutes * 60000;
  // cộng dồn nếu đang có hiệu lực, không thì bắt đầu mới
  if (r.effects.slotUntil && r.effects.slotUntil > now()) {
    r.effects.slotBonus = (r.effects.slotBonus || 0) + slots;
    r.effects.slotUntil = Math.max(r.effects.slotUntil, until);
  } else {
    r.effects.slotBonus = slots;
    r.effects.slotUntil = until;
  }
  scheduleSave();
}

function activeEffectsSummary(userId) {
  const r = rec(userId);
  const fx = r.effects;
  const lines = [];
  const t = now();
  if (fx.shieldUntil && fx.shieldUntil > t) {
    const label = fx.shieldType === "all" ? "Khiên toàn diện" : fx.shieldType === "capture" ? "Khiên chống bắt cóc" : "Khiên chống khống chế";
    lines.push({ type: "shield", text: `🛡️ ${label} — còn hiệu lực` , until: fx.shieldUntil });
  }
  if (fx.luckPct > 0) lines.push({ type: "luck", text: `🍀 Bùa may mắn +${fx.luckPct}% (dùng ở lần kế tiếp)` });
  if (fx.streakSaver) lines.push({ type: "streak", text: `🔗 Bùa giữ chuỗi (kích hoạt khi fail lần tới)` });
  if (fx.doubleDrop) lines.push({ type: "double", text: `🎁 Nhân đôi phần thưởng (aurabox/mayman kế tiếp)` });
  if (fx.slotUntil && fx.slotUntil > t) lines.push({ type: "slot", text: `👥 +${fx.slotBonus} slot tạm thời — còn hiệu lực`, until: fx.slotUntil });
  return lines;
}

// reflect (Tinh Thể Hỗn Mang): phản đòn tối đa N lần/ngày, tự reset khi sang ngày
function reflectDayNum() {
  return Math.floor(Date.now() / 86400000);
}

function reflectLeft(userId) {
  const r = rec(userId);
  const day = reflectDayNum();
  if (r.effects.reflectDay !== day) {
    r.effects.reflectDay = day;
    r.effects.reflectLeft = 20;
    scheduleSave();
  }
  return r.effects.reflectLeft ?? 20;
}

function hasReflect(userId) {
  const r = rec(userId);
  return (r.bag.bk_aura500 || 0) > 0 && reflectLeft(userId) > 0;
}

function useReflect(userId) {
  const left = reflectLeft(userId);
  if (left <= 0) return false;
  rec(userId).effects.reflectLeft = left - 1;
  scheduleSave();
  return true;
}

function bagQty(userId, itemKey) {
  return rec(userId).bag[itemKey] || 0;
}

load();
process.on("exit", flush);

module.exports = {
  addItem,
  removeItem,
  bagOf,
  bagQty,
  isShielded,
  shieldInfo,
  setShield,
  popLuck,
  setLuck,
  hasLuck,
  popStreakSaver,
  setStreakSaver,
  popDoubleDrop,
  setDoubleDrop,
  slotBonusFor,
  setSlotBonus,
  reflectLeft,
  hasReflect,
  useReflect,
  activeEffectsSummary,
  flush,
};
