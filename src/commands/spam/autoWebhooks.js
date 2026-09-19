const { SlashCommandBuilder, WebhookClient } = require("discord.js");
const { canUseDestructive, setAutoWebhookUrl, getAutoWebhookUrl, embedMsg } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("auto_webhooks")
    .setDescription("Auto-fetch or create a webhook for spam commands")
    .addStringOption((o) =>
      o.setName("action").setDescription("Action to perform").addChoices(
        { name: "Fetch/Create Webhook", value: "fetch" },
        { name: "Status", value: "status" },
        { name: "Disable Auto Webhook", value: "disable" }
      ).setRequired(false)
    ),

  async execute(interaction) {
    if (!canUseDestructive(interaction.member)) {
      return interaction.reply({ ...embedMsg("❌ TRUY CẬP BỊ TỪ CHỐI", "Role cao hơn bot hoặc được admin unlock bằng `/unlock_bot` mới dùng được.", 0xe74c3c), ephemeral: true });
    }

    const action = interaction.options.getString("action") || "fetch";

    if (action === "status") {
      const current = getAutoWebhookUrl();
      if (current) return interaction.reply({ ...embedMsg("📡 WEBHOOK STATUS", `Trạng thái: **HOẠT ĐỘNG**\nURL: ||${current}||`, 0x2ecc71), ephemeral: true });
      return interaction.reply({ ...embedMsg("📡 WEBHOOK STATUS", "Trạng thái: **CHƯA KÍCH HOẠT**", 0xf39c12), ephemeral: true });
    }

    if (action === "disable") {
      setAutoWebhookUrl(null);
      return interaction.reply({ ...embedMsg("🚫 WEBHOOK ĐÃ TẮT", "Auto webhook đã bị vô hiệu hóa.", 0xe74c3c), ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      if (!guild) return interaction.editReply({ ...embedMsg("❌ LỖI", "Lệnh này chỉ dùng được trong server!", 0xe74c3c) });

      let webhooks = await guild.fetchWebhooks();
      let webhook = webhooks.find((w) => w.name === "SpamBot-Auto" && w.token);

      if (!webhook) {
        webhook = await guild.createWebhook({ name: "SpamBot-Auto", reason: "Auto-created for spam commands" });
      }

      const webhookUrl = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;
      setAutoWebhookUrl(webhookUrl);

      return interaction.editReply({
        embeds: [{
          title: "✅ WEBHOOK ĐÃ CÀI ĐẶT",
          description: `Name: **${webhook.name}**\nChannel: <#${webhook.channelId || "unknown"}>\n\nTất cả lệnh spam sẽ dùng webhook này.\nDùng \`/auto_webhooks action:disable\` để tắt.`,
          color: 0x2ecc71,
          timestamp: new Date().toISOString(),
        }],
      });
    } catch (err) {
      return interaction.editReply({ ...embedMsg("❌ LỖI", err.message, 0xe74c3c) });
    }
  },
};
