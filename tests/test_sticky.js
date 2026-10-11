const fs = require("fs");
const path = require("path");
const BOT = path.resolve(__dirname, "..");
const assert = require("assert");
const { ChannelType } = require("discord.js");

const GAME_JSON = path.join(BOT, "data\\game.json");
let original = null;
let hadOriginal = false;
try {
  original = fs.readFileSync(GAME_JSON, "utf8");
  hadOriginal = true;
} catch { hadOriginal = false; }

// Ghi marker phân biệt — chỉ restore khi file HIỆN TẠI là trạng thái test của mình
const MARK = '"channelId":"cell1"';
fs.writeFileSync(GAME_JSON, JSON.stringify({ possessions: {}, prisons: {}, effects: [], cooldowns: {} }));

let passed = 0;
function ok(cond, msg) {
  if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; return; }
  passed++;
}

// ---------- fake Discord ----------
const deleted = [];
const sends = [];
let msgSeq = 0;
const msgStore = new Map();

function makeMsg(id) {
  const m = {
    id,
    delete: async () => { deleted.push(id); },
    edit: async () => {},
  };
  msgStore.set(id, m);
  return m;
}

const cell = {
  id: "cell1",
  name: "tang-ham-loli",
  type: ChannelType.GuildText,
  permissionOverwrites: { set: async () => {}, edit: async () => {}, delete: async () => {} },
  isTextBased: () => true,
  send: async (payload) => {
    sends.push(payload);
    return makeMsg("msg" + (++msgSeq));
  },
  messages: { fetch: async (id) => msgStore.get(id) || null },
};
const category = {
  id: "cat1",
  name: "🎸 Tầng Hầm — AURA",
  type: ChannelType.GuildCategory,
  permissionOverwrites: { edit: async () => {} },
};

function cacheOf(arr) {
  const m = new Map(arr.map((x) => [x.id, x]));
  m.find = (fn) => arr.find(fn);
  return m;
}
const channelArr = [category, cell];
const role = { id: "r_prisoner", name: "Tù Nhân Tầng Hầm", managed: false, position: 1 };

const members = new Map();
function mkMember(id) {
  return {
    id,
    guild: null, // gán sau
    roles: { cache: new Map(), add: async () => {}, remove: async () => {} },
  };
}
const guild = {
  id: "g1",
  roles: {
    everyone: { id: "r_everyone" },
    cache: cacheOf([role]),
    create: async () => { throw new Error("roles.create khong duoc goi"); },
  },
  members: {
    me: {
      id: "bot1",
      permissions: { has: () => true },
      roles: { highest: { position: 99 }, cache: new Map(), add: async () => {}, remove: async () => {} },
    },
    fetch: async (id) => {
      if (!members.has(id)) members.set(id, mkMember(id));
      const m = members.get(id);
      m.guild = guild;
      return m;
    },
  },
  channels: {
    cache: cacheOf(channelArr),
    fetch: async (id) => channelArr.find((c) => c.id === id) || null,
    create: async () => { throw new Error("channels.create khong duoc goi (dung lai o co san)"); },
  },
  stickers: { cache: { first: () => undefined } },
};

const fakeClient = {
  user: { id: "bot1" },
  channels: {
    cache: new Map([["cell1", cell]]),
    fetch: async (id) => (id === "cell1" ? cell : null),
  },
  guilds: { cache: new Map() },
};

// ---------- chạy ----------
const game = require(path.join(BOT, "src\\utils\\game.js"));

// Đăng ký SAU require → chạy sau flush của game.js (exit listeners chạy theo thứ tự thêm)
process.on("exit", () => {
  try {
    if (hadOriginal) fs.writeFileSync(GAME_JSON, original);
    else if (fs.existsSync(GAME_JSON)) fs.unlinkSync(GAME_JSON);
  } catch { /* bỏ qua */ }
});

game.start(fakeClient);

