const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "aura.json");

const AURA_PER_SLOT = 100;
const BASE_SLOTS = 5;          // slot mặc định — đủ cho người mới
const MAX_SLOT_BONUS = 10;     // bonus tối đa từ aura (mỗi 100 aura +1)
const IMMUNITY_STEP = 5;
const IMMUNITY_CAP = 60;
const STREAK_WINDOW_MS = 10 * 60 * 1000;
const STREAK_CAP = 10;
const GOD_TIER = 700;

// ───────── 15 phân hạng hiển thị (0 → >500M) ─────────
const RANKS = [
  { min: 0, name: "Thấp", icon: "🌱", color: 0x95a5a6 },
  { min: 50_000, name: "Tân Binh", icon: "🌿", color: 0x27ae60 },
  { min: 150_000, name: "Lính Mới", icon: "🗡️", color: 0x2ecc71 },
  { min: 400_000, name: "Tinh Anh", icon: "⭐", color: 0x1abc9c },
  { min: 700_000, name: "Lão Luyện", icon: "🎖️", color: 0x3498db },
  { min: 1_000_000, name: "Trung Bình", icon: "🧭", color: 0x2980b9 },
  { min: 2_000_000, name: "Khá Giả", icon: "💰", color: 0x8e44ad },
  { min: 3_000_000, name: "Giàu Có", icon: "💎", color: 0x9b59b6 },
  { min: 4_000_000, name: "Thượng Lưu", icon: "🥂", color: 0xe67e22 },
  { min: 5_000_000, name: "Cao", icon: "🔥", color: 0xd35400 },
  { min: 10_000_000, name: "Cao Cấp", icon: "🚀", color: 0xf39c12 },
  { min: 15_000_000, name: "Siêu Cấp", icon: "⚡", color: 0xf1c40f },
  { min: 20_000_000, name: "Hắc Hoàng", icon: "👑", color: 0x2c3e50 },
  { min: 100_000_000, name: "Chân Thần", icon: "✨", color: 0xe91e63 },
  { min: 500_000_000, name: "Vô Cực", icon: "🌀", color: 0x00cec9 },
];

// Từ 15M aura → được role Discord custom "AURA <tên>" (tên tự đặt qua /flexaura)
const CUSTOM_ROLE_MIN = 15_000_000;

// ───────── 30 mốc tier — role Discord "Aura <mốc>" (key = tên role trong ROLE_DEFS) ─────────
const MILESTONES = [
  [1_000, "tier1k", "1K"], [5_000, "tier5k", "5K"], [10_000, "tier10k", "10K"],
  [50_000, "tier50k", "50K"], [100_000, "tier100k", "100K"], [250_000, "tier250k", "250K"],
  [500_000, "tier500k", "500K"],
  [1_000_000, "tier1m", "1M"], [2_000_000, "tier2m", "2M"], [3_000_000, "tier3m", "3M"],
  [4_000_000, "tier4m", "4M"], [5_000_000, "tier5m", "5M"],
  [6_000_000, "tier6m", "6M"], [10_000_000, "tier10m", "10M"], [15_000_000, "tier15m", "15M"],
  [20_000_000, "tier20m", "20M"],
  [25_000_000, "tier25m", "25M"], [35_000_000, "tier35m", "35M"], [50_000_000, "tier50m", "50M"],
  [75_000_000, "tier75m", "75M"], [100_000_000, "tier100m", "100M"],
  [125_000_000, "tier125m", "125M"], [175_000_000, "tier175m", "175M"], [250_000_000, "tier250m", "250M"],
  [350_000_000, "tier350m", "350M"], [500_000_000, "tier500m", "500M"],
  [600_000_000, "tier600m", "600M"], [700_000_000, "tier700m", "700M"],
  [850_000_000, "tier850m", "850M"], [1_000_000_000, "tier1b", "1B"],
];

// Phân hạng của một mức aura (15 bậc)
function rankOf(a) {
  let r = RANKS[0];
  for (const rank of RANKS) if (a >= rank.min) r = rank;
  return r;
}

// 30 tier hiển thị — icon/màu lấy theo phân hạng chứa mốc đó
const TIERS = MILESTONES.map(([min, key, label]) => {
  const r = rankOf(min);
  return { min, key, name: `Aura ${label}`, icon: r.icon, color: r.color };
});

let users = {};
let saveTimer = null;

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      users = parsed && typeof parsed === "object" ? parsed : {};
    }
  } catch (err) {
    logger.warn(`aura load failed: ${err.message}`);
    users = {};
  }
}

function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    logger.error(`aura save failed: ${err.message}`);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}

function get(userId) {
  if (!users[userId]) {
    users[userId] = {
      aura: 0,
      hits: 0,
      taken: 0,
      escapes: 0,
      fails: 0,
      possessions: 0,
      jails: 0,
      jailed: 0,
      streak: 0,
      bestStreak: 0,
      lastActionAt: 0,
      lastDailyAt: 0,
      dailyStreak: 0,
      shopBought: 0,
      gStreak: 0,
      gPity: 0,
      gItem: 0,
      gExtra: 0,
      auraRoleName: null,
    };
  }
  return users[userId];
}

