const {
  activeTasks, sleep, jitter, sendWithBackoff, abortTaskInChannel,
  withHashPrefix, batchLines, pickRandomLines, handleRateLimit,
  getOrCreateWebhook, parseDelayAndCount, resolveWebhookIdentity, logSend, DEFAULT_BATCH_SIZE,
} = require("./shared");
const logger = require("../../utils/logger");

// Cú pháp: ?spam <delay> <sodong|inf> <nội dung>
// VD: ?spam 0.5 20 hello ae
// VD nhiều dòng: ?spam 0.5 10 dòng1 | dòng2 | dòng3
module.exports = {
  name: "spam",
  description: "Spam nội dung tùy chỉnh qua webhook (có # ở đầu)",
  usage: "?spam <delay> <sodong|inf> <nội dung>",
  destructive: true,
  webhook: true,

  async execute(message, args) {
    const channelId = message.channel.id;
    abortTaskInChannel(channelId);

    if (args.length < 3) {
      return message.reply("❌ Cú pháp: `?spam <delay> <sodong|inf> <nội dung>`\nVD: `?spam 0.5 20 hello ae`");
    }

    const { delay, sodong } = parseDelayAndCount(args);
    // Nội dung = từ args[2] trở đi, tách nhiều dòng bằng "|"
    const contentLines = args.slice(2).join(" ").split("|").map((l) => l.trim()).filter(Boolean);
    if (!contentLines.length) {
      return message.reply("❌ Nội dung spam trống!");
    }
    // Thêm "# " ở đầu (chữ to)
    const lines = withHashPrefix(contentLines);
    const { mentionStr, username, avatarURL } = resolveWebhookIdentity(message);

    await message.reply({
      embeds: [{
        title: "⚡ BẮT ĐẦU SPAM",
        description: `Delay: **${delay}s**\nSố tin: **${sodong === null ? "Vô hạn" : sodong}**\nDòng: **${lines.length}**\nDùng \`?stop\` để dừng.`,
        color: 0x9b59b6,
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
              logger.error(`?spam send error: ${err.message}`);
              break;
            }
          }
          await sleep(jitter(delay * 1000));
        }
        if (sentCount > 0) logSend("spam", message, sentCount);
        if (!taskData.aborted) {
          await message.channel.send({
            embeds: [{ title: "✅ SPAM XONG", description: `Đã gửi **${sentCount}** tin.`, color: 0x2ecc71 }],
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") logger.error(`?spam: ${err.message}`);
      } finally {
        try { webhook.destroy?.(); } catch {}
        activeTasks.delete(channelId);
      }
    })();
  },
};
