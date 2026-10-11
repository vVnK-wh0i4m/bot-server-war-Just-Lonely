const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const aura = require("./aura");
const items = require("./items");
const inventory = require("./inventory");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "shop.json");

const RESTOCK_MS = 90000; // restock mỗi 1 phút 30 giây
const PAGE_SIZE = 10;     // gọn hơn 15 → đỡ rối mắt
const STOCK_SIZE = 5;     // mỗi lần restock chỉ mở 5 món ngẫu nhiên
const BAKY_CHANCE = 0.00001; // ❕ Bá Khí spawn 0.001% cho MỖI ô

// weight = tỉ lệ chọn item của rarity đó khi quay 5 ô (❕ đặc biệt: 0.001%/ô)
const RARITIES = [
  { key: "trash", emoji: "⚪", name: "Trash", weight: 20, qty: [1, 30], price: 1, color: 0x95a5a6 },
  { key: "common", emoji: "🟢", name: "Common", weight: 22, qty: [1, 30], price: 5, color: 0x2ecc71 },
  { key: "rare", emoji: "🔵", name: "Rare", weight: 25, qty: [1, 30], price: 20, color: 0x3498db },
  { key: "legendary", emoji: "🟡", name: "Legendary", weight: 14, qty: [1, 30], price: 80, color: 0xf1c40f },
  { key: "mythical", emoji: "🔴", name: "Mythical", weight: 8, qty: [1, 30], price: 200, color: 0xe74c3c },
  { key: "baky", emoji: "❕", name: "Bá Khí", weight: 0, qty: [1, 30], price: 500, color: 0xe91e63 },
];
const RARITY = Object.fromEntries(RARITIES.map((r) => [r.key, r]));
const DISPLAY_ORDER = [...RARITIES].reverse(); // hiếm trước
const NORMAL_RARITIES = RARITIES.filter((r) => r.key !== "baky");

let stock = null;
let saveTimer = null;
let botClient = null;
const views = new Map();
const pages = new Map();

function setClient(c) {
  botClient = c;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      if (parsed && Array.isArray(parsed.items)) stock = parsed;
    }
  } catch (err) {
    logger.warn(`shop load failed: ${err.message}`);
    stock = null;
  }
}

function flush() {
  try {
    if (!stock) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(stock));
  } catch (err) {
    logger.error(`shop save failed: ${err.message}`);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}

// Mỗi lần stock = 5 ô, mỗi ô quay 1 lần: 0.001% ra ❕, còn lại theo weight;
// qty random 1-30 theo rarity, giá lấy từ item (mặc định theo rarity)
function pickRarity() {
  if (Math.random() < BAKY_CHANCE) return RARITY.baky;
  const total = NORMAL_RARITIES.reduce((s, r) => s + r.weight, 0);
  let x = Math.random() * total;
  for (const r of NORMAL_RARITIES) {
    if ((x -= r.weight) <= 0) return r;
  }
  return NORMAL_RARITIES[0];
}

function genStock(tag) {
  const picked = new Set();
  const result = [];
  for (let i = 1; i <= STOCK_SIZE; i++) {
    let r = pickRarity();
    let pool = items.RARITY_TABLE[r.key] || [];
    if (!pool.length) {
      r = RARITY.trash;
      pool = items.RARITY_TABLE.trash || [];
    }
    if (!pool.length) continue;
    // tránh trùng item trong cùng 1 lần stock (8 lần thử, trùng thì thôi)
    let it = pool[Math.floor(Math.random() * pool.length)];
    for (let t = 0; t < 8 && picked.has(it.key); t++) {
      it = pool[Math.floor(Math.random() * pool.length)];
    }
    picked.add(it.key);
    result.push({
      id: `${tag}_${i}`,
      itemKey: it.key,
      rarity: r.key,
      qty: randInt(r.qty[0], r.qty[1]),
      price: it.price ?? r.price,
    });
  }
  // hiếm trước để shop luôn mở đầu bằng món xịn
  const rIdx = (k) => RARITIES.findIndex((r) => r.key === k);
  result.sort((a, b) => rIdx(b.rarity) - rIdx(a.rarity));
  return result;
}

