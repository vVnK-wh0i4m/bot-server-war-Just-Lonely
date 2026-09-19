const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { isDev, canUseBot, approveTarget, botLock } = require("../spam/shared");
const fs = require("fs");
const path = require("path");
const config = require("../../../config");
const logger = require("../../utils/logger");

const KEYS_FILE = path.join(__dirname, "..", "..", "..", "bot_keys.json");

function loadKeys() {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
  } catch {
    return { keys: [], used: {} };
  }
}

function saveKeys(data) {
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error(`[nhapkey] Save failed: ${err.message}`);
  }
}

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "JL-";
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nhapkey")
    .setDescription("Nhập key để dùng full tính năng bot")
    .addSubcommand((sub) =>
      sub
        .setName("nhap")
        .setDescription("Nhập key kích hoạt")
        .addStringOption((o) => o.setName("key").setDescription("Key kích hoạt (VD: JL-ABC12345)").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("tao")
        .setDescription("Tạo key mới (dev only)")
        .addIntegerOption((o) => o.setName("soluong").setDescription("Số key muốn tạo (mặc định: 1)").setMinValue(1).setMaxValue(10))
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
      const key = interaction.options.getString("key").toUpperCase().trim();
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

      const keysData = loadKeys();

      if (!keysData.keys.includes(key)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ KEY SAI HOẶC ĐÃ HẾT HẠN")
              .setDescription(`Key \`${key}\` không tồn tại hoặc đã được sử dụng.`)
              .setColor(0xe74c3c)
              .setFooter({ text: "Liên hệ dev để lấy key" })
              .setTimestamp(),
          ],
          ephemeral: true,
        });
      }

      keysData.keys = keysData.keys.filter((k) => k !== key);
      keysData.used[key] = { userId, username: interaction.user.tag, timestamp: Date.now() };
      saveKeys(keysData);

      approveTarget("user", userId);

      const embed = new EmbedBuilder()
        .setTitle("✅ KÍCH HOẠT THÀNH CÔNG")
        .setDescription(`Key \`${key}\` đã được kích hoạt!`)
        .addFields(
          { name: "👤 User", value: `${interaction.user}`, inline: true },
          { name: "🔑 Key", value: `\`${key}\``, inline: true },
          { name: "⏰ Thời gian", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: "━━━━━━━━━━━━━━━", value: " ", inline: false },
          { name: "📢 Bây giờ bạn có thể dùng:", value: "Spam, Voice, Tool, Phân quyền", inline: false },
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      logger.info(`[nhapkey] ${interaction.user.tag} (${userId}) kích hoạt key: ${key}`);

      try {
        const devUser = await interaction.client.users.fetch(config.devId);
        await devUser.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔑 KEY ĐÃ ĐƯỢC SỬ DỤNG")
              .setDescription(`${interaction.user} (${userId}) đã dùng key \`${key}\``)
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
      const keysData = loadKeys();
      const newKeys = [];

      for (let i = 0; i < soluong; i++) {
        let key;
        do { key = generateKey(); } while (keysData.keys.includes(key) || keysData.used[key]);
        keysData.keys.push(key);
        newKeys.push(key);
      }

      saveKeys(keysData);

      const embed = new EmbedBuilder()
        .setTitle(`🔑 ĐÃ TẠO ${soluong} KEY`)
        .setColor(0x2ecc71)
        .addFields(
          ...newKeys.map((k, i) => ({ name: `Key ${i + 1}`, value: `\`${k}\``, inline: true }))
        )
        .setFooter({ text: `Tổng key chưa dùng: ${keysData.keys.length}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "danhsach") {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription("Chỉ dev mới xem được danh sách key!").setColor(0xe74c3c)],
          ephemeral: true,
        });
      }

      const keysData = loadKeys();
      const unused = keysData.keys.length;
      const usedCount = Object.keys(keysData.used).length;

      const embed = new EmbedBuilder()
        .setTitle("🔑 DANH SÁCH KEY")
        .setColor(0x3498db)
        .addFields(
          { name: "Chưa dùng", value: `${unused} key`, inline: true },
          { name: "Đã dùng", value: `${usedCount} key`, inline: true },
        );

      if (keysData.keys.length > 0) {
        embed.addFields({
          name: "📋 Key Chưa Dùng",
          value: keysData.keys.map((k) => `\`${k}\``).join("\n"),
          inline: false,
        });
      }

      if (keysData.used && Object.keys(keysData.used).length > 0) {
        const usedList = Object.entries(keysData.used)
          .map(([k, v]) => `\`${k}\` → ${v.username} (<@${v.userId}>)`)
          .join("\n");
        embed.addFields({
          name: "📋 Key Đã Dùng",
          value: usedList.substring(0, 1024),
          inline: false,
        });
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

      const key = interaction.options.getString("key").toUpperCase().trim();
      const keysData = loadKeys();

      if (keysData.keys.includes(key)) {
        keysData.keys = keysData.keys.filter((k) => k !== key);
        saveKeys(keysData);

        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("✅ ĐÃ XÓA").setDescription(`Key \`${key}\` đã bị xóa.`).setColor(0x2ecc71).setTimestamp()],
          ephemeral: true,
        });
      }

      if (keysData.used && keysData.used[key]) {
        delete keysData.used[key];
        saveKeys(keysData);
        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("✅ ĐÃ XÓA").setDescription(`Key \`${key}\` (đã dùng) đã bị xóa.`).setColor(0x2ecc71).setTimestamp()],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("❌ LỖI").setDescription(`Key \`${key}\` không tồn tại.`).setColor(0xe74c3c).setTimestamp()],
        ephemeral: true,
      });
    }
  },
};
