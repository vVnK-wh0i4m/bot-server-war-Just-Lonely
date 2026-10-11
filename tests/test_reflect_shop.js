// Test reflect + shop + effects wiring — BACKUP/RESTORE data toàn bộ
const fs = require("fs");
const path = require("path");

const BOT = path.resolve(__dirname, "..");
const DATA = path.join(BOT, "data");
const FILES = ["shop.json", "inventory.json", "aura.json", "game.json"];
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

// Xóa shop.json để restock fresh
const shopFile = path.join(DATA, "shop.json");
if (fs.existsSync(shopFile)) fs.unlinkSync(shopFile);

const items = require(path.join(BOT, "src", "utils", "items.js"));
const inventory = require(path.join(BOT, "src", "utils", "inventory.js"));
const aura = require(path.join(BOT, "src", "utils", "aura.js"));
const shop = require(path.join(BOT, "src", "utils", "shop.js"));
const game = require(path.join(BOT, "src", "utils", "game.js"));
const tuidoCmd = require(path.join(BOT, "src", "commands", "game", "tuido.js"));
const cuopCmd = require(path.join(BOT, "src", "commands", "game", "cuopaura.js"));

console.log("== load modules ==");
ok(typeof tuidoCmd.onComponent === "function", "tuido có onComponent");
ok(typeof cuopCmd.execute === "function", "cuopaura có execute");
ok(items.get("bk_aura500").effect === "reflect", "Hỗn Mang effect = reflect");
ok(items.get("bk_aura500").price === 15000, "Hỗn Mang giá 15000");

console.log("== shop genStock ==");
for (let i = 0; i < 50; i++) {
  shop.restock();
  const st = { items: null };
  // restock bỏ qua nếu chưa đủ 90s — gọi genStock qua render
  const payload = shop.render(0);
  const list = payload.embeds;
  break;
}
// ép gen mới: đọc qua render lần đầu sau khi xóa file
const p1 = shop.render(0);
ok(Array.isArray(p1.embeds) && p1.embeds.length === 1, "render có 1 embed");
// Số món: kiểm bằng getInfo
const info = shop.getInfo("tester");
const infoStr = JSON.stringify(info.data);
ok(infoStr.includes("0.001%"), "getInfo có thông tin 0.001%");

console.log("== inventory reflect ==");
inventory.addItem("u1", "bk_aura500", 1);
ok(inventory.hasReflect("u1") === true, "hasReflect khi có item");
let used = 0;
for (let i = 0; i < 25; i++) if (inventory.useReflect("u1")) used++;
ok(used === 20, `useReflect giới hạn 20/ngày (thực tế ${used})`);
ok(inventory.hasReflect("u1") === false, "hasReflect = false sau 20 lần");
ok(inventory.bagQty("u1", "bk_aura500") === 1, "reflect không tiêu item");
inventory.removeItem("u1", "bk_aura500", 1);
ok(inventory.hasReflect("u1") === false, "không item → không reflect");

console.log("== shield ==");
inventory.setShield("u2", "cc", 5);
ok(inventory.isShielded("u2", "cc") === true, "isShielded cc");
ok(inventory.isShielded("u2", "capture") === false, "shield cc không chặn capture");
inventory.setShield("u3", "all", 5);
ok(inventory.isShielded("u3", "capture") && inventory.isShielded("u3", "cc"), "shield all chặn cả hai");

console.log("== streak saver ==");
aura.get("u4").streak = 5;
inventory.setStreakSaver("u4");
aura.resetStreak("u4");
ok(aura.get("u4").streak === 5, "bùa giữ chuỗi: streak giữ nguyên");
aura.resetStreak("u4");
ok(aura.get("u4").streak === 0, "bùa dùng hết → reset bình thường");

console.log("== luck pop ==");
inventory.setLuck("u5", 10);
const c1 = game.hitChance(50, 0, 25, "u5");
const c2 = game.hitChance(50, 0, 25, "u5");
ok(c1 === 60, `luck +10% áp 1 lần (${c1})`);
ok(c2 === 50, `luck hết → bình thường (${c2})`);

console.log("== cooldown reset ==");
game.setCooldown("g1", "u6", "chichdien");
ok(game.checkCooldown("g1", "u6", "chichdien") > 0, "cooldown đã set");
const n = game.clearCooldowns("g1", "u6");
ok(n >= 1 && game.checkCooldown("g1", "u6", "chichdien") === 0, `clearCooldowns xóa ${n} bản ghi`);

console.log("== slot bonus ==");
const baseSlots = aura.slotsFor(aura.get("u7").aura);
inventory.setSlotBonus("u7", 3, 30);
ok(game.effectiveSlots("u7") === baseSlots + 3, `effectiveSlots = base+3 (${game.effectiveSlots("u7")})`);

console.log("== double drop ==");
inventory.setDoubleDrop("u8");
ok(inventory.popDoubleDrop("u8") === true, "popDoubleDrop true");
ok(inventory.popDoubleDrop("u8") === false, "dùng 1 lần rồi mất");

console.log("== gacha formula (streak band + bonus) ==");
ok(aura.gachaWinBand(0)[0] === 90 && aura.gachaWinBand(0)[1] === 90, "chuỗi 0 → 90% cố định");
ok(aura.gachaWinBand(1)[0] === 80, "chuỗi 1 → band 80–90");
ok(aura.gachaWinBand(5)[0] === 40, "chuỗi 5 → band 40–90");
ok(aura.gachaWinBand(9)[0] === 0 && aura.gachaWinBand(12)[0] === 0, "chuỗi ≥9 → sàn 0%");
ok(aura.gachaBonusPct(0, 0) === 60, "bonus chuỗi 0, immunity 0 → 60%");
ok(aura.gachaBonusPct(3, 0) === 120, "bonus +20%/lần (chuỗi 3 → 120%)");
ok(aura.gachaBonusPct(0, 60) === 0, "immunity 60 → bonus 0%");
ok(aura.gachaBonusPct(2, 60) === 40, "immunity 60 + chuỗi 2 → bonus 40%");

console.log("== cuopaura formula (replicate) ==");
function steal(targetAura, invokerAura) {
  let chance = 5 + Math.round((1 - Math.min(targetAura, 4000) / 4000) * 45);
  if (invokerAura >= 3000) chance = Math.max(2, Math.round(chance * 0.6));
  return chance;
}
ok(steal(0, 100) === 50, "target 0 aura → 50%");
ok(steal(4000, 100) === 5, "target 4000+ → 5%");
ok(steal(2000, 100) === 28 || steal(2000, 100) === 27, `target 2000 → ~27-28 (${steal(2000, 100)})`);
ok(steal(0, 5000) === 30, "kẻ giàu aura 5000 ×0.6 → 30%");

console.log("== transfer 100% ==");
aura.get("u9").aura = 123;
aura.get("u10").aura = 0;
const tr = aura.transfer("u9", "u10", 123);
ok(tr.ok && aura.get("u9").aura === 0 && aura.get("u10").aura === 123, "transfer cướp 100%");

// ---- RESTORE ----
process.on("exit", () => {
  for (const f of FILES) {
    const p = path.join(DATA, f);
    if (backup[f] !== undefined) fs.writeFileSync(p, backup[f]);
    else if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});
console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
