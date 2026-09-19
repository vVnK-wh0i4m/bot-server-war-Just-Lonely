const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { isDev } = require("../spam/shared");
const keyStore = require("../../utils/keyStore");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("keymanager")
    .setDescription("QUẢN LÝ KEY — CHỈ DEV DÙNG ĐƯỢC")
    .addSubcommand((sub) =>
      sub.setName("tao").setDescription("Tạo key mới")
        .addIntegerOption((o) => o.setName("soluong").setDescription("Số key (1-20)").setMinValue(1).setMaxValue(20))
        .addStringOption((o) => o.setName("server").setDescription("Tên server (tùy chọn)"))
    )
    .addSubcommand((sub) =>
      sub.setName("danhsach").setDescription("Xem tất cả key")
    )
    .addSubcommand((sub) =>
      sub.setName("thongke").setDescription("Xem thống kê key")
    )
    .addSubcommand((sub) =>
      sub.setName("xoa").setDescription("Xóa 1 key")
        .addStringOption((o) => o.setName("key").setDescription("Key cần xóa").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("thuhoi").setDescription("Thu hồi + xóa TẤT CẢ key")
    )
    .addSubcommand((sub) =>
      sub.setName("donesach").setDescription("Dọn key hết hạn")
    )
    .addSubcommand((sub) =>
      sub.setName("gui").setDescription("Gửi key cho user")
        .addUserOption((o) => o.setName("user").setDescription("User nhận key").setRequired(true))
        .addStringOption((o) => o.setName("key").setDescription("Key (để trống = tạo mới)"))
    ),

  async execute(interaction) {
    if (!isDev(interaction.user.id)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🚫 TRUY CẬP BỊ CẤM")
            .setDescription("Lệnh này **CHỈ** bot dev mới dùng được.\nKhông có bất kỳ ngoại lệ nào.")
            .setColor(0x000000)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "tao") {
      const soluong = interaction.options.getInteger("soluong") || 1;
      const server = interaction.options.getString("server") || "Custom";
      const newKeys = [];

      for (let i = 0; i < soluong; i++) {
        const { key, expiresAt } = keyStore.createKey("custom", server);
        newKeys.push({ key, expiresAt });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔑 ĐÃ TẠO ${soluong} KEY`)
        .setColor(0x2ecc71)
        .setDescription(`Key có hiệu lực **3 giờ** từ khi tạo.`)
        .setTimestamp();

      for (const k of newKeys) {
        embed.addFields({
          name: `\`${k.key}\``,
          value: `Hết hạn: <t:${Math.floor(k.expiresAt / 1000)}:R>`,
          inline: false,
        });
      }

      const stats = keyStore.getKeyStats();
      embed.setFooter({ text: `Chưa dùng: ${stats.pending} | Đã dùng: ${stats.used} | Hết hạn: ${stats.expired}` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      logger.info(`[keymanager] Dev tạo ${soluong} key cho "${server}"`);
    }

    if (sub === "danhsach") {
      const keys = keyStore.listKeys(true);
      if (keys.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("📋 DANH SÁCH KEY").setDescription("Không có key nào.").setColor(0x3498db)],
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 DANH SÁCH KEY")
        .setColor(0x3498db)
        .setTimestamp();

      const display = keys.slice(0, 25);
      for (const k of display) {
        const status = k.used ? "✅ Đã dùng" : k.expired ? "⏰ Hết hạn" : "⏳ Chờ dùng";
        const user = k.usedBy ? `<@${k.usedBy}>` : "—";
        embed.addFields({
          name: `\`${k.key}\``,
          value: `${status}\nServer: ${k.guildName || "—"}\nUser: ${user}`,
          inline: true,
        });
      }

      if (keys.length > 25) {
        embed.setFooter({ text: `Hiện 25/${keys.length} key` });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "thongke") {
      const stats = keyStore.getKeyStats();
      const embed = new EmbedBuilder()
        .setTitle("📊 THỐNG KÊ KEY")
        .setColor(0xf39c12)
        .addFields(
          { name: "⏳ Chờ dùng", value: `${stats.pending}`, inline: true },
          { name: "✅ Đã dùng", value: `${stats.used}`, inline: true },
          { name: "⏰ Hết hạn", value: `${stats.expired}`, inline: true },
          { name: "🚫 Đã thu hồi", value: `${stats.revoked}`, inline: true },
          { name: "━━━━━━━━━", value: " ", inline: false },
          { name: "Tổng cộng", value: `${stats.total}`, inline: true },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "xoa") {
      const key = interaction.options.getString("key").trim();
      keyStore.revokeKey(key);
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🗑️ ĐÃ XÓA").setDescription(`Key \`${key}\` đã bị xóa/thu hồi.`).setColor(0xe74c3c).setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === "thuhoi") {
      const count = keyStore.revokeAll();
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🚫 THU HỒI TẤT CẢ").setDescription(`Đã thu hồi **${count} key**. Tất cả key đều không còn hiệu lực.`).setColor(0xe74c3c).setTimestamp()],
        ephemeral: true,
      });
      logger.warn(`[keymanager] Dev thu hồi TẤT CẢ key (${count} key)`);
    }

    if (sub === "donesach") {
      const count = keyStore.cleanExpired();
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🧹 DỌN DẸP").setDescription(`Đã xóa **${count} key** hết hạn.`).setColor(0x2ecc71).setTimestamp()],
        ephemeral: true,
      });
    }

    if (sub === "gui") {
      const targetUser = interaction.options.getUser("user");
      const keyInput = interaction.options.getString("key");

      let key;
      if (keyInput) {
        key = keyInput.trim();
      } else {
        const result = keyStore.createKey("custom", "Dev Gift");
        key = result.key;
      }

      const embed = new EmbedBuilder()
        .setTitle("🔑 KEY CHO BẠN")
        .setDescription(`Key của bạn: \`${key}\`\nHiệu lực: **3 giờ**`)
        .addFields(
          { name: "Cách dùng", value: "Dùng `/nhapkey nhap key:KEY` trong bot", inline: false },
          { name: "Hoặc truy cập", value: "https://vvnk-wh0i4m.netlify.app/key", inline: false },
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      try {
        await targetUser.send({ embeds: [embed] });
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle("✅ ĐÃ GỬI").setDescription(`Đã gửi key \`${key}\` cho ${targetUser} qua DM.`).setColor(0x2ecc71).setTimestamp()],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription(`Không gửi DM được cho ${targetUser}. Key: \`${key}\``).setColor(0xe74c3c).setTimestamp()],
          ephemeral: true,
        });
      }
    }
  },
};