// Slot = 5 cơ bản + bonus từ aura (mỗi 100 aura +1, tối đa +10 → 15)
function slotsFor(aura) {
  return BASE_SLOTS + Math.min(MAX_SLOT_BONUS, Math.floor(aura / AURA_PER_SLOT));
}

// Mỗi 100 aura → +5% miễn thời gian khống chế (tối đa 60%)
function immunityFor(aura) {
  return Math.min(IMMUNITY_CAP, Math.floor(aura / AURA_PER_SLOT) * IMMUNITY_STEP);
}

// ───────── GACHA: luật chuỗi thắng (state persist trong user record) ─────────
const GACHA_BASE_WIN = 90;     // chuỗi 0 → 90% cố định
const GACHA_BAND_STEP = 10;    // mỗi thắng nối tiếp: band [90 - 10×n, 90] (sàn 0%)
const GACHA_BONUS_BASE = 60;   // bonus = (60 - immunity) + 20×chuỗi  (% cược)
const GACHA_BONUS_STEP = 20;
const GACHA_PITY_BASE = 1;     // jackpot role: 1% × 2 mỗi lần quay, trúng → reset 1%
const GACHA_ITEM_BASE = 10;    // vật phẩm mythic/bá khí: 10% × 2 mỗi lần, trúng → reset 10%
const GACHA_EXTRA_BASE = 35;   // vòng bonus: 35% + 15% mỗi lần đã kích hoạt
const GACHA_EXTRA_STEP = 15;
const GACHA_EXTRA_CAP = 95;    // cap — 100% sẽ quay vô hạn

// Chuỗi thắng n → band tỉ lệ của vòng kế tiếp [thấp, cao]
function gachaWinBand(streak) {
  if (!Number.isFinite(streak) || streak <= 0) return [GACHA_BASE_WIN, GACHA_BASE_WIN];
  return [Math.max(0, GACHA_BASE_WIN - GACHA_BAND_STEP * streak), GACHA_BASE_WIN];
}

// Bonus % cược theo chuỗi thắng — immunity cap 60 nên luôn ≥ 0
function gachaBonusPct(streak, immunityPct) {
  return (GACHA_BONUS_BASE - immunityPct) + GACHA_BONUS_STEP * Math.max(0, Number.isFinite(streak) ? streak : 0);
}

// State gacha của user (lazy-normalize record cũ)
function gachaMeta(userId) {
  const u = get(userId);
  if (!Number.isFinite(u.gStreak)) u.gStreak = 0;
  if (!Number.isFinite(u.gPity)) u.gPity = 0;
  if (!Number.isFinite(u.gItem)) u.gItem = 0;
  if (!Number.isFinite(u.gExtra)) u.gExtra = 0;
  return u;
}

// Áp miễn nhiễm lên thời gian khống chế: trả về { pct, original, final }
function reduceDuration(seconds, aura) {
  const pct = immunityFor(aura);
  const final = Math.max(0, Math.round((seconds * (100 - pct)) / 100));
  return { pct, original: seconds, final };
}

function tierOf(aura) {
  let t = TIERS[0];
  for (const tier of TIERS) if (aura >= tier.min) t = tier;
  return t;
}

function nextTier(aura) {
  for (const tier of TIERS) if (aura < tier.min) return tier;
  return null;
}

function progressInfo(aura) {
  const into = aura % AURA_PER_SLOT;
  const filled = Math.round((into / AURA_PER_SLOT) * 10);
  return {
    into,
    need: AURA_PER_SLOT - into,
    bar: `${"█".repeat(filled)}${"░".repeat(10 - filled)}`,
    nextSlot: slotsFor(aura) + 1,
    nextImmunity: Math.min(IMMUNITY_CAP, immunityFor(aura) + IMMUNITY_STEP),
  };
}

// Phù phép newbie — aura càng thấp càng được nhân để lên 1M nhanh hơn
function newbieMult(a) {
  if (a < 100_000) return 10;
  if (a < 1_000_000) return 5;
  if (a < 5_000_000) return 2;
  return 1;
}

// gain(userId, base, { success, fail, noStreak }) → { amount, total, streak, mult, nmult }
function gain(userId, base, opts = {}) {
  const u = get(userId);
  const now = Date.now();
  if (now - u.lastActionAt > STREAK_WINDOW_MS) u.streak = 0;

  const mult = opts.noStreak ? 1 : 1 + Math.min(u.streak, STREAK_CAP) * 0.1;
  const nmult = newbieMult(u.aura); // áp TRƯỚC khi cộng — aura thấp được ×10/×5/×2
  const amount = Math.max(0, Math.round(base * mult * nmult));

  u.aura += amount;
  if (opts.success) {
    u.streak = Math.min(u.streak + 1, STREAK_CAP);
    u.bestStreak = Math.max(u.bestStreak, u.streak);
  } else if (opts.fail) {
    u.streak = 0;
  }
  u.lastActionAt = now;
  scheduleSave();
  return { amount, total: u.aura, streak: u.streak, mult, nmult };
}

