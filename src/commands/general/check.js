const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const os = require("os");
const fs = require("fs");
const path = require("path");
const config = require("../../../config");

const startTime = Date.now();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Kiểm tra hệ thống, Role, Token và Webhook"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    let botMember;
    try {
      botMember = await guild.members.fetch(interaction.client.user.id);
    } catch {
      botMember = guild.members.me;
    }

    // File update time
    let updateStatus;
    try {
      const filePath = path.join(config.dirs.root, "src", "index.js");
      const stat = fs.statSync(filePath);
      updateStatus = `\`${stat.mtime.toLocaleString("vi-VN")}\``;
    } catch {
      updateStatus = "⚠️ Không thể đọc file";
    }

    // Token check
    const tokenStatus =
      config.token && config.token.length > 50 ? "✅ Hợp lệ" : "❌ Thiếu hoặc sai";

    // Webhook check
    let webhookStatus = "⏳ Đang kiểm tra...";
    if (config.webhookUrl) {
      try {
        const resp = await fetch(config.webhookUrl, { method: "GET" });
        webhookStatus =
          resp.ok ? "✅ Hoạt động" : `❌ Lỗi HTTP ${resp.status}`;
      } catch {
        webhookStatus = "❌ URL không hợp lệ";
      }
    } else {
      webhookStatus = "❌ Chưa cấu hình";
    }

    // Roles
    const botRoles = botMember.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => r.toString());
    const rolesText = botRoles.length ? botRoles.join(" ") : "Không có Role";

    // Uptime
    const uptimeMs = Date.now() - startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);

    // Permissions
    const perms = botMember.permissions;
    const permText = [
      `${perms.has("SendMessages") ? "✅" : "❌"} Gửi tin`,
      `${perms.has("EmbedLinks") ? "✅" : "❌"} Nhúng`,
      `${perms.has("Connect") ? "✅" : "❌"} Voice`,
    ].join(" ");

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Hệ Thống Just Lonely")
      .setColor(0x3498db)
      .addFields(
        { name: "🔄 Cập nhật code:", value: updateStatus, inline: true },
        {
          name: "🛰️ Latency:",
          value: `\`${Math.round(interaction.client.ws.ping)}ms\``,
          inline: true,
        },
        { name: "⏳ Uptime:", value: `\`${hours}h ${minutes}m\``, inline: true },
        {
          name: "🔑 Cấu hình .env:",
          value: `• Token: ${tokenStatus}\n• Webhook: ${webhookStatus}`,
          inline: false,
        },
        { name: "🎭 Roles:", value: rolesText, inline: false },
        { name: "🛡️ Quyền cơ bản:", value: permText, inline: false }
      )
      .setFooter({
        text: `Node ${process.version} | Bot ID: ${interaction.client.user.id}`,
      });

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  },
};
