const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { isDev, canUseBot, approveTarget } = require("../spam/shared");
const keyStore = require("../../utils/keyStore");
const config = require("../../../config");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nhapkey")
    .setDescription("Nhập key để dùng full tính năng bot")
    .addSubcommand((sub) =>
      sub
        .setName("nhap")
        .setDescription("Nhập key kích hoạt")
        .addStringOption((o) => o.setName("key").setDescription("Key (VD: vVnKwh0i4m_xxxx)").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("tao")
        .setDescription("Tạo key mới (dev only)")
        .addIntegerOption((o) => o.setName("soluong").setDescription("Số key (1-10)").setMinValue(1).setMaxValue(10))
    )
    .addSubcommand((sub) =>
      sub
        .setName("danhsach")
        .setDescription("Xem danh sách key (dev only)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("xoa")
        .setDescription("Xóa key (dev only)")
        .addStringOption((o) => o.setName("key").setDescription("Key cần xóa").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "nhap") {
      const key = interaction.options.getString("key").trim();
      const userId = interaction.user.id;

      if (isDev(userId)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription("Bạn là dev, không cần key!").setColor(0xe74c3c)],
          ephemeral: true,
        });
      }

      if (canUseBot(interaction.member)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("✅ ĐÃ CÓ QUYỀN").setDescription("Bạn đã có quyền dùng bot rồi!").setColor(0x2ecc71)],
          ephemeral: true,
        });
      }

      const result = keyStore.redeemKey(key, userId, interaction.user.tag);

      if (!result.success) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ KEY KHÔNG HỢP LỆ")
              .setDescription(result.reason)
              .setColor(0xe74c3c)
              .setFooter({ text: "Liên hệ dev để lấy key" })
              .setTimestamp(),
          ],
          ephemeral: true,
        });
      }

      approveTarget("user", userId);

      const timeLeft = Math.max(0, result.expiresAt - Date.now());
      const hours = Math.floor(timeLeft / 3600000);
      const minutes = Math.floor((timeLeft % 3600000) / 60000);

      const embed = new EmbedBuilder()
        .setTitle("✅ KÍCH HOẠT THÀNH CÔNG")
        .setDescription(`Key \`${key}\` đã được kích hoạt!`)
        .addFields(
          { name: "👤 User", value: `${interaction.user}`, inline: true },
          { name: "⏰ Còn lại", value: `${hours}h ${minutes}m`, inline: true },
          { name: "📢 Quyền hạn", value: "Spam, Voice, Tool, Phân quyền", inline: false },
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      logger.info(`[nhapkey] ${interaction.user.tag} kích hoạt key: ${key}`);

      try {
        const devUser = await interaction.client.users.fetch(config.devId);
        await devUser.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔑 KEY ĐÃ SỬ DỤNG")
              .setDescription(`${interaction.user} (${userId}) dùng key \`${key}\``)
              .addFields({ name: "Server", value: result.guildName || "Custom", inline: true })
              .setColor(0x2ecc71)
              .setTimestamp(),
          ],
        }).catch(() => {});
      } catch {}
    }

    if (sub === "tao") {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription("Chỉ dev mới tạo được key!").setColor(0xe74c3c)],
          ephemeral: true,
        });
      }

      const soluong = interaction.options.getInteger("soluong") || 1;
      const newKeys = [];

      for (let i = 0; i < soluong; i++) {
        const { key, expiresAt } = keyStore.createKey("custom", "Dev Created");
        newKeys.push({ key, expiresAt });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔑 ĐÃ TẠO ${soluong} KEY`)
        .setColor(0x2ecc71)
        .setTimestamp();

      for (const k of newKeys) {
        embed.addFields({
          name: `\`${k.key}\``,
          value: `Hết hạn: <t:${Math.floor(k.expiresAt / 1000)}:R>`,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "danhsach") {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription("Chỉ dev mới xem được danh sách key!").setColor(0xe74c3c)],
          ephemeral: true,
        });
      }

      const keys = keyStore.listKeys(true);
      const stats = keyStore.getKeyStats();

      const embed = new EmbedBuilder()
        .setTitle("🔑 DANH SÁCH KEY")
        .setColor(0x3498db)
        .addFields(
          { name: "⏳ Chờ dùng", value: `${stats.pending}`, inline: true },
          { name: "✅ Đã dùng", value: `${stats.used}`, inline: true },
          { name: "🚫 Đã thu hồi", value: `${stats.revoked}`, inline: true },
        );

      if (keys.length > 0) {
        const display = keys.slice(0, 15);
        for (const k of display) {
          const status = k.used ? "✅" : k.expired ? "⏰" : "⏳";
          embed.addFields({
            name: `${status} \`${k.key}\``,
            value: `Server: ${k.guildName || "—"}\nUsed by: ${k.usedBy ? `<@${k.usedBy}>` : "—"}`,
            inline: false,
          });
        }
      }

      embed.setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "xoa") {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription("Chỉ dev mới xóa được key!").setColor(0xe74c3c)],
          ephemeral: true,
        });
      }

      const key = interaction.options.getString("key").trim();
      keyStore.revokeKey(key);

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("✅ ĐÃ XÓA").setDescription(`Key \`${key}\` đã bị xóa/thu hồi.`).setColor(0x2ecc71).setTimestamp()],
        ephemeral: true,
      });
    }
  },
};