// Đặt tên role custom "AURA <tên>" (chỉ người ≥15M mới có tác dụng khi sync)
function setAuraRoleName(userId, name) {
  const u = get(userId);
  u.auraRoleName = name;
  scheduleSave();
  return u;
}

function bump(userId, key, n = 1) {
  const u = get(userId);
  u[key] = (u[key] || 0) + n;
  scheduleSave();
  return u;
}

// Trừ chuỗi khi thất bại (không qua gain để không cộng aura)
// Item "Bùa Giữ Chuỗi": lần fail kế tiếp KHÔNG reset chuỗi (dùng 1 lần rồi mất)
function resetStreak(userId) {
  const u = get(userId);
  if (u.streak > 0) {
    const inventory = require("./inventory");
    if (inventory.popStreakSaver(userId)) return u;
  }
  u.streak = 0;
  u.lastActionAt = Date.now();
  scheduleSave();
  return u;
}

// Trừ aura (không xuống dưới 0) — dùng cho cá cược / chuyển khoản / phạt
function spend(userId, amount) {
  const u = get(userId);
  u.aura = Math.max(0, u.aura - amount);
  scheduleSave();
  return u.aura;
}

// Cộng thẳng aura (thắng cược, thưởng) — không ảnh hưởng chuỗi
function credit(userId, amount) {
  const u = get(userId);
  u.aura = Math.max(0, u.aura + amount);
  scheduleSave();
  return u.aura;
}

// Chuyển aura giữa 2 người — trả về { ok, from, to, reason }
function transfer(fromId, toId, amount) {
  const from = get(fromId);
  const to = get(toId);
  if (amount <= 0) return { ok: false, reason: "Số aura phải lớn hơn 0." };
  if (from.aura < amount) return { ok: false, reason: `Bạn chỉ có \`${from.aura}\` aura — không đủ chuyển \`${amount}\`.` };
  from.aura -= amount;
  to.aura += amount;
  scheduleSave();
  return { ok: true, from: from.aura, to: to.aura };
}

function top(limit = 10) {
  return Object.entries(users)
    .map(([id, u]) => ({ userId: id, ...u }))
    .sort((a, b) => b.aura - a.aura)
    .slice(0, limit);
}

function rank(userId) {
  const sorted = Object.entries(users)
    .map(([id, u]) => ({ userId: id, aura: u.aura }))
    .sort((a, b) => b.aura - a.aura);
  const idx = sorted.findIndex((e) => e.userId === userId);
  return idx === -1 ? null : { position: idx + 1, total: sorted.length };
}

// Chống bắt nạt 1 chiều: người có aura quá thấp (newbie) không thể bị nhắm
// bởi người có aura cao hơn NHIỀU LẦN. Trả về null nếu hợp lệ, hoặc lý do chặn.
const NEWBIE_AURA_CAP = 50;     // dưới mức này được coi là "người mới"
const NEWBIE_GAP_MULT = 4;      // kẻ tấn công không được hơn nạn nhân quá 4 lần (khi nạn nhân là newbie)

function newbieGuard(invokerId, targetId) {
  const targetAura = get(targetId).aura;
  if (targetAura > NEWBIE_AURA_CAP) return null; // không phải newbie, không cần bảo vệ
  const invokerAura = get(invokerId).aura;
  if (invokerAura <= NEWBIE_AURA_CAP * NEWBIE_GAP_MULT) return null; // chênh lệch chưa quá đáng
  return {
    blocked: true,
    reason:
      `🛡️ **Bảo vệ người mới**: <@${targetId}> còn ít aura (\`${targetAura}\`) — ` +
      `người có \`${invokerAura}\` aura như bạn chưa được nhắm vào họ.\n` +
      `> Hãy để họ cày thêm aura rồi quay lại, hoặc chọn mục tiêu ngang sức hơn!`,
  };
}

module.exports = {
  get,
  newbieGuard,
  slotsFor,
  immunityFor,
  reduceDuration,
  tierOf,
  nextTier,
  progressInfo,
  gain,
  bump,
  spend,
  credit,
  transfer,
  resetStreak,
  top,
  rank,
  flush,
  gachaMeta,
  gachaWinBand,
  gachaBonusPct,
  rankOf,
  RANKS,
  newbieMult,
  setAuraRoleName,
  GOD_TIER,
  TIERS,
  CUSTOM_ROLE_MIN,
  AURA_PER_SLOT,
  BASE_SLOTS,
  MAX_SLOT_BONUS,
  IMMUNITY_STEP,
  GACHA_BASE_WIN,
  GACHA_BAND_STEP,
  GACHA_BONUS_BASE,
  GACHA_BONUS_STEP,
  GACHA_PITY_BASE,
  GACHA_ITEM_BASE,
  GACHA_EXTRA_BASE,
  GACHA_EXTRA_STEP,
  GACHA_EXTRA_CAP,
};

load();
process.on("exit", flush);
