const { Events, EmbedBuilder } = require("discord.js");
const config = require("../../config");
const logger = require("../utils/logger");

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    if (member.guild.id !== member.client.guilds.cache.first()?.id) return;

    const now = new Date();
    let stayedStr = "Không rõ";
    if (member.joinedAt) {
      const stayed = now - member.joinedAt;
      const days = Math.floor(stayed / 86400000);
      const hours = Math.floor((stayed % 86400000) / 3600000);
      stayedStr = `${days} ngày ${hours} giờ`;
    }

    // 1. Leave notification
    const welcomeChannel =
      member.guild.channels.cache.get(config.welcome.welcomeChannelId) ||
      member.guild.systemChannel;
    if (welcomeChannel) {
      const leaveEmbed = new EmbedBuilder()
        .setDescription(
          `## 👋 ${member.user.username} đã rời server!\n` +
            `> **${member.guild.name}** còn lại **${member.guild.memberCount}** thành viên.`
        )
        .setColor(0xff4444)
        .setTimestamp(now)
        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "⏱️ Thời gian ở lại", value: stayedStr, inline: true },
          {
            name: "📅 Vào lúc",
            value: member.joinedAt
              ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
              : "Không rõ",
            inline: true,
          }
        )
        .setFooter({ text: `ID: ${member.id} • JUST LONELY` });

      try {
        await welcomeChannel.send({ embeds: [leaveEmbed] });
      } catch (err) {
        logger.error(`[Welcome] Lỗi leave: ${err.message}`);
      }
    }

    // 2. Log
    const logChannel = member.guild.channels.cache.get(
      config.welcome.logChannelId
    );
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("📤 Member rời server")
        .setColor(0xff4444)
        .setTimestamp(now)
        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "👤 User", value: `${member} (\`${member.id}\`)`, inline: false },
          { name: "📛 Tên", value: `${member}`, inline: true },
          { name: "⏱️ Ở lại", value: stayedStr, inline: true },
          { name: "👥 Còn lại", value: `${member.guild.memberCount}`, inline: true }
        )
        .setFooter({ text: "JUST LONELY • Leave Log" });

      try {
        await logChannel.send({ embeds: [logEmbed] });
      } catch (err) {
        logger.error(`[Welcome] Lỗi leave log: ${err.message}`);
      }
    }
  },
};
