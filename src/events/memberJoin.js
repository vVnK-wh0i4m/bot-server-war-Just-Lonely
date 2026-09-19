const { Events, EmbedBuilder } = require("discord.js");
const config = require("../../config");
const logger = require("../utils/logger");

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.guild.id !== member.client.guilds.cache.first()?.id) return;

    const now = new Date();
    const days = Math.floor(
      (now - new Date(member.user.createdAt)) / (1000 * 60 * 60 * 24)
    );

    // 1. Auto role
    if (config.welcome.autoRoleId) {
      const role = member.guild.roles.cache.get(config.welcome.autoRoleId);
      if (role) {
        try {
          await member.roles.add(role, "Auto-role khi vào server");
        } catch {
          logger.warn("[Welcome] Không có quyền gán role!");
        }
      }
    }

    // 2. Fetch dev
    let devMention = "Unknown";
    try {
      const dev = await member.client.users.fetch(config.devId);
      devMention = `${dev}`;
    } catch {}

    const avatarURL = member.displayAvatarURL({ dynamic: true });

    // 3. Welcome embed
    const embed = new EmbedBuilder()
      .setDescription(
        `## 🎉 Chào mừng ${member}!\n` +
          `> Bạn là thành viên thứ **${member.guild.memberCount}** của **${member.guild.name}**!\n` +
          `> Chúc bạn có những giây phút tuyệt vời tại đây 💙`
      )
      .setColor(0x2b2d31)
      .setTimestamp(now)
      .setAuthor({
        name: `${member.displayName} vừa tham gia!`,
        iconURL: avatarURL,
      })
      .setThumbnail(avatarURL)
      .addFields(
        {
          name: "📍 Kênh quan trọng",
          value: `<#${config.channels.welcome}> · <#${config.channels.rule}> · <#${config.channels.noti}>`,
          inline: false,
        },
        {
          name: "💬 Giao lưu",
          value: `<#${config.channels.chatting}> · <#${config.channels.share}>`,
          inline: true,
        },
        {
          name: "🎵 Giải trí",
          value: `<#${config.channels.music}> · <#${config.channels.musicVc}>`,
          inline: true,
        },
        {
          name: "🛒 Mua bán",
          value: `<#${config.channels.sell}>`,
          inline: true,
        },
        {
          name: "👤 Tài khoản",
          value: `📅 Tạo: <t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>\n🗓️ Tuổi acc: **${days} ngày**`,
          inline: true,
        },
        { name: "👾 Developer", value: devMention, inline: true }
      )
      .setFooter({
        text: `ID: ${member.id} • JUST LONELY`,
        iconURL: member.client.user.displayAvatarURL({ dynamic: true }),
      });

    if (member.guild.bannerURL()) {
      embed.setImage(member.guild.bannerURL());
    }

    const welcomeChannel =
      member.guild.channels.cache.get(config.welcome.welcomeChannelId) ||
      member.guild.systemChannel;
    if (welcomeChannel) {
      try {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
        const greetRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`welcome_greet_${member.id}`)
            .setLabel("👋 Chào mừng!")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`welcome_verify_${member.id}`)
            .setLabel("🛡️ Xác nhận thành viên")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`welcome_kick_${member.id}`)
            .setLabel("👢 Kick")
            .setStyle(ButtonStyle.Danger)
        );

        await welcomeChannel.send({
          content: `Hú hồn chưa ${member}! Có người mới kìa! 🎉`,
          embeds: [embed],
          components: [greetRow],
        });
      } catch (err) {
        logger.error(`[Welcome] Lỗi gửi welcome: ${err.message}`);
      }
    }

    // 4. DM
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`👋 Chào mừng đến với ${member.guild.name}!`)
        .setDescription(
          `Xin chào **${member.displayName}**!\n\n` +
            `Cảm ơn bạn đã tham gia **${member.guild.name}**.\n` +
            `Hãy đọc qua <#${config.channels.rule}> và tận hưởng thời gian tại đây nhé! 💙`
        )
        .setColor(0x2b2d31)
        .setTimestamp(now)
        .setFooter({ text: "JUST LONELY • Welcome" });

      if (member.guild.iconURL()) {
        dmEmbed.setThumbnail(member.guild.iconURL());
      }

      await member.send({ embeds: [dmEmbed] });
    } catch {}

    // 5. Log
    const logChannel = member.guild.channels.cache.get(
      config.welcome.logChannelId
    );
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("📥 Member mới tham gia")
        .setColor(0x57f287)
        .setTimestamp(now)
        .setThumbnail(avatarURL)
        .addFields(
          { name: "👤 User", value: `${member} (\`${member.id}\`)`, inline: false },
          { name: "📛 Tên", value: `${member}`, inline: true },
          { name: "🗓️ Tuổi acc", value: `${days} ngày`, inline: true },
          { name: "👥 Tổng members", value: `${member.guild.memberCount}`, inline: true },
          {
            name: "📅 Tạo acc",
            value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:F>`,
            inline: false,
          }
        )
        .setFooter({ text: "JUST LONELY • Join Log" });

      try {
        await logChannel.send({ embeds: [logEmbed] });
      } catch (err) {
        logger.error(`[Welcome] Lỗi log: ${err.message}`);
      }
    }
  },
};
