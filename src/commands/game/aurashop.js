const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const game = require("../../utils/game");
const shop = require("../../utils/shop");
const aura = require("../../utils/aura");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("aurashop")
    .setDescription("AURA SHOP — 5 món/lần, mỗi món 1-30 sp, ❕ 0.001%, restock 90s, có ℹ️"),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "AURA SHOP chỉ mở trong server!");
    }
    const userId = interaction.user.id;
    const cd = game.checkCooldown(guild.id, userId, "aurashop");
    if (cd) {
      return game.replyErr(interaction, "⏳ Đang mở kho", `Chờ **${game.fmtLeft(cd)}** nữa hãy xem kho (hồi chiêu **3s**)!`);
    }
    game.setCooldown(guild.id, userId, "aurashop");
    shop.setClient(interaction.client);

    const payload = shop.render(0);
    await interaction.reply({ content: `<@${userId}>`, embeds: payload.embeds, components: payload.components });
    const msg = await interaction.fetchReply().catch(() => null);
    if (msg) shop.registerView(msg.id, interaction.channelId);
  },

  // Menu chọn vật phẩm + nút chuyển trang
  async onComponent(interaction) {
    shop.setClient(interaction.client);
    const cid = interaction.customId;

    if (cid === "aurashop_info") {
      return interaction.reply({ embeds: [shop.getInfo(interaction.user.id)], ephemeral: true });
    }

    if (cid === "aurashop_prev" || cid === "aurashop_next") {
      const cur = shop.getPage(interaction.message.id);
      const next = cid === "aurashop_next" ? cur + 1 : cur - 1;
      const payload = shop.render(next);
      shop.setPage(interaction.message.id, payload.page);
      return interaction.update({ embeds: payload.embeds, components: payload.components });
    }

    if (cid === "aurashop_restock") {
      const payload = shop.render(shop.getPage(interaction.message.id));
      await interaction.update({ embeds: payload.embeds, components: payload.components });
      return interaction.followUp({ content: "🔁 Đã làm mới kho (nếu chưa tới giờ restock, kho vẫn giữ nguyên).", ephemeral: true }).catch(() => {});
    }

    if (cid === "aurashop_get") {
      const itemId = interaction.values?.[0];
      const res = shop.buy(interaction.user.id, itemId);
      const payload = shop.render(shop.getPage(interaction.message.id));
      await interaction.update({ embeds: payload.embeds, components: payload.components });

      const userId = interaction.user.id;
      const rar = shop.RARITIES.find((r) => r.key === res.item?.rarity);
      const result = res.ok
        ? {
            content: `<@${userId}>`,
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ MUA THÀNH CÔNG!")
                .setColor(0x2ecc71)
                .setDescription(
                  `Bạn mua **${res.item.name}** ${rar?.emoji || ""}\n> ${res.item.desc}\n\n` +
                    `> 💸 Trả **-${res.paid} aura** → còn \`${res.left}\`\n` +
                    `> 📦 Còn lại trong kho: **${res.stockItem.qty} sp**\n` +
                    `> 🎒 Đã vào **túi đồ** — xem bằng \`/tuido\`!`,
                )
                .setFooter({ text: "JUST LONELY · AURA GAME" })
                .setTimestamp(),
            ],
            ephemeral: true,
          }
        : { content: `<@${userId}> ${res.reason}`, ephemeral: true };
      return interaction.followUp(result).catch(() => {});
    }
  },
};