async function refreshViews() {
  if (!botClient) return;
  for (const [messageId, channelId] of [...views.entries()]) {
    try {
      const ch = botClient.channels.cache.get(channelId) || (await botClient.channels.fetch(channelId));
      const msg = ch && (await ch.messages.fetch(messageId));
      if (!msg) throw new Error("message gone");
      const payload = render(pages.get(messageId) || 0);
      await msg.edit({ embeds: payload.embeds, components: payload.components });
    } catch (err) {
      views.delete(messageId);
      pages.delete(messageId);
    }
  }
}

function restock() {
  const now = Date.now();
  if (stock && now - stock.generatedAt < RESTOCK_MS) return false;
  stock = { items: genStock(now.toString(36)), generatedAt: now };
  scheduleSave();
  refreshViews().catch((err) => logger.warn(`shop refresh: ${err.message}`));
  logger.info(`shop: restock ${stock.items.length} loại vật phẩm`);
  return true;
}

function fmtRestock() {
  const left = Math.max(0, (stock?.generatedAt || 0) + RESTOCK_MS - Date.now());
  const s = Math.ceil(left / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function stockTag() {
  return (stock?.items?.[0]?.id || "").split("_")[0] || "—";
}

function render(page = 0) {
  restock();
  const list = stock.items;
  const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.max(0, Math.min(page, total - 1));
  const slice = list.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

  const topRarity = slice[0] ? RARITY[slice[0].rarity] : RARITY.trash;
  const pageColor = topRarity.color;

  const counts = {};
  for (const it of slice) counts[it.rarity] = (counts[it.rarity] || 0) + 1;
  const breakdown = RARITIES.filter((r) => counts[r.key]).map((r) => `${r.emoji}×${counts[r.key]}`).join("  ");

  const lines = slice.map((it, idx) => {
    const no = p * PAGE_SIZE + idx + 1;
    const def = items.get(it.itemKey);
    const soldOut = it.qty <= 0 ? " · ~~hết~~" : "";
    return (
      `\`${String(no).padStart(2, "0")}\` ${RARITY[it.rarity].emoji} **${def?.name || "???"}**${soldOut}\n` +
      `   ${def?.desc || ""}\n` +
      `   📦 còn **${it.qty}** · 💰 **${it.price}✨**`
    );
  });

  const embed = new EmbedBuilder()
    .setTitle(`🛍️ AURA SHOP · Trang ${p + 1}/${total}`)
    .setColor(pageColor)
    .setDescription(
      `*Mỗi lần stock **${STOCK_SIZE} món ngẫu nhiên**, mỗi món **1-30** cái — restock **90s**, ❕ Bá Khí tỉ lệ **0.001%**/món.*\n` +
        `*Mua xong vào **túi đồ** (\`/tuido\`) — chọn đồ dùng ngay trong đó.*\n\n` +
        lines.join("\n\n"),
    )
    .addFields(
      { name: "📊 Trang này", value: breakdown || "—", inline: true },
      { name: "🔁 Restock", value: `**${fmtRestock()}**`, inline: true },
    )
    .setFooter({ text: `Stock ${stockTag()} · Trang ${p + 1}/${total} · JUST LONELY` });

  const select = new StringSelectMenuBuilder()
    .setCustomId("aurashop_get")
    .setPlaceholder(`🔄 Mua vật phẩm — trang ${p + 1}/${total}`)
    .addOptions(
      slice.map((it) => {
        const def = items.get(it.itemKey);
        return {
          label: `${def?.name || "???"}`.slice(0, 100),
          description: `${RARITY[it.rarity].emoji} ${it.qty} còn · ${it.price} aura${it.qty <= 0 ? " · HẾT" : ""}`.slice(0, 100),
          value: it.id,
        };
      }),
    );
  if (slice.every((it) => it.qty <= 0)) select.setDisabled(true);

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("aurashop_prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(p <= 0),
    new ButtonBuilder().setCustomId("aurashop_page").setLabel(`${p + 1}/${total}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId("aurashop_next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(p >= total - 1),
    new ButtonBuilder().setCustomId("aurashop_restock").setEmoji("🔁").setLabel("Restock").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("aurashop_info").setEmoji("ℹ️").setLabel("Thông số").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [nav, new ActionRowBuilder().addComponents(select)], page: p, total };
}

function getInfo(userId) {
  restock();
  const live = RARITIES.map((r) => {
    const list = stock.items.filter((i) => i.rarity === r.key);
    const left = list.reduce((s, i) => s + i.qty, 0);
    const prices = [...new Set(list.map((i) => i.price))];
    const pTxt = prices.length ? prices.join("/") : `${r.price}`;
    const extra = r.key === "baky" ? " · tỉ lệ **0.001%**/món" : "";
    return `${r.emoji} **${r.name}**: ${list.length} loại · ${left} sp · **${pTxt}✨**/cái${extra}`;
  });
  const u = aura.get(userId);
  const bakyNow = stock.items.some((i) => i.rarity === "baky");

  return new EmbedBuilder()
    .setTitle("ℹ️ AURA SHOP — Thông số")
    .setColor(0x8e44ad)
    .setDescription(
      `**Kho hiện tại** \`Stock ${stockTag()}\`${bakyNow ? " · ❕ CÓ BÁ KHÍ trong kho!" : " · ❕ chưa gặp Bá Khí (0.001%/món)"}\n` +
        `> Restock sau **${fmtRestock()}** · Mua xong mở \`/tuido\` chọn đồ **dùng**\n` +
        `> ⚖️ Aura cao được **ưu ái** nhưng **khó kiếm** hơn — số đã hiển thị trong \`/gacha_aura\``,
    )
    .addFields(
      { name: "📦 Kho đang mở", value: live.join("\n") },
      {
        name: "👤 Bạn",
        value: `Aura: \`${u.aura}\` · Đã mua: **${u.shopBought || 0}** món\n` + `Xem túi đồ: \`/tuido\``,
      },
    )
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();
}

function buy(userId, itemId) {
  restock();
  const it = stock.items.find((i) => i.id === itemId);
  if (!it) return { ok: false, reason: "Vật phẩm này không còn trong kho — hãy chọn món khác." };
  if (it.qty <= 0) return { ok: false, reason: "Vật phẩm này đã **HẾT HÀNG** — đợi restock sau ít phút nhé!" };
  const def = items.get(it.itemKey);
  if (!def) return { ok: false, reason: "Vật phẩm lỗi dữ liệu — báo admin giúp mình." };
  const u = aura.get(userId);
  if (u.aura < it.price) {
    return { ok: false, reason: `Mua **${def.name}** cần **${it.price} aura** — bạn chỉ có \`${u.aura}\`.` };
  }
  aura.spend(userId, it.price);
  it.qty -= 1;
  aura.bump(userId, "shopBought");
  inventory.addItem(userId, it.itemKey, 1);
  scheduleSave();
  return { ok: true, item: def, stockItem: it, paid: it.price, left: aura.get(userId).aura };
}

function registerView(messageId, channelId) {
  views.set(messageId, channelId);
}

function getPage(messageId) {
  return pages.get(messageId) || 0;
}

function setPage(messageId, page) {
  pages.set(messageId, page);
}

load();
setInterval(() => {
  try {
    restock();
  } catch (err) {
    logger.warn(`shop tick: ${err.message}`);
  }
}, 15000).unref?.();
process.on("exit", flush);

module.exports = {
  setClient,
  render,
  getInfo,
  buy,
  registerView,
  getPage,
  setPage,
  restock,
  RARITIES,
  RESTOCK_MS,
};
