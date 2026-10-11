// ============================================================
// ITEM TEMPLATES — công dụng CỐ ĐỊNH, shop chỉ random CHỌN TRONG SỐ NÀY
// Mỗi rarity có các loại item. Mua xong vào túi đồ (/tuido) cất làm sưu tầm — không còn hiệu ứng gameplay.
// ============================================================

// effect types:
//  "shield_capture"   → miễn bị /batcocloli trong X phút
//  "shield_cc"        → miễn bị chichdien/leuleucay/cudamsamset trong X phút
//  "shield_all"       → miễn toàn bộ (capture + cc) trong X phút
//  "escape_ticket"    → thoát tù ngay lập tức, 100%, không cần roll
//  "cooldown_reset"   → reset toàn bộ cooldown game ngay lúc dùng
//  "aura_boost"       → cộng thẳng aura ngay khi dùng
//  "streak_saver"     → giữ nguyên chuỗi 1 lần thất bại tiếp theo (không bị reset)
//  "luck_charm"       → tăng % tỉ lệ thành công cho lần hành động KẾ TIẾP (capture/cc)
//  "double_drop"      → aurabox/mayman lần kế tiếp nhận gấp đôi
//  "slot_extra"       → +1 slot sở hữu tạm thời trong X phút
//  "jail_pardon"      → giải thoát 1 người đang bị mình nhốt ngay lập tức (hoặc chính mình)
//  "rename_tag"       → đổi danh hiệu hiển thị trong /flexaura (cosmetic)
//  "reflect"          → PHẢN ĐÒN: mọi lệnh tấn công nhắm vào người đang giữ item bị phản ngược
//                       (tối đa value.daily lần/ngày, tự reset mỗi ngày)

