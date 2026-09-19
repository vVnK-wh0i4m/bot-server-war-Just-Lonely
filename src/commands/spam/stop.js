const { SlashCommandBuilder } = require("discord.js");
const { activeTasks, stopAllTasks, stopAllVoice, canUseBot, embedMsg } = require("./shared");
const { runningTasks: voiceTasks } = require("../voice/shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Dừng TOÀN BỘ — ngắt mọi hoạt động, voice, webhook, bot nghỉ luôn"),

  async execute(interaction) {
    if (!canUseBot(interaction.member)) {
      return interaction.reply({ ...embedMsg("❌ TRUY CẬP BỊ TỪ CHỐI", "Bạn chưa được cấp phép dùng bot!", 0xe74c3c), ephemeral: true });
    }

    const stoppedCount = stopAllTasks();
    const voiceDisconnected = stopAllVoice(interaction.client);

    let voiceTasksStopped = 0;
    for (const [guildId, ac] of voiceTasks) {
      ac.abort();
      voiceTasksStopped++;
    }
    voiceTasks.clear();

    await interaction.reply({
      embeds: [{
        title: "🛑 BOT ĐÃ DỪNG HOÀN TOÀN",
        description: "Tất cả hoạt động đã bị ngắt. Bot không làm gì thêm.",
        color: 0xe74c3c,
        fields: [
          { name: "Spam tasks", value: `${stoppedCount} đã dừng`, inline: true },
          { name: "Voice", value: `${voiceDisconnected + voiceTasksStopped} đã ngắt`, inline: true },
          { name: "Webhook", value: "Đã ngắt", inline: true },
          { name: "Trạng thái", value: "⏸️ Tạm dừng", inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  },
};
