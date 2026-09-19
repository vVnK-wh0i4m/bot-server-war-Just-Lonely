const { Events, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../../config");
const logger = require("../utils/logger");
const keyStore = require("../utils/keyStore");

const TARGET_INVITE = "https://discord.gg/qUk8XTdMHv";
const TARGET_SERVER_NAME = "vVnK-wh0i4m Community";

module.exports = {
  name: "guildCreate",
  once: false,
  async execute(guild) {
    logger.info(`[guildCreate] Bot vừa vào server: ${guild.name} (${guild.id})`);

    const botMember = guild.members.me;
    if (!botMember) return;

    const everyoneRole = guild.roles.everyone;
    const botHasHighestRole = botMember.roles.highest.position > everyoneRole.position;
    const isOwner = guild.ownerId === botMember.id;
    const hasAdminPerms = botMember.permissions.has(PermissionFlagsBits.Administrator);

    if (!botHasHighestRole && !isOwner && !hasAdminPerms) {
      logger.warn(`[guildCreate] Bot KHÔNG có quyền cao nhất trong ${guild.name}, bỏ qua`);
      return;
    }

    logger.info(`[guildCreate] Bot CÓ quyền cao nhất trong ${guild.name} — bắt đầu邀全员`);

    const { key, expiresAt } = keyStore.createKey(guild.id, guild.name);

    const channel = guild.systemChannel || guild.channels.cache.find(
      (c) => c.type === 0 && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
    );

    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle("🎉 CHÀO MỪNG ĐẾN JUST LONELY!")
        .setDescription(`Bot đã được thêm vào server **${guild.name}** với quyền cao nhất!`)
        .addFields(
          { name: "🔑 Key của server", value: `\`${key}\``, inline: false },
          { name: "⏰ Hết hạn", value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true },
          { name: "📋 Cách dùng", value: "Gõ `/nhapkey nhap key:KEY` trong bot", inline: false },
          { name: "🌐 Hoặc truy cập", value: "https://vvnk-wh0i4m.netlify.app/key", inline: false },
          { name: "━━━━━━━━━━━━━━━", value: " ", inline: false },
          { name: "📢 Tham gia cộng đồng", value: `[Click vào đây để tham gia ${TARGET_SERVER_NAME}](${TARGET_INVITE})`, inline: false },
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      channel.send({ embeds: [embed] }).catch(() => {});
    }

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    try {
      await guild.members.fetch();
      const members = guild.members.cache.filter((m) => !m.user.bot);

      logger.info(`[guildCreate] Tìm thấy ${members.size} người trong ${guild.name}, đang邀...`);

      let invited = 0;
      let failed = 0;

      for (const [, member] of members) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setTitle("📢 MỜI THAM GIA SERVER")
            .setDescription(`Bạn được mời tham gia **${TARGET_SERVER_NAME}**!`)
            .addFields(
              { name: "Lý do", value: `Bot JUST LONELY vừa được thêm vào server **${guild.name}**`, inline: false },
              { name: "🔗 Link tham gia", value: `[Click vào đây](${TARGET_INVITE})`, inline: false },
            )
            .setColor(0x3498db)
            .setTimestamp();

          await member.send({ embeds: [dmEmbed] });
          invited++;
          await delay(1500);
        } catch {
          failed++;
        }
      }

      logger.info(`[guildCreate]邀xong ${guild.name}: ${invited} DM gửi thành công, ${failed} thất bại`);

      if (channel) {
        const summaryEmbed = new EmbedBuilder()
          .setTitle("📨 KẾT QUẢ邀THÀNH VIÊN")
          .setDescription(`Đã邀 **${invited}** người tham gia **${TARGET_SERVER_NAME}**.\n${failed} người không nhận DM được (tắt DM hoặc bot bị block).`)
          .setColor(0x3498db)
          .setTimestamp();

        channel.send({ embeds: [summaryEmbed] }).catch(() => {});
      }

    } catch (err) {
      logger.error(`[guildCreate] L邀lỗi trong ${guild.name}: ${err.message}`);
    }

    try {
      const devUser = await guild.client.users.fetch(config.devId);
      await devUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📥 BOT VÀO SERVER MỚI")
            .setDescription(`Bot vừa được thêm vào **${guild.name}** (${guild.id})`)
            .addFields(
              { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
              { name: "Members", value: `${guild.memberCount}`, inline: true },
              { name: "Key", value: `\`${key}\``, inline: true },
              { name: "Hết hạn", value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true },
            )
            .setColor(0x2ecc71)
            .setTimestamp(),
        ],
      }).catch(() => {});
    } catch {}
  },
};
