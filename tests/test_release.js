const fs = require("fs");
const path = require("path");
const BOT = path.resolve(__dirname, "..");
const assert = require("assert");
const { ChannelType } = require("discord.js");

const DATA = path.join(BOT, "data");
const FILES = ["game.json", "aura.json", "inventory.json"];
const backups = {};
for (const f of FILES) {
  try {
    backups[f] = fs.readFileSync(path.join(DATA, f), "utf8");
  } catch { /* chưa có file */ }
}
// Ghi dữ liệu test rỗng
fs.writeFileSync(path.join(DATA, "game.json"), JSON.stringify({ possessions: {}, prisons: {}, effects: [], cooldowns: {} }));
fs.writeFileSync(path.join(DATA, "aura.json"), JSON.stringify({}));

let passed = 0;
function ok(cond, msg) {
  if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; return; }
  passed++;
}

// ---------- fake Discord ----------
function cacheOf(arr) {
  const m = new Map(arr.map((x) => [x.id, x]));
  m.find = (fn) => arr.find(fn);
  return m;
}
const rolePossessed = { id: "r_poss", name: "Bị Sở Hữu", managed: false, position: 5 };
const roleOwner = { id: "r_owner", name: "👑 Chủ Chiếm", managed: false, position: 6 };
const members = new Map();
function mkMember(id) {
  return {
    id,
    guild: null,
    roles: { cache: new Map(), add: async () => {}, remove: async () => {} },
  };
}
const guild = {
  id: "g1",
  roles: {
    everyone: { id: "r_everyone" },
    cache: cacheOf([rolePossessed, roleOwner]),
    create: async () => { throw new Error("roles.create khong duoc goi"); },
  },
  members: {
    me: { id: "bot1", permissions: { has: () => false }, roles: { highest: { position: 99 } } },
    fetch: async (id) => {
      if (!members.has(id)) members.set(id, mkMember(id));
      const m = members.get(id);
      m.guild = guild;
      return m;
    },
  },
  channels: { cache: cacheOf([]), fetch: async () => null },
  stickers: { cache: { first: () => undefined } },
};
const fakeClient = {
  user: { id: "bot1" },
  channels: { cache: new Map(), fetch: async () => null },
  guilds: { cache: new Map([["g1", guild]]) },
};

// ---------- require SAU khi ghi file test ----------
const game = require(path.join(BOT, "src\\utils\\game.js"));
const aura = require(path.join(BOT, "src\\utils\\aura.js"));
const cmd = require(path.join(BOT, "src\\commands\\game\\danhsachloli.js"));

// Restore SAU khi các module flush (đăng ký sau → chạy sau)
process.on("exit", () => {
  for (const f of FILES) {
    const p = path.join(DATA, f);
    try {
      if (backups[f] != null) fs.writeFileSync(p, backups[f]);
      else if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch { /* bỏ qua */ }
  }
});

game.start(fakeClient);

(async () => {
  // Seed
  aura.credit("p1", 500);
  aura.credit("p2", 300);
  await game.possess({ guild, ownerId: "owner1", targetId: "p1", minutes: 10, channelId: "cell1" });
  await game.possess({ guild, ownerId: "owner1", targetId: "p2", minutes: 5, channelId: "cell1" });

  // 1. execute → embed + select menu
  let execPayload = null;
  await cmd.execute({
    guild,
    user: { id: "owner1", username: "Owner", displayAvatarURL: () => "http://x/a.png" },
    reply: async (p) => { execPayload = p; return p; },
  });
  ok(execPayload, "execute trả payload");
  const rowJson = execPayload.components?.[0]?.toJSON();
  const select = rowJson?.components?.[0];
  ok(select?.custom_id === "danhsachloli_release", "có select danhsachloli_release: " + select?.custom_id);
  ok(select?.options?.length === 2, "select đủ 2 tùy chọn: " + select?.options?.length);
  ok(select.options.some((o) => o.value === "p1") && select.options.some((o) => o.value === "p2"), "options = userId");
  ok(execPayload.content.includes("<@owner1>"), "tag tên người gọi");

  // 2. chủ bỏ sở hữu p1 → mất record, p1 được bù 100–500
  const before = aura.get("p1").aura;
  let updated = null;
  await cmd.onComponent({
    customId: "danhsachloli_release",
    values: ["p1"],
    user: { id: "owner1" },
    guild,
    update: async (p) => { updated = p; return p; },
    reply: async (p) => { updated = p; return p; },
  }, fakeClient);
  ok(!game.possessionOf("g1", "p1"), "p1 đã hết sở hữu");
  const gift = aura.get("p1").aura - before;
  ok(gift >= 100 && gift <= 500, `gift trong 100-500 (thực tế ${gift})`);
  ok(updated?.content?.includes("<@p1>") && updated.content.includes("<@owner1>"), "content tag 2 tên như bắt cóc");
  ok(updated?.embeds?.[0]?.data?.image?.url === "attachment://bosohuu.gif", "gif gắn vào embed: " + updated?.embeds?.[0]?.data?.image?.url);
  ok(updated?.files?.length === 1, "file gif đính kèm");
  ok(updated.embeds[0].data.title.includes("BỎ SỞ HỮU"), "tiêu đề đúng");
  ok(updated.embeds[0].data.description.includes("còn **1**"), "còn 1 người trong danh sách");
  ok(game.possessionOf("g1", "p2"), "p2 vẫn bị giữ");

  // 3. người lạ không bỏ được của người khác
  let strangerResp = null;
  await cmd.onComponent({
    customId: "danhsachloli_release",
    values: ["p2"],
    user: { id: "stranger" },
    guild,
    update: async (p) => { strangerResp = p; return p; },
    reply: async (p) => { strangerResp = p; return p; },
  }, fakeClient);
  ok(game.possessionOf("g1", "p2"), "người lạ không bỏ được");
  ok(strangerResp?.ephemeral === true, "phản hồi ephemeral cho người lạ");

  // 4. chủ bỏ nốt p2 → danh sách trống
  const before2 = aura.get("p2").aura;
  await cmd.onComponent({
    customId: "danhsachloli_release",
    values: ["p2"],
    user: { id: "owner1" },
    guild,
    update: async (p) => { updated = p; return p; },
    reply: async (p) => { updated = p; return p; },
  }, fakeClient);
  ok(!game.possessionOf("g1", "p2"), "p2 đã hết sở hữu");
  const gift2 = aura.get("p2").aura - before2;
  ok(gift2 >= 100 && gift2 <= 500, `gift p2 trong 100-500 (thực tế ${gift2})`);
  ok(updated.embeds[0].data.description.includes("Danh sách trống"), "thông báo danh sách trống");

  // 5. routing: COMPONENT_OWNERS có danhsachloli
  const src = fs.readFileSync(path.join(BOT, "src\\discord-bot.js"), "utf8");
  ok(src.includes('danhsachloli: "danhsachloli"'), "đăng ký COMPONENT_OWNERS");

  // 6. gif đã lưu local (không dùng link CDN hết hạn)
  ok(fs.existsSync(path.join(BOT, "assets\\img\\bosohuu.gif")), "bosohuu.gif tồn tại local");

  console.log(`PASS ${passed} assertions`);
})().catch((e) => {
  console.error("ERROR:", e);
  process.exitCode = 1;
});
