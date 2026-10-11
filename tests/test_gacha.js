// Test /gacha_aura — luật chuỗi thắng (band ↓, thua reset), pity role ×2,
// item pool mythic/bá khí, bonus 200%, vòng bonus +15% (cap 95%), chain 30
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

// ---------- mock ----------
function coll(arr) {
  return {
    length: arr.length,
    get: (id) => arr.find((r) => r.id === id) || null,
    find: (fn) => arr.find(fn) || null,
    has: (id) => arr.some((r) => r.id === id),
    filter: (fn) => coll(arr.filter(fn)),
    keys: () => arr.map((r) => r.id)[Symbol.iterator](),
    values: () => arr.slice(),
    [Symbol.iterator]: () => arr[Symbol.iterator](),
  };
}
const createdRoles = [];
const users = {};
function makeMember(id) {
  const m = {
    id,
    user: { id, tag: id, displayAvatarURL: () => "http://x" },
    permissions: { has: () => true },
    roles: {
      highest: { position: 1 },
      cache: coll([]),
      add: async () => {},
      remove: async () => {},
    },
    timeout: async () => {},
  };
  users[id] = m;
  return m;
}
let rid = 0;
const guild = {
  id: "g1",
  roles: {
    everyone: { id: "everyone" },
    cache: { get: () => null, find: (fn) => createdRoles.find(fn) || null },
    create: async ({ name, colors }) => {
      const r = { id: "rc" + ++rid, name, managed: false, position: 50, color: colors?.primaryColor };
      createdRoles.push(r);
      return r;
    },
  },
  members: {
    me: { id: "bot", permissions: { has: () => true }, roles: { highest: { position: 99 }, cache: coll([]) } },
    cache: coll([]),
    fetch: async (id) => users[id] || null,
  },
  channels: {
    cache: { find: () => null },
    create: async () => ({ id: "ch1", send: async () => ({ id: "m1", edit: async () => ({}) }) }),
  },
};
function ix(userId, options = {}) {
  const member = users[userId];
  member.guild = guild;
  const log = [], replies = [];
  const o = {
    user: member.user, member, guild, guildId: "g1", channelId: "c1",
    replied: false, deferred: false,
    options: {
      getUser: (n) => (options[n] ? { id: options[n] } : null),
      getString: (n) => options[n] ?? null,
      getInteger: (n) => options[n] ?? null,
      getMember: (n) => (options[n] ? member : null),
    },
    reply: async (p) => { log.push("reply"); replies.push(p); o.replied = true; },
    editReply: async (p) => { log.push("editReply"); replies.push(p); },
    followUp: async (p) => { log.push("followUp"); replies.push(p); },
    deferReply: async () => { log.push("defer"); },
    _log: log,
    _replies: replies,
  };
  Object.defineProperty(o, "_last", { get: () => replies[replies.length - 1] });
  return o;
}

// ---------- payload helpers ----------
function dataOf(p) { const e = p?.embeds?.[0]; return e ? (e.data || e) : {}; }
function descOf(p) { return dataOf(p).description || ""; }
function titleOf(p) { return dataOf(p).title || ""; }
function fieldVal(p, name) {
  const f = (dataOf(p).fields || []).find((x) => x.name.includes(name));
  return f ? f.value : "";
}
function allText(p) {
  return descOf(p) + " " + (dataOf(p).fields || []).map((f) => f.value).join(" ");
}

// ---------- load ----------
const items = require(path.join(BOT, "src", "utils", "items.js"));
const inventory = require(path.join(BOT, "src", "utils", "inventory.js"));
const aura = require(path.join(BOT, "src", "utils", "aura.js"));
const game = require(path.join(BOT, "src", "utils", "game.js"));
const { loadCommands } = require(path.join(BOT, "src", "utils", "loader.js"));
const client = { commands: new Map(), prefixCommands: new Map() };
loadCommands(client);
const gacha = client.commands.get("gacha_aura");

console.log("== load ==");
ok(typeof gacha?.execute === "function", "gacha_aura có execute");

// ---------- Math.random có kịch bản ----------
const origRandom = Math.random;
let rnd = [];
Math.random = () => (rnd.length ? rnd.shift() : 1);
function setRnd(arr) { rnd = arr.slice(); }

function setUser(id, opt = {}) {
  const u = aura.gachaMeta(id);
  u.aura = opt.aura ?? 99;
  u.gStreak = opt.gStreak ?? 0;
  u.gPity = opt.gPity ?? 0;
  u.gItem = opt.gItem ?? 0;
  u.gExtra = opt.gExtra ?? 0;
  return u;
}
const bagSum = (uid, rar) =>
  items.ITEMS.filter((i) => i.rarity === rar).reduce((s, i) => s + inventory.bagQty(uid, i.key), 0);

