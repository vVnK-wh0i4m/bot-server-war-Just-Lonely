const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { isDev, canUseBot, approveTarget, pendingApprovals } = require("../spam/shared");
const config = require("../../../config");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("anxin")
    .setDescription("Xin mở bot cho dev")
    .addStringOption((o) =>
      o.setName("loi_nhan").setDescription("Lời nhắn gửi cho dev").setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const loiNhan = interaction.options.getString("loi_nhan");

    if (isDev(userId)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription("Bạn là dev, không cần xin!").setColor(0xe74c3c)],
        ephemeral: true,
      });
    }

    if (canUseBot(interaction.member)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("✅ ĐÃ CÓ QUYỀN").setDescription("Bạn đã có quyền dùng bot rồi!").setColor(0x2ecc71)],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("📨 YÊU CẦU MỞ BOT")
      .setDescription(`${interaction.user} muốn được dùng bot.`)
      .addFields(
        { name: "👤 User", value: `${interaction.user} (${interaction.user.id})`, inline: true },
        { name: "🏠 Server", value: interaction.guild?.name || "DM", inline: true },
        { name: "📝 Lời nhắn", value: loiNhan, inline: false },
      )
      .setColor(0xf39c12)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "Dev sẽ xem và phê duyệt" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`anxin_approve_${userId}`).setLabel("✅ Duyệt").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`anxin_deny_${userId}`).setLabel("❌ Từ chối").setStyle(ButtonStyle.Danger),
    );

    pendingApprovals.set(userId, {
      user: interaction.user,
      timestamp: Date.now(),
      type: "anxin",
      loiNhan: loiNhan,
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📨 ĐÃ GỬI YÊU CẦU")
          .setDescription(`Lời nhắn của bạn đã được gửi đến dev.\nVui lòng chờ phê duyệt.`)
          .addFields({ name: "📝 Lời nhắn", value: loiNhan, inline: false })
          .setColor(0xf39c12)
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    try {
      const devUser = await interaction.client.users.fetch(config.devId);
      await devUser.send({ embeds: [embed], components: [row] }).catch(() => {});
    } catch {}

    try {
      const devUser2 = await interaction.client.users.fetch(config.devId2);
      await devUser2.send({ embeds: [embed], components: [row] }).catch(() => {});
    } catch {}

    logger.info(`[anxin] ${interaction.user.tag} (${userId}) yêu cầu mở bot: ${loiNhan}`);
  },
};