const ITEMS = [
  // ───────── ⚪ TRASH (giá 1, rẻ, hiệu ứng nhẹ/vui) ─────────
  {
    key: "tc_laybua",
    name: "Lá Bùa Hộ Mệnh Rách",
    rarity: "trash",
    effect: "shield_capture",
    value: { minutes: 1 },
    desc: "Miễn bị `/batcocloli` trong **1 phút** — bùa cũ nên hơi yếu.",
  },
  {
    key: "tc_specgs",
    name: "Kính Râm Cùi Bắp",
    rarity: "trash",
    effect: "shield_cc",
    value: { minutes: 1 },
    desc: "Miễn bị chích điện / lêu lêu / cú đấm trong **1 phút**.",
  },
  {
    key: "tc_xumeo",
    name: "Xu May Mắn Gỉ Sét",
    rarity: "trash",
    effect: "aura_boost",
    value: { amount: 5 },
    desc: "Dùng ngay nhận **+5 aura** — vớt vát cũng được.",
  },
  {
    key: "tc_bua5p",
    name: "Đồng Hồ Cát Vỡ",
    rarity: "trash",
    effect: "cooldown_reset",
    value: {},
    desc: "Reset ngay **toàn bộ cooldown** các lệnh game của bạn.",
  },

  // ───────── 🟢 COMMON (giá 5) ─────────
  {
    key: "cm_khien3p",
    name: "Khiên Gỗ Chắc Chắn",
    rarity: "common",
    effect: "shield_capture",
    value: { minutes: 3 },
    desc: "Miễn bị `/batcocloli` trong **3 phút**.",
  },
  {
    key: "cm_bongtai",
    name: "Bông Bịt Tai Dày",
    rarity: "common",
    effect: "shield_cc",
    value: { minutes: 3 },
    desc: "Miễn bị chích điện / lêu lêu / cú đấm trong **3 phút**.",
  },
  {
    key: "cm_bualucky",
    name: "Bùa May Mắn Nhỏ",
    rarity: "common",
    effect: "luck_charm",
    value: { pct: 10 },
    desc: "Lần `/batcocloli` hoặc khống chế **kế tiếp** tăng **+10%** tỉ lệ thành công.",
  },
  {
    key: "cm_tuimeo",
    name: "Túi Xu Rủng Rỉnh",
    rarity: "common",
    effect: "aura_boost",
    value: { amount: 20 },
    desc: "Dùng ngay nhận **+20 aura**.",
  },

  // ───────── 🔵 RARE (giá 20) ─────────
  {
    key: "ra_khien10p",
    name: "Áo Giáp Bạc",
    rarity: "rare",
    effect: "shield_all",
    value: { minutes: 5 },
    desc: "Miễn **toàn bộ** bị bắt cóc + khống chế trong **5 phút** — khiên toàn diện.",
  },
  {
    key: "ra_vethoat",
    name: "Vé Thoát Ngục Bạc",
    rarity: "rare",
    effect: "escape_ticket",
    value: {},
    desc: "Nếu đang ngồi tù: thoát **ngay 100%**, không cần roll, không quả báo.",
  },
  {
    key: "ra_chuoigiu",
    name: "Bùa Giữ Chuỗi",
    rarity: "rare",
    effect: "streak_saver",
    value: {},
    desc: "Lần thất bại **kế tiếp** sẽ **không** làm mất chuỗi (streak) của bạn.",
  },
  {
    key: "ra_hopdoi",
    name: "Hộp Quà Nhân Đôi",
    rarity: "rare",
    effect: "double_drop",
    value: {},
    desc: "`/aurabox` hoặc `/mayman` lần **kế tiếp** nhận **gấp đôi** aura.",
  },

  // ───────── 🟡 LEGENDARY (giá 80) ─────────
  {
    key: "lg_khien15p",
    name: "Giáp Rồng Vàng",
    rarity: "legendary",
    effect: "shield_all",
    value: { minutes: 15 },
    desc: "Miễn **toàn bộ** bị bắt cóc + khống chế trong **15 phút**.",
  },
  {
    key: "lg_buamay30",
    name: "Bùa May Mắn Lớn",
    rarity: "legendary",
    effect: "luck_charm",
    value: { pct: 30 },
    desc: "Lần `/batcocloli` hoặc khống chế **kế tiếp** tăng **+30%** tỉ lệ thành công.",
  },
  {
    key: "lg_slot2",
    name: "Túi Thần Kỳ",
    rarity: "legendary",
    effect: "slot_extra",
    value: { slots: 2, minutes: 30 },
    desc: "**+2 slot** sở hữu tạm thời trong **30 phút**.",
  },
  {
    key: "lg_xa",
    name: "Bùa Xá Tội",
    rarity: "legendary",
    effect: "jail_pardon",
    value: {},
    desc: "Thả **ngay lập tức** 1 người bạn đang nhốt ở tầng hầm (hoặc chính bạn nếu đang bị nhốt).",
  },

  // ───────── 🔴 MYTHICAL (giá 200) ─────────
  {
    key: "my_khien30p",
    name: "Giáp Thiên Thần",
    rarity: "mythical",
    effect: "shield_all",
    value: { minutes: 30 },
    desc: "Miễn **toàn bộ** bị bắt cóc + khống chế trong **30 phút** — gần như bất tử.",
  },
  {
    key: "my_aura150",
    name: "Ngọc Aura Cổ Đại",
    rarity: "mythical",
    effect: "aura_boost",
    value: { amount: 150 },
    desc: "Dùng ngay nhận **+150 aura** — nguyên khối tăng tier luôn.",
  },
  {
    key: "my_buamay50",
    name: "Nanh Vuốt Định Mệnh",
    rarity: "mythical",
    effect: "luck_charm",
    value: { pct: 50 },
    desc: "Lần `/batcocloli` hoặc khống chế **kế tiếp** tăng **+50%** tỉ lệ thành công.",
  },
  {
    key: "my_slot4",
    name: "Rương Không Gian",
    rarity: "mythical",
    effect: "slot_extra",
    value: { slots: 4, minutes: 60 },
    desc: "**+4 slot** sở hữu tạm thời trong **60 phút**.",
  },

  // ───────── ❕ BÁ KHÍ (cực hiếm — spawn 0.001%/món trong shop, giá riêng từng item) ─────────
  {
    key: "bk_khien60p",
    name: "Thiên Mệnh Chi Giáp",
    rarity: "baky",
    effect: "shield_all",
    value: { minutes: 60 },
    desc: "Miễn **toàn bộ** bị bắt cóc + khống chế trong **60 phút** — huyền thoại.",
  },
  {
    key: "bk_aura500",
    name: "Tinh Thể Hỗn Mang",
    rarity: "baky",
    effect: "reflect",
    value: { daily: 20 },
    price: 15000,
    desc: "Sở hữu = **PHẢN ĐÒN**: mọi lệnh tấn công nhắm vào bạn tự phản ngược về người ra lệnh (tối đa **20 lần/ngày**). Bá Khí đỉnh — giá 15000✨.",
  },
  {
    key: "bk_may100",
    name: "Thiên Nhãn Định Mệnh",
    rarity: "baky",
    effect: "luck_charm",
    value: { pct: 100 },
    desc: "Lần `/batcocloli` hoặc khống chế **kế tiếp** = **100% thành công** chắc chắn.",
  },
];

const RARITY_TABLE = {
  trash: ITEMS.filter((i) => i.rarity === "trash"),
  common: ITEMS.filter((i) => i.rarity === "common"),
  rare: ITEMS.filter((i) => i.rarity === "rare"),
  legendary: ITEMS.filter((i) => i.rarity === "legendary"),
  mythical: ITEMS.filter((i) => i.rarity === "mythical"),
  baky: ITEMS.filter((i) => i.rarity === "baky"),
};

const BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

function pickRandomByRarity(rarityKey) {
  const pool = RARITY_TABLE[rarityKey];
  if (!pool || !pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function get(key) {
  return BY_KEY[key] || null;
}

module.exports = { ITEMS, RARITY_TABLE, pickRandomByRarity, get };