(async () => {
  console.log("== meta normalize ==");
  makeMember("u0");
  const u0 = aura.get("u0");
  delete u0.gStreak;
  ok(aura.gachaMeta("u0").gStreak === 0, "gachaMeta normalize record cũ");
  ok(aura.gachaWinBand(0)[0] === 90 && aura.gachaWinBand(1)[0] === 80, "band 0 → 90, chuỗi 1 → 80");

  // ---- S1: thắng cơ bản, không role/item/extra ----
  console.log("== S1 thắng cơ bản ==");
  makeMember("u1");
  setUser("u1");
  setRnd([0.5, 0.5, 0.99, 0.99, 0.99]); // wc, win, role, item, extra
  let it1 = ix("u1", { cuoc: 50 });
  await gacha.execute(it1);
  ok(rnd.length === 0, "S1 tiêu đúng số random đã cấp");
  ok(titleOf(it1._replies[0]).includes("Đang thi triển"), "S1 có embed cast trước khi quay");
  ok(descOf(it1._replies[0]).includes("hồi chiêu **8s**"), "S1 cast hiển thị cd 8s");
  ok(titleOf(it1._last).includes("LÃI RỒI"), "S1 thắng → title LÃI RỒI");
  ok(descOf(it1._last).includes("THẮNG"), "S1 mô tả có THẮNG");
  ok(aura.get("u1").aura === 179, `S1 aura 99-50+130=179 (${aura.get("u1").aura})`);
  ok(aura.gachaMeta("u1").gStreak === 1, "S1 chuỗi = 1");
  ok(aura.gachaMeta("u1").gPity === 1 && aura.gachaMeta("u1").gItem === 1, "S1 pity/item lên 1 (chưa trúng)");
  ok(aura.gachaMeta("u1").gExtra === 0, "S1 extra = 0");
  ok(game.checkCooldown("g1", "u1", "gacha_aura") > 0, "S1 cooldown đã set");

  // ---- S2: thua → reset chuỗi ----
  console.log("== S2 thua reset chuỗi ==");
  makeMember("u2");
  setUser("u2", { gStreak: 3 });
  setRnd([0.5, 0.95, 0.99, 0.99, 0.99]); // wc band(3)→75, win roll 95 → THUA, role, item, extra
  let it2 = ix("u2", { cuoc: 50 });
  await gacha.execute(it2);
  ok(rnd.length === 0, "S2 tiêu đúng số random");
  ok(descOf(it2._last).includes("THUA"), "S2 mô tả có THUA");
  ok(aura.get("u2").aura === 79, `S2 aura 99-50+30=79 (${aura.get("u2").aura})`);
  ok(aura.gachaMeta("u2").gStreak === 0, "S2 thua → chuỗi reset 0");

  // ---- S3: chuỗi 2 → bonus +20%/lần = 100% ----
  console.log("== S3 bonus chuỗi thắng ==");
  makeMember("u3");
  setUser("u3", { gStreak: 2 });
  setRnd([0.5, 0.5, 0.99, 0.99, 0.99]);
  let it3 = ix("u3", { cuoc: 50 });
  await gacha.execute(it3);
  ok(rnd.length === 0, "S3 tiêu đúng số random");
  ok(aura.get("u3").aura === 199, `S3 aura 99-50+150=199 (bonus 100% = 50) (${aura.get("u3").aura})`);
  ok(fieldVal(it3._last, "Lãi/lỗ").includes("+100"), `S3 lãi +100 (${fieldVal(it3._last, "Lãi/lỗ")})`);
  ok(aura.gachaMeta("u3").gStreak === 3, "S3 chuỗi 2 → 3");

  // ---- S4: pity role 1%×2 → trúng → reset + role + bonus 200% ----
  console.log("== S4 jackpot role ==");
  makeMember("u4");
  setUser("u4", { gPity: 1 }); // rolePct = 2%
  setRnd([0.5, 0.5, 0.01, 0.99, 0.99]); // wc, win, role HIT, item, extra
  let it4 = ix("u4", { cuoc: 50 });
  await gacha.execute(it4);
  ok(rnd.length === 0, "S4 tiêu đúng số random");
  ok(descOf(it4._last).includes("ROLE JACKPOT"), "S4 embed có ROLE JACKPOT");
  ok(aura.gachaMeta("u4").gPity === 0, "S4 trúng role → pity reset 0");
  ok(aura.get("u4").aura === 279, `S4 aura 99-50+130+100=279 (${aura.get("u4").aura})`);
  ok(fieldVal(it4._last, "Lãi/lỗ").includes("+180"), `S4 lãi +180 (${fieldVal(it4._last, "Lãi/lỗ")})`);
  ok(createdRoles.length === 1 && createdRoles[0].name === "🎰 GACHA JACKPOT", "S4 tạo đúng 1 role JACKPOT");

  // ---- S5: vật phẩm pool mythic/bá khí, pity item reset, bonus 200% ----
  console.log("== S5 vật phẩm ==");
  makeMember("u5");
  setUser("u5", { gItem: 3 }); // itemPct = 80%
  setRnd([0.5, 0.5, 0.99, 0.01, 0.99, 0.99, 0.99]); // wc, win, role, item HIT, baky-check→mythical, pick, extra
  let it5 = ix("u5", { cuoc: 50 });
  await gacha.execute(it5);
  ok(rnd.length === 0, "S5 tiêu đúng số random");
  ok(descOf(it5._last).includes("🎁"), "S5 embed có 🎁 vật phẩm");
  ok(aura.gachaMeta("u5").gItem === 0, "S5 trúng item → pity item reset 0");
  ok(aura.gachaMeta("u5").gPity === 1, "S5 role trượt → pity role lên 1");
  ok(bagSum("u5", "mythical") + bagSum("u5", "baky") === 1, "S5 nhận đúng 1 item trong pool mythic/bá khí");
  ok(bagSum("u5", "legendary") + bagSum("u5", "rare") === 0, "S5 legend trở xuống KHÔNG rơi");
  ok(aura.get("u5").aura === 279, `S5 aura 99-50+130+100=279 (${aura.get("u5").aura})`);

  // ---- S6: vòng bonus (2 vòng), +15% extra ----
  console.log("== S6 vòng bonus ==");
  makeMember("u6");
  setUser("u6");
  setRnd([
    0.5, 0.5, 0.99, 0.99, 0.01,   // vòng1: wc, win, role, item, extra HIT
    0.5, 0.5, 0.99, 0.99, 0.99,   // vòng2: wc(85), win, role, item, extra stop
  ]);
  let it6 = ix("u6", { cuoc: 50 });
  await gacha.execute(it6);
  ok(rnd.length === 0, "S6 tiêu đúng số random");
  ok(descOf(it6._last).includes("**2.**"), "S6 có dòng vòng 2");
  ok(aura.get("u6").aura === 317, `S6 aura 99-50+130+138=317 (${aura.get("u6").aura})`);
  ok(aura.gachaMeta("u6").gStreak === 2, "S6 chuỗi = 2 (2 vòng thắng)");
  ok(aura.gachaMeta("u6").gExtra === 1, "S6 extra kích hoạt 1 lần");
  ok(fieldVal(it6._last, "Tiến trình").includes("Vòng bonus **50%**"), "S6 extra% kế tiếp = 50%");

  // ---- S7: toàn thắng liên tục 0.0 → chain tới cap 30 ----
  console.log("== S7 chain cap 30 ==");
  makeMember("u7");
  setUser("u7");
  setRnd(Array(210).fill(0)); // 6 call vòng1 + 7 call × 29 vòng (derive+win+role+item+baky+pick+extra)
  let it7 = ix("u7", { cuoc: 50 });
  await gacha.execute(it7);
  ok(rnd.length === 0, `S7 chain dừng ở 30 vòng, tiêu hết random (${rnd.length} sót)`);
  ok(allText(it7._last).includes("**30.**"), "S7 có dòng vòng 30");
  ok(allText(it7._last).includes("giới hạn **30**"), "S7 có dòng cảnh báo cap 30");
  ok(aura.gachaMeta("u7").gExtra === 30, "S7 extra tích 30 trạng thái");
  ok(createdRoles.length === 1, "S7 chỉ tạo role 1 lần (tìm lại role cũ)");

  const total = aura.get("u7").aura;
  ok(total > 99, `S7 aura tăng sau chuỗi thắng (${total})`);

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("THROW:", e); process.exit(1); });

// ---- RESTORE ----
process.on("exit", () => {
  Math.random = origRandom;
  for (const f of FILES) {
    const p = path.join(DATA, f);
    if (backup[f] !== undefined) fs.writeFileSync(p, backup[f]);
    else if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});
