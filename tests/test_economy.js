// Test cải tổ kinh tế: 15 phân hạng, 30 role mốc, newbie multiplier, custom role >15M, cap mới
const fs = require("fs");
const path = require("path");

const BOT = path.resolve(__dirname, "..");
const DATA = path.join(BOT, "data");
const FILES = ["aura.json", "inventory.json", "game.json"];
const backup = {};
for (const f of FILES) {
  const p = path.join(DATA, f);
  if (fs.existsSync(p)) backup[f] = fs.readFileSync(p);
}
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("  OK  " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

// ---------- mock guild/member ----------
const createdRoles = [];
let rid = 0;
function seedRole(name) {
  const r = { id: "rc" + ++rid, name, managed: false, position: 10 };
  createdRoles.push(r);
  return r;
}
const guild = {
  id: "g1",
  roles: {
    everyone: { id: "everyone" },
    cache: {
      get: (id) => createdRoles.find((r) => r.id === id) || null,
      find: (fn) => createdRoles.find(fn) || null,
    },
    create: async ({ name }) => seedRole(name),
  },
  members: {
    me: { permissions: { has: () => true }, roles: { highest: { position: 99 } } },
    cache: { get: () => null, find: () => null },
    fetch: async () => null,
  },
  channels: { cache: { find: () => null } },
};
const added = [], removed = [];
function makeMember(id, heldSeedNames = []) {
  const held = [];
  for (const n of heldSeedNames) held.push(seedRole(n));
  const m = {
    id,
    guild,
    user: { id, tag: id, displayAvatarURL: () => "http://x" },
    roles: {
      highest: { position: 1 },
      cache: {
        has: (rid2) => held.some((h) => h.id === rid2),
        get: (rid2) => held.find((h) => h.id === rid2) || null,
        find: (fn) => held.find(fn) || null,
        filter: (fn) => held.filter(fn),
        some: (fn) => held.some(fn),
      },
      add: async (r) => {
        if (!held.some((h) => h.id === r.id)) held.push({ id: r.id, name: r.name });
        added.push(r.name);
      },
      remove: async (r) => {
        const i = held.findIndex((h) => h.id === r.id);
        if (i >= 0) held.splice(i, 1);
        removed.push(r.name);
      },
    },
    held,
    timeout: async () => {},
  };
  return m;
}

// ---------- load ----------
const aura = require(path.join(BOT, "src", "utils", "aura.js"));
const game = require(path.join(BOT, "src", "utils", "game.js"));
const duauraCmd = require(path.join(BOT, "src", "commands", "game", "duaura.js"));
const flexCmd = require(path.join(BOT, "src", "commands", "game", "flexaura.js"));
const { loadCommands } = require(path.join(BOT, "src", "utils", "loader.js"));
const client = { commands: new Map(), prefixCommands: new Map() };
loadCommands(client);
// đăng ký restore SAU require (aura flush đăng ký trước → flush chạy trước, restore đè sau)
process.on("exit", () => {
  for (const f of FILES) {
    const p = path.join(DATA, f);
    if (backup[f] !== undefined) fs.writeFileSync(p, backup[f]);
    else if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

function dataOf(p) { const e = p?.embeds?.[0]; return e ? (e.data || e) : {}; }

(async () => {
  console.log("== 15 phân hạng ==");
  ok(aura.RANKS.length === 15, `RANKS = 15 (${aura.RANKS.length})`);
  ok(aura.rankOf(0).name === "Thấp" && aura.rankOf(49_999).name === "Thấp", "0–49.999 → Thấp");
  ok(aura.rankOf(50_000).name === "Tân Binh", "50K → Tân Binh");
  ok(aura.rankOf(999_999).name === "Lão Luyện", "999K → Lão Luyện");
  ok(aura.rankOf(1_000_000).name === "Trung Bình", "1M → Trung Bình");
  ok(aura.rankOf(4_999_999).name === "Thượng Lưu", "4,99M → Thượng Lưu");
  ok(aura.rankOf(5_000_000).name === "Cao", "5M → Cao");
  ok(aura.rankOf(15_000_000).name === "Siêu Cấp", "15M → Siêu Cấp");
  ok(aura.rankOf(20_000_000).name === "Hắc Hoàng", "20M → Hắc Hoàng");
  ok(aura.rankOf(100_000_000).name === "Chân Thần", "100M → Chân Thần");
  ok(aura.rankOf(499_999_999).name === "Chân Thần", "499.999.999 → Chân Thần");
  ok(aura.rankOf(500_000_000).name === "Vô Cực" && aura.rankOf(9e12).name === "Vô Cực", ">500M → Vô Cực");

  console.log("== 30 tier/role mốc ==");
  ok(aura.TIERS.length === 30, `TIERS = 30 (${aura.TIERS.length})`);
  const keys = new Set(aura.TIERS.map((t) => t.key));
  ok(keys.size === 30, "key role duy nhất ×30");
  ok(aura.TIERS[0].min === 1_000 && aura.TIERS[0].name === "Aura 1K", "mốc đầu = Aura 1K");
  ok(aura.TIERS[29].min === 1_000_000_000 && aura.TIERS[29].name === "Aura 1B", "mốc cuối = Aura 1B");
  ok(aura.TIERS.every((t, i) => i === 0 || t.min > aura.TIERS[i - 1].min), "mốc tăng dần");
  ok(aura.TIERS.every((t) => t.icon && t.color), "mỗi tier có icon + màu");
  ok(aura.TIERS.some((t) => t.min === 250_000 && t.name === "Aura 250K"), "có mốc 250K");

  console.log("== newbie multiplier ==");
  ok(aura.newbieMult(0) === 10 && aura.newbieMult(99_999) === 10, "<100K → ×10");
  ok(aura.newbieMult(100_000) === 5 && aura.newbieMult(999_999) === 5, "100K–999K → ×5");
  ok(aura.newbieMult(1_000_000) === 2 && aura.newbieMult(4_999_999) === 2, "1M–5M → ×2");
  ok(aura.newbieMult(5_000_000) === 1, "≥5M → ×1");
  const gn = aura.gachaMeta("gn"); // normalize record
  gn.aura = 50_000; gn.streak = 0; gn.lastActionAt = 0;
  const res = aura.gain("gn", 30, { success: true });
  ok(res.nmult === 10 && res.amount === 300, `gain base30 aura50K → +300 (×10) (${res.amount})`);
  gn.aura = 2_000_000; gn.streak = 0;
  const res2 = aura.gain("gn", 30, { noStreak: true });
  ok(res2.nmult === 2 && res2.amount === 60, `gain aura2M → +60 (×2) (${res2.amount})`);
  ok(game.gameGain({ amount: 300, total: 300, streak: 1, mult: 1, nmult: 10 }).includes("🆕×10"), "gameGain hiện marker 🆕×10");

  console.log("== auraSummary có phân hạng ==");
  aura.get("sum1").aura = 20_000_000;
  ok(game.auraSummary("sum1").includes("**Hắc Hoàng**"), "summary 20M → Hắc Hoàng");

  console.log("== syncTierRole: role mốc ==");
  const mA = makeMember("mA");
  aura.get("mA").aura = 250_000;
  await game.syncTierRole(mA);
  ok(createdRoles.filter((r) => /^Aura \d/.test(r.name)).length === 30, `sync tạo đủ 30 role mốc (${createdRoles.filter((r) => /^Aura \d/.test(r.name)).length})`);
  ok(added.includes("Aura 250K"), "250K → gán Aura 250K");
  ok(!added.includes("Aura 500K"), "chưa gán Aura 500K");
  ok(!added.some((n) => n.startsWith("AURA ")), "chưa có role custom AURA");

  console.log("== syncTierRole: custom role >15M ==");
  const mB = makeMember("mB");
  const uB = aura.get("mB");
  uB.aura = 20_000_000;
  aura.setAuraRoleName("mB", "Khoa");
  await game.syncTierRole(mB);
  ok(mB.held.some((r) => r.name === "Aura 20M"), "20M → gán role mốc Aura 20M");
  ok(mB.held.some((r) => r.name === "AURA Khoa"), "đặt tên → gán AURA Khoa");

  console.log("== syncTierRole: đổi tên custom ==");
  aura.setAuraRoleName("mB", "Tèo");
  added.length = 0; removed.length = 0;
  await game.syncTierRole(mB);
  ok(mB.held.some((r) => r.name === "AURA Tèo"), "gán role mới AURA Tèo");
  ok(!mB.held.some((r) => r.name === "AURA Khoa"), "gỡ role cũ AURA Khoa");

  console.log("== syncTierRole: rơi dưới 15M → gỡ custom ==");
  uB.aura = 1_000;
  removed.length = 0;
  await game.syncTierRole(mB);
  ok(!mB.held.some((r) => r.name.startsWith("AURA ")), "dưới 15M → mất role custom");
  ok(removed.includes("Aura 20M") || !mB.held.some((r) => r.name === "Aura 20M"), "gỡ luôn role mốc cũ");

  console.log("== flexaura ==");
  const rich = aura.get("rich1");
  rich.aura = 20_000_000;
  let replies = [];
  const ix1 = {
    user: { id: "rich1", tag: "rich1", displayAvatarURL: () => "http://x" },
    member: makeMember("rich1"), guild: { id: "g1" }, guildId: "g1",
    options: { getUser: () => null },
    reply: async (p) => replies.push(p),
  };
  await flexCmd.execute(ix1);
  const e1 = dataOf(replies[0]);
  ok(e1.description.includes("Phân hạng: Hắc Hoàng"), "flex 20M → Hắc Hoàng");
  ok(e1.description.includes("Aura 20M"), "flex hiện tier Aura 20M");
  ok((replies[0].components || []).length === 1 && replies[0].components[0].components[0].data.custom_id === "flex_role", "flex 20M có nút đặt tên role");

  const poor = aura.get("poor1");
  poor.aura = 1_000;
  replies = [];
  const ix2 = {
    user: { id: "poor1", tag: "poor1", displayAvatarURL: () => "http://x" },
    member: makeMember("poor1"), guild: { id: "g1" }, guildId: "g1",
    options: { getUser: () => null },
    reply: async (p) => replies.push(p),
  };
  await flexCmd.execute(ix2);
  ok((replies[0].components || []).length === 0, "flex 1K không có nút custom");
  ok(dataOf(replies[0]).description.includes("Phân hạng: Thấp"), "flex 1K → Thấp");

  console.log("== flexaura onComponent: button + modal ==");
  let shown = null;
  const ixB = {
    user: { id: "rich1" }, customId: "flex_role",
    reply: async () => {}, showModal: async (m) => { shown = m; },
  };
  await flexCmd.onComponent(ixB);
  ok(shown && shown.data.custom_id === "flex_role_modal", "bấm nút → show modal");

  const mR = makeMember("rich1");
  const repliesC = [];
  const ixC = {
    user: { id: "rich1" }, customId: "flex_role_modal", member: mR,
    fields: { getTextInputValue: () => "  Khoa  " },
    reply: async (p) => repliesC.push(p),
  };
  aura.get("rich1").aura = 20_000_000;
  await flexCmd.onComponent(ixC);
  ok(aura.get("rich1").auraRoleName === "Khoa", "modal lưu tên Khoa (trim)");
  ok(mR.held.some((r) => r.name === "AURA Khoa"), "sync gán AURA Khoa cho rich1");
  ok(repliesC[0] && (dataOf(repliesC[0]).description || "").includes("AURA Khoa"), "reply xác nhận AURA Khoa");

  console.log("== duaura cap ==");
  const json = duauraCmd.data.toJSON();
  const soluong = json.options.find((o) => o.name === "soluong");
  ok(soluong.max_value === 99999999, `duaura max = 99.999.999 (${soluong.max_value})`);

  console.log("== gacha giữ nguyên ==");
  const gacha = client.commands.get("gacha_aura");
  const gj = gacha.data.toJSON();
  const cuoc = gj.options.find((o) => o.name === "cuoc");
  ok(cuoc.min_value === 50 && cuoc.max_value === 1000, "gacha cược vẫn 50–1000 (không đổi)");

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("THROW:", e); process.exit(1); });
