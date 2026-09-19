const { SlashCommandBuilder } = require("discord.js");
const { activeTasks, jitter, sleep, sendWithBackoff, isSpamBlocked, embedMsg } = require("./shared");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clearchat")
    .setDescription("Spam 2000 ký tự ẩn x nhiều dòng (dùng /stop để dừng)")
    .addIntegerOption((o) => o.setName("soluong").setDescription("Số tin nhắn (mặc định: 50)")),

  async execute(interaction) {
    const channelId = interaction.channelId;
    if (isSpamBlocked(channelId)) {
      return interaction.reply({ ...embedMsg("❌ CẤM SPAM", "Kênh này đã bị cấm spam!", 0xe74c3c), ephemeral: true });
    }
    if (activeTasks.has(channelId)) activeTasks.get(channelId).aborted = true;

    const soluong = interaction.options.getInteger("soluong") ?? 50;

    await interaction.reply({ ...embedMsg("🧹 ĐANG XÓA CHAT", `Số tin nhắn: **${soluong}**`, 0xf39c12), ephemeral: true });

    const ac = new AbortController();
    const taskData = {
      abort: ac.abort.bind(ac),
      aborted: false,
      startTime: Date.now(),
      user: interaction.user,
      target: { displayName: "CHAT_CLEAR" },
      count: 0,
    };
    activeTasks.set(channelId, taskData);

    const invisibleStr = "\u1CBC".repeat(2000);

    (async () => {
      let sentCount = 0;
      try {
        while (sentCount < soluong) {
          if (taskData.aborted) break;
          try {
            await sendWithBackoff(() => interaction.channel.send(invisibleStr));
            sentCount++;
            taskData.count = sentCount;
          } catch (err) {
            if (err.httpStatus === 403) break;
            if (err.name !== "AbortError") logger.error(`Error in clearchat: ${err.message}`);
            break;
          }
          await sleep(jitter(150, 0.4));
        }
        if (!taskData.aborted) {
          await interaction.channel.send({ embeds: [{ title: "✅ ĐÃ XÓA XONG", description: `Đã gửi **${sentCount}** tin nhắn xóa`, color: 0x2ecc71 }] });
        }
      } catch (err) {
        if (err.name !== "AbortError") logger.error(`Error in clearchat: ${err.message}`);
      } finally {
        activeTasks.delete(channelId);
      }
    })();
  },
};
