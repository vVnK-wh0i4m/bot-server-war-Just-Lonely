const {
  activeTasks, sleep, jitter, sendWithBackoff, abortTaskInChannel,
  withHashPrefix, batchLines, pickRandomLines, handleRateLimit,
  getOrCreateWebhook, parseDelayAndCount, getFilePath, readFileLines,
  resolveWebhookIdentity, logSend, DEFAULT_BATCH_SIZE,
} = require("./shared");
const logger = require("../../utils/logger");

// Cú pháp: ?ngon <delay> <sodong|inf> [@tag]
// VD: ?ngon 0.5 50
// VD: ?ngon 0.3 inf @ai-đó
module.exports = {
  name: "ngon",
  description: "Spam văn từ file ngon.txt qua webhook (có # ở đầu)",
  usage: "?ngon <delay> <sodong|inf> [@tag]",
  destructive: true,
  webhook: true,

  async execute(message, args) {
    const channelId = message.channel.id;
    abortTaskInChannel(channelId);

    if (args.length < 1) {
      return message.reply("❌ Cú pháp: `?ngon <delay> <sodong|inf> [@tag]`\nVD: `?ngon 0.5 50`");
    }

    const { delay, sodong } = parseDelayAndCount(args);

    const fileLines = readFileLines(getFilePath("ngon.txt"));
    if (!fileLines || !fileLines.length) {
      return message.reply("❌ Thiếu hoặc trống `ngon.txt`!");
    }
    // Thêm "# " ở đầu nếu dòng chưa có
    const lines = withHashPrefix(fileLines);
    const { mentionStr, username, avatarURL } = resolveWebhookIdentity(message);

    await message.reply({
      embeds: [{
        title: "🚀 BẮT ĐẦU NGON",
        description: `Delay: **${delay}s**\nSố tin: **${sodong === null ? "Vô hạn" : sodong}**\nDùng \`?stop\` để dừng.`,
        color: 0xf39c12,
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
              logger.error(`?ngon send error: ${err.message}`);
              break;
            }
          }
          await sleep(jitter(delay * 1000));
        }
        if (sentCount > 0) logSend("ngon", message, sentCount);
        if (!taskData.aborted) {
          await message.channel.send({
            embeds: [{ title: "✅ NGON XONG", description: `Đã gửi **${sentCount}** tin.`, color: 0x2ecc71 }],
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") logger.error(`?ngon: ${err.message}`);
      } finally {
        try { webhook.destroy?.(); } catch {}
        activeTasks.delete(channelId);
      }
    })();
  },
};