(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const flush = () => sleep(2700); // sticky debounce 2500ms

  // 1. nhốt → ticket đầu tiên
  const res = await game.imprison({
    guild, jailerId: "j1", prisonerId: "p1", minutes: 10, chance: 25,
    channelId: "origin1", announce: false,
  });
  ok(res.ok, "imprison ok: " + (res.reason || ""));
  let rec = game.prisonOf("g1", "p1");
  ok(rec, "có record tù");
  ok(rec.messageId === "msg1", "ticket đầu = msg1: " + rec.messageId);
  ok(sends.length === 1, "gửi đúng 1 lần");
  ok(sends[0].components?.[0]?.components?.[0]?.data.custom_id === "tronthoat_try", "ticket có nút 🏃");
  ok(sends[0].embeds[0].data.title.includes("TẦNG HẦM"), "ticket embed đúng title");

  // 2. người nhắn tin mới → sticky (debounce): xóa ticket cũ, gửi lại
  await game.refreshSticky("g1", "cell1", "USERMSG1");
  await flush();
  ok(deleted.includes("msg1"), "ticket cũ msg1 bị xóa");
  ok(sends.length === 2, "gửi lại 1 bản: " + sends.length);
  rec = game.prisonOf("g1", "p1");
  ok(rec.messageId === "msg2", "messageId cập nhật → msg2: " + rec.messageId);
  ok(sends[1].components?.[0]?.components?.[0]?.data.custom_id === "tronthoat_try", "bản gửi lại vẫn có nút");
  ok(sends[1].embeds[0].data.title.includes("TẦNG HẦM"), "bản gửi lại đúng embed");

  // 3. incoming CHÍNH ticket → không đụng gì
  const s = sends.length, d = deleted.length;
  await game.refreshSticky("g1", "cell1", rec.messageId);
  await flush();
  ok(sends.length === s && deleted.length === d, "tin từ chính ticket → không bump");

  // 4. kênh khác → không đụng
  await game.refreshSticky("g1", "other1", "X");
  await flush();
  ok(sends.length === s && deleted.length === d, "kênh khác → không bump");

  // 5. bot nhắn (kết quả game) → cũng bump
  await game.refreshSticky("g1", "cell1", "BOTREPLY1");
  await flush();
  ok(sends.length === s + 1, "bot reply → bump");
  rec = game.prisonOf("g1", "p1");
  ok(rec.messageId === "msg3", "messageId → msg3: " + rec.messageId);
  ok(deleted.includes("msg2"), "msg2 cũ bị xóa khi bump");

  // 6. hết tù → ticket bị xóa hẳn (chỉ freePrison được xóa)
  await game.freePrison(guild, "p1", { announce: false });
  ok(deleted.includes("msg3"), "ticket cuối msg3 bị xóa khi hết tù");
  ok(!game.prisonOf("g1", "p1"), "record tù biến mất");
  const s2 = sends.length;
  await game.refreshSticky("g1", "cell1", "AFTERFREE");
  await flush();
  ok(sends.length === s2, "sau khi hết tù → không hồi sinh ticket");

  // 6b. debounce: 3 tin liên tiếp trong 1.5s → chỉ bump MỘT lần khi im ắng
  await game.imprison({
    guild, jailerId: "j2", prisonerId: "p9", minutes: 5, chance: 25,
    channelId: "origin9", announce: false,
  });
  const base = sends.length;
  await game.refreshSticky("g1", "cell1", "B1");
  await sleep(500);
  await game.refreshSticky("g1", "cell1", "B2");
  await sleep(500);
  await game.refreshSticky("g1", "cell1", "B3");
  await flush();
  ok(sends.length === base + 1, `3 tin liên tiếp → đúng 1 lần bump (thực tế ${sends.length - base})`);

  // 6c. incoming là ticket THẬT (race id chưa ghi) → nhận id, không xóa/gửi lại
  const recB = game.prisonOf("g1", "p9");
  ok(recB && recB.messageId, "p9 có messageId trước adopt");
  const raceTicket = {
    id: "TICKETRACE",
    author: { id: "bot1" },
    components: [{ components: [{ customId: "tronthoat_try" }] }],
    delete: async () => { deleted.push("TICKETRACE"); },
  };
  msgStore.set("TICKETRACE", raceTicket);
  const sC = sends.length, dC = deleted.length;
  await game.refreshSticky("g1", "cell1", "TICKETRACE");
  await flush();
  ok(sends.length === sC && deleted.length === dC, "incoming là ticket → không bump");
  ok(game.prisonOf("g1", "p9")?.messageId === "TICKETRACE", "adopt id TICKETRACE");

  await game.freePrison(guild, "p9", { announce: false });

  // 7. source discord-bot.js: sticky chạy TRƯỚC guard bot + ticket miễn auto-delete
  const src = fs.readFileSync(path.join(BOT, "src\\discord-bot.js"), "utf8");
  const iSticky = src.indexOf("game.refreshSticky(");
  const iBotGuard = src.indexOf("if (message.author.bot) return;");
  ok(iSticky > -1 && iBotGuard > -1 && iSticky < iBotGuard, "sticky gọi trước khi bỏ qua bot");
  ok(src.includes('c.customId?.startsWith("tronthoat_")'), "ticket exempt auto-delete");
  ok(!/if \(message\.components\?\.length\) return;/.test(src), "bỏ luật giữ component cũ");

  console.log(`PASS ${passed} assertions`);
})().catch((e) => {
  console.error("ERROR:", e);
  process.exitCode = 1;
});
