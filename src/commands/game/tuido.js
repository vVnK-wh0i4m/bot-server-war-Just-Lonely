const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const inventory = require("../../utils/inventory");
const items = require("../../utils/items");
const game = require("../../utils/game");
const aura = require("../../utils/aura");

const RARITY_ORDER = ["baky", "mythical", "legendary", "rare", "common", "trash"];
const RARITY_EMOJI = { baky: "❕", mythical: "🔴", legendary: "🟡", rare: "🔵", common: "🟢", trash: "⚪" };

// Sở hữu = tự kích hoạt, không cần bấm dùng
const PASSIVE = new Set(["reflect"]);

function effectLabel(def) {
  const v = def.value || {};
  switch (def.effect) {
    case "shield_capture": return `🛡️ Miễn bị bắt cóc **${v.minutes} phút**`;
    case "shield_cc": return `🛡️ Miễn khống chế **${v.minutes} phút**`;
    case "shield_all": return `🛡️ Miễn toàn bộ **${v.minutes} phút**`;
    case "escape_ticket": return "🔓 Thoát tù ngay **100%**";
    case "cooldown_reset": return "⏳ Reset toàn bộ cooldown";
    case "aura_boost": return `✨ Dùng ngay **+${v.amount} aura**`;
    case "streak_saver": return "🔗 Giữ chuỗi lần fail kế tiếp";
    case "luck_charm": return `🍀 +**${v.pct}%** tỉ lệ lần kế tiếp`;
    case "double_drop": return "🎁 Aurabox/mayman kế tiếp **x2**";
    case "slot_extra": return `👥 +**${v.slots} slot** trong **${v.minutes} phút**`;
    case "jail_pardon": return "🕊️ Thả 1 người bạn đang giữ (hoặc thoát tù)";
    case "reflect": return "🪞 **Phản đòn tự động** — sở hữu là kích hoạt";
    default: return (def.desc || "—").slice(0, 80);
  }
}

function buildView(user) {
  const userId = user.id;
  const bag = inventory.bagOf(userId);
  const embed = new EmbedBuilder()
    .setTitle(`🎒 TÚI ĐỒ — ${user.username}`)
    .setColor(0x8e44ad)
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();

  const components = [];
  if (!bag.length) {
    embed.setDescription("Túi đồ **trống trơn** — ghé `/aurashop` sắm vài món (mỗi lần 5 món, restock 90s)!");
    embed.addFields({ name: "📖 Bổ sung", value: "`/aurashop` — mở kho • `/tuido` — chọn đồ **dùng**", inline: false });
    return { embeds: [embed], components };
  }

  const sorted = bag.sort((a, b) => RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity));
  const total = bag.reduce((s, e) => s + e.qty, 0);
  const lines = sorted.map(
    (e) => `${RARITY_EMOJI[e.item.rarity]} **${e.item.name}** × **${e.qty}**\n> ${effectLabel(e.item)}`,
  );
  embed
    .setDescription(lines.join("\n"))
    .addFields({ name: "📦 Tổng cộng", value: `**${bag.length}** loại · **${total}** món`, inline: true });

  const usable = sorted.filter((e) => !PASSIVE.has(e.item.effect));
  if (usable.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("tuido_use")
      .setPlaceholder("🧪 Chọn đồ để DÙNG — hiệu lực ngay")
      .addOptions(
        usable.slice(0, 25).map((e) => ({
          label: e.item.name.slice(0, 100),
          description: `${RARITY_EMOJI[e.item.rarity]} x${e.qty} — ${effectLabel(e.item)}`.slice(0, 100),
          value: e.item.key,
        })),
      );
    components.push(new ActionRowBuilder().addComponents(select));
  } else {
    embed.addFields({
      name: "🪞 Đồ phản đòn",
      value: "Tinh Thể Hỗn Mang **tự kích hoạt** khi sở hữu — không cần bấm dùng!",
      inline: false,
    });
  }
  embed.addFields({ name: "📖 Bổ sung", value: "`/aurashop` — mua thêm • dùng xong chạy ngay", inline: false });
  return { embeds: [embed], components };
}

