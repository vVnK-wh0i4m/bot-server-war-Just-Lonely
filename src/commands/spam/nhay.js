const {
  activeTasks, sleep, jitter, sendWithBackoff, abortTaskInChannel,
  batchLines, pickRandomLines, handleRateLimit,
  getOrCreateWebhook, parseDelayAndCount, getFilePath, readFileLines,
  resolveWebhookIdentity, logSend, DEFAULT_BATCH_SIZE,
} = require("./shared");
const logger = require("../../utils/logger");

// File nhay.txt đã có sẵn "# " nên không thêm nữa
// Cú pháp: ?nhay <delay> <sodong|inf> [@tag]
module.exports = {
  name: "nhay",
  description: "Spam text từ file nhay.txt qua webhook",
  usage: "?nhay <delay> <sodong|inf> [@tag]",
  destructive: true,
  webhook: true,

  async execute(message, args) {
    const channelId = message.channel.id;
    abortTaskInChannel(channelId);

    if (args.length < 1) {
      return message.reply("❌ Cú pháp: `?nhay <delay> <sodong|inf> [@tag]`\nVD: `?nhay 0.5 50`");
    }

    const { delay, sodong } = parseDelayAndCount(args);

    const lines = readFileLines(getFilePath("nhay.txt"));
    if (!lines || !lines.length) {
      return message.reply("❌ Thiếu hoặc trống `nhay.txt`!");
    }
    const { mentionStr, username, avatarURL } = resolveWebhookIdentity(message);

    await message.reply({
      embeds: [{
        title: "🚀 BẮT ĐẦU NHÂY",
        description: `Delay: **${delay}s**\nSố tin: **${sodong === null ? "Vô hạn" : sodong}**\nDùng \`?stop\` để dừng.`,
        color: 0xe74c3c,
        timestamp: new Date().toISOString(),
      }],
    });

    let webhook;
    try {
      webhook = await getOrCreateWebhook(message.channel);
    } catch (err) {
      return message.reply(`❌ Không tạo được webhook: \`${err.message}\` (bot cần quyền ManageWebhooks)`);
    }

    const ac = new AbortController();
    const taskData = { abort: ac.abort.bind(ac), aborted: false, startTime: Date.now(), user: message.author, count: 0 };
    activeTasks.set(channelId, taskData);

    (async () => {
      let sentCount = 0;
      try {
        while (sodong === null || sentCount < sodong) {
          if (taskData.aborted) break;
          const remaining = sodong === null ? DEFAULT_BATCH_SIZE : Math.min(DEFAULT_BATCH_SIZE, sodong - sentCount);
          const batch = pickRandomLines(lines, remaining);
          const availLen = 1950 - mentionStr.length;
          const msgBatches = batchLines(batch, Math.max(availLen, 200));
          for (const m of msgBatches) {
            if (taskData.aborted) break;
            try {
              await sendWithBackoff(() => webhook.send({ content: m + mentionStr, username, avatarURL }));
              sentCount++;
              taskData.count = sentCount;
            } catch (err) {
              if (taskData.aborted) break;
              if (err.httpStatus === 429 || err.code === 429) { await handleRateLimit(err, 1); continue; }
              if (err.name === "AbortError") break;
              logger.error(`?nhay send error: ${err.message}`);
              break;
            }
          }
          await sleep(jitter(delay * 1000));
        }
        if (sentCount > 0) logSend("nhay", message, sentCount);
        if (!taskData.aborted) {
          await message.channel.send({
            embeds: [{ title: "✅ NHÂY XONG", description: `Đã gửi **${sentCount}** tin.`, color: 0x2ecc71 }],
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") logger.error(`?nhay: ${err.message}`);
      } finally {
        try { webhook.destroy?.(); } catch {}
        activeTasks.delete(channelId);
      }
    })();
  },
};
