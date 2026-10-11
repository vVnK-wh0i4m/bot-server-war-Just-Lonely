const path = require("path");
const BOT = path.resolve(__dirname, "..");
const fs = require("fs");
const assert = require("assert");

const GAME_JSON = path.join(BOT, "data\\game.json");
let original = null;
try { original = fs.readFileSync(GAME_JSON, "utf8"); } catch { original = null; }

const game = require(path.join(BOT, "src\\utils\\game.js"));

// Đăng ký SAU require → chạy sau flush của game.js, trả data thật về
process.on("exit", () => {
  try {
    if (original !== null) fs.writeFileSync(GAME_JSON, original);
    else if (fs.existsSync(GAME_JSON)) fs.unlinkSync(GAME_JSON);
  } catch { /* bỏ qua */ }
});

const cmd = require(path.join(BOT, "src\\commands\\game\\danhsachloli.js"));

let passed = 0;
function ok(cond, msg) {
  if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; return; }
  passed++;
}

// ---- 1. execute với dữ liệu giả ----
const now = Date.now();
const recs = [
  { userId: "111111111111111111", ownerId: "me", until: now + 5 * 60000, minutes: 30, channelId: "c1", force: true },
  { userId: "222222222222222222", ownerId: "me", until: now + 30 * 60000, minutes: 30, channelId: "c1", force: false },
];
game.possessionsBy = (gid, oid) => recs.filter((r) => r.ownerId === oid);
game.effectiveSlots = () => 8;
game.prisonOf = (gid, uid) =>
  uid === "111111111111111111" ? { until: now + 3 * 60000, attempts: 2, jailerId: "me" } : null;
game.statusLines = (gid, uid) => [
  "🚪 **Đang bị sở hữu** bởi <@me> (30 phút)",
  uid === "222222222222222222" ? "⚡ **Bị khống chế (cc)** (12 giây)" : "⚡ **Bị khống chế (cc)** (5 giây)",
];
let errCalled = null;
game.replyErr = async (it, title, desc) => { errCalled = { title, desc }; return null; };

function fakeInteraction({ guild = true } = {}) {
  const it = {
    guild: guild
      ? { id: "g1", members: { fetch: async (id) => ({ displayName: "NạnNhân" + id.slice(-1) }) } }
      : null,
    user: { id: "me", username: "tester", displayAvatarURL: () => "https://x/a.png" },
    deferred: false,
    replied: false,
    replyPayload: null,
  };
  it.reply = async (payload) => { it.replied = true; it.replyPayload = payload; return payload; };
  return it;
}

(async () => {
  // full list
  const it1 = fakeInteraction();
  await cmd.execute(it1);
  ok(it1.replied, "phải reply");
  const embed = it1.replyPayload.embeds[0];
  const title = embed.data.title;
  ok(title.includes("DANH SÁCH ĐÃ BẮC"), "title đúng: " + title);
  const desc = embed.data.description;
  ok(desc.length < 4096, "desc không tràn: " + desc.length);
  ok(desc.includes("⚔️ bắt ép"), "có dấu force");
  ok(desc.includes("hầm"), "có thông tin hầm");
  ok(desc.includes("NạnNhân1"), "dùng displayName");
  ok(/<t:\d+:R>/.test(desc) && /<t:\d+:T>/.test(desc), "có timestamp");
  ok(desc.indexOf("NạnNhân1") < desc.indexOf("NạnNhân2"), "sắp xếp tới hạn sớm trước");
  const field = embed.data.fields[0];
  ok(field.value.includes("2/8"), "field slot 2/8: " + field.value);
  ok(field.value.includes("NạnNhân1"), "field sắp hết = người tới hạn sớm");
  ok(it1.replyPayload.content === "<@me>", "ping self");

  // list rỗng
  game.possessionsBy = () => [];
  errCalled = null;
  await cmd.execute(fakeInteraction());
  ok(errCalled && errCalled.title.includes("TRỐNG"), "rỗng → replyErr: " + JSON.stringify(errCalled));

  // không có guild
  errCalled = null;
  await cmd.execute(fakeInteraction({ guild: false }));
  ok(errCalled && errCalled.title.includes("server"), "DM → replyErr server: " + JSON.stringify(errCalled));

  // ---- 2. phân loại auto-delete: đọc pattern THẬT từ source ----
  const src = fs.readFileSync(path.join(BOT, "src\\discord-bot.js"), "utf8");
  const m = src.match(/const FAST_TITLES = \[([\s\S]*?)\];/);
  ok(m, "tìm thấy FAST_TITLES trong source");
  const FAST_TITLES = eval("[" + m[1] + "]");
  const isFast = (t) => FAST_TITLES.some((re) => re.test(t));

  const fastTitles = [
    "🔊 HẾT KHỐNG CHẾ!",
    "🎭 PHỤC HỒI ROLE!",
    "⏳ SẮP HẾT SỞ HỮU",
    "⏳ SẮP THOÁT NGỤC",
    "⏳ SẮP HẾT PHẠT",
    "💘 HẾT HẠN SỞ HỮU",
    "🔓 ĐƯỢC THA",
  ];
  const slowTitles = [
    "🦹 BẮT CÓC THÀNH CÔNG!",
    "🙈 BẮT CÓC THẤT BẠI",
    "💨 NÉ ĐƯỢC!",
    "⚡ CHÍCH ĐIỆN!",
    "🕳️ XUỐNG TẦNG HẦM!",
    "💪 LÊU LÊU CAY!",
    "🪙 NGỬA! THẮNG RỒI!",
    "🪙 SẤP! MẤT RỒI!",
    "🎬 Đang thi triển...",
    "🏃 THOÁT THÀNH CÔNG!",
    "💰 MUA TỰ DO!",
    "🎁 MỞ HỘP QUÀ",
    "📦 RƯƠNG AURA MỞ RA!",
    "📜 DANH SÁCH ĐÃ BẮC — tester",
    "🧠 AURA — tester",
    "🍀 SAO MAY MẮN RƠI XUỐNG!",
    "💘 HẾT HẠN SỞ HỮU!", // có ! cuối — vẫn match (muốn fast)
  ];
  for (const t of fastTitles) ok(isFast(t), "FAST (15s): " + t);
  for (const t of slowTitles.filter((t) => !t.includes("HẾT HẠN SỞ HỮU"))) {
    ok(!isFast(t), "SLOW (30p): " + t);
  }
  ok(isFast("💘 HẾT HẠN SỞ HỮU!"), "FAST (15s): có gạch cuối");

  const fast = src.includes("AUTO_DELETE_FAST_MS = 15000");
  const slow = src.includes("AUTO_DELETE_MS = 30 * 60 * 1000");
  ok(fast, "delay 15s trong source");
  ok(slow, "delay 30p trong source");
  ok(!src.includes("message.components?.length) return"), "bỏ luật giữ component cũ");

  console.log(`PASS ${passed} assertions`);
})().catch((e) => {
  console.error("ERROR:", e);
  process.exitCode = 1;
});