async function applyEffect(interaction, def) {
  const userId = interaction.user.id;
  const guild = interaction.guild;
  const gid = interaction.guildId;
  const v = def.value || {};

  switch (def.effect) {
    case "shield_capture":
    case "shield_cc":
    case "shield_all": {
      const type = def.effect === "shield_capture" ? "capture" : def.effect === "shield_cc" ? "cc" : "all";
      const until = inventory.setShield(userId, type, v.minutes);
      return `> 🛡️ Khiên hiệu lực tới <t:${Math.floor(until / 1000)}:T> (**${v.minutes} phút**)\n> Hết hạn tự mất — ai nhắm bạn sẽ bị chặn`;
    }
    case "cooldown_reset": {
      const n = game.clearCooldowns(gid, userId);
      return `> ⏳ Đã xóa **${n}** cooldown — dùng lại lệnh ngay được!`;
    }
    case "aura_boost": {
      aura.credit(userId, v.amount);
      return `> ✨ **+${v.amount} aura** → \`${aura.get(userId).aura}\``;
    }
    case "streak_saver":
      inventory.setStreakSaver(userId);
      return `> 🔗 Lần **fail kế tiếp** chuỗi sẽ được giữ nguyên (dùng 1 lần rồi mất)`;
    case "luck_charm":
      inventory.setLuck(userId, v.pct);
      return `> 🍀 Lần **hành động kế tiếp** được **+${v.pct}%** tỉ lệ`;
    case "double_drop":
      inventory.setDoubleDrop(userId);
      return `> 🎁 **Aurabox / mayman kế tiếp** nhận **x2** aura`;
    case "slot_extra":
      inventory.setSlotBonus(userId, v.slots, v.minutes);
      return `> 👥 **+${v.slots} slot** trong **${v.minutes} phút** (hiện **${game.effectiveSlots(userId)}** slot)`;
    case "escape_ticket": {
      const rec = game.prisonOf(gid, userId);
      if (!rec) return { err: "Bạn **không ngồi tù** — giữ vé lại khi nào vô hầm đã!" };
      await game.freePrison(guild, userId, { escape: false });
      return `> 🔓 Thoát **100%** không roll, không quả báo — các kênh đã hiện lại!`;
    }
    case "jail_pardon": {
      if (game.prisonOf(gid, userId)) {
        await game.freePrison(guild, userId, { escape: false });
        return `> 🕊️ Bạn **tự ân xá** — thoát tù ngay lập tức!`;
      }
      const list = game.possessionsBy(gid, userId);
      if (!list.length) return { err: "Bạn **không giữ ai** và cũng **không ngồi tù** — chưa ai để thả!" };
      const victim = list[list.length - 1];
      await game.releasePossession(gid, victim.userId, "được ân xá bằng Bùa Xá Tội");
      return `> 🕊️ Đã thả <@${victim.userId}> khỏi quyền sở hữu của bạn`;
    }
    default:
      return { err: "Vật phẩm này chưa dùng được." };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tuido")
    .setDescription("🎒 Túi đồ — xem vật phẩm và chọn đồ để dùng ngay"),

  async execute(interaction) {
    const view = buildView(interaction.user);
    return interaction.reply({ content: `<@${interaction.user.id}>`, ...view });
  },

  // Chọn đồ trong menu → dùng ngay, embed làm mới
  async onComponent(interaction) {
    const userId = interaction.user.id;
    const key = interaction.values?.[0];
    const def = key ? items.get(key) : null;
    if (!def) return interaction.reply({ content: "❌ Vật phẩm không tồn tại.", ephemeral: true });
    if (inventory.bagQty(userId, key) <= 0) {
      return interaction.reply({ content: `❌ Bạn không còn **${def.name}** trong túi.`, ephemeral: true });
    }

    // Kiểm tra điều kiện TRƯỚC khi trừ đồ
    if (def.effect === "escape_ticket" && !game.prisonOf(interaction.guildId, userId)) {
      return interaction.reply({ content: "❌ Chỉ dùng **Vé Thoát Ngục** khi đang ngồi tù.", ephemeral: true });
    }

    inventory.removeItem(userId, key, 1);
    const out = await applyEffect(interaction, def);
    const view = buildView(interaction.user);
    await interaction.update(view).catch(() => {});

    const payload = out?.err
      ? {
          embeds: [
            new EmbedBuilder()
              .setTitle(`❌ KHÔNG DÙNG ĐƯỢC — ${def.name}`)
              .setColor(0xe74c3c)
              .setDescription(out.err)
              .setFooter({ text: "JUST LONELY · AURA GAME" }),
          ],
          ephemeral: true,
        }
      : {
          embeds: [
            new EmbedBuilder()
              .setTitle(`✅ ĐÃ DÙNG — ${def.name}`)
              .setColor(0x2ecc71)
              .setDescription(`${effectLabel(def)}\n\n${out}\n> 📦 Còn lại: **${inventory.bagQty(userId, key)}**`)
              .setFooter({ text: "JUST LONELY · AURA GAME" })
              .setTimestamp(),
          ],
          ephemeral: true,
        };
    if (payload.embeds[0].data.title.startsWith("❌")) {
      // điều kiện fail → trả lại đồ
      inventory.addItem(userId, key, 1);
    }
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(payload).catch(() => {});
    }
    return interaction.reply(payload).catch(() => {});
  },
};
