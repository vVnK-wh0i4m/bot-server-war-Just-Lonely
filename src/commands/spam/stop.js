const { stopAllTasks } = require("./shared");

// Cú pháp: ?stop
module.exports = {
  name: "stop",
  description: "Dừng TOÀN BỘ spam đang chạy",
  usage: "?stop",
  destructive: false,
  webhook: false,

  async execute(message) {
    const count = stopAllTasks();

    await message.reply({
      embeds: [{
        title: "🛑 BOT ĐÃ DỪNG HOÀN TOÀN",
        description: "Tất cả hoạt động spam đã bị ngắt.",
        color: 0xe74c3c,
        fields: [{ name: "Spam text", value: `${count} đã dừng`, inline: true }],
        timestamp: new Date().toISOString(),
      }],
    });
  },
};
