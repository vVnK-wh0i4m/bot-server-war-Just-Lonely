const { SlashCommandBuilder, WebhookClient } = require("discord.js");
const { PROTECTED_USERS, antiDevTag, sendWithBackoff, getEffectiveWebhookUrl, getSpamWebhookUrl, isSpamBlocked, embedMsg } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fake")
    .setDescription("Impersonate a user using Webhook")
    .addUserOption((o) => o.setName("target").setDescription("The user you want to impersonate").setRequired(true))
    .addStringOption((o) => o.setName("message").setDescription("The message you want them to 'say'").setRequired(true)),

  async execute(interaction) {
    const channelId = interaction.channelId;
    if (isSpamBlocked(channelId)) {
      return interaction.reply({ ...embedMsg("❌ CẤM SPAM", "Kênh này đã bị cấm spam!", 0xe74c3c), ephemeral: true });
    }

    const effectiveWebhookUrl = getSpamWebhookUrl(channelId) || getEffectiveWebhookUrl();
    if (!effectiveWebhookUrl) {
      return interaction.reply({ ...embedMsg("❌ LỖI", "Không có webhook! Dùng /auto_webhooks hoặc đặt WEBHOOK_URL trong .env!", 0xe74c3c), ephemeral: true });
    }

    const target = antiDevTag(interaction.options.getMember("target"), interaction);
    if (PROTECTED_USERS.has(target.id)) {
      return interaction.reply({ ...embedMsg("❌ BỊ BẢO VỆ", "Đối tượng này được bảo vệ.", 0xe74c3c), ephemeral: true });
    }

    await interaction.reply({ ...embedMsg("🎭 ĐANG GIẢ MẠO", `Target: **${target.displayName}**`, 0x9b59b6), ephemeral: true });

    try {
      const message = interaction.options.getString("message");
      const webhook = new WebhookClient({ url: effectiveWebhookUrl });

      const success = await sendWithBackoff(() =>
        webhook.send({
          content: message,
          username: target.displayName,
          avatarURL: target.displayAvatarURL({ dynamic: true }),
        })
      );

      try { webhook.destroy?.(); } catch {}

      if (success) {
        await interaction.followUp({ ...embedMsg("✅ GIẢ MẠO THÀNH CÔNG", `Đã gửi tin nhắn dưới tên **${target.displayName}**`, 0x2ecc71), ephemeral: true });
      } else {
        await interaction.followUp({ ...embedMsg("❌ THẤT BẠI", "Không gửi được tin nhắn qua webhook", 0xe74c3c), ephemeral: true });
      }
    } catch (err) {
      await interaction.followUp({ ...embedMsg("❌ LỖI HỆ THỐNG", err.message, 0xe74c3c), ephemeral: true });
    }
  },
};
