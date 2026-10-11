const {
  activeTasks, jitter, sleep, sendWithBackoff, handleRateLimit,
  abortTaskInChannel, getOrCreateWebhook, resolveWebhookIdentity, logSend,
} = require("./shared");
const logger = require("../../utils/logger");

// Cú pháp: ?clearchat <sodong>
// VD: ?clearchat 50
module.exports = {
  name: "clearchat",
  description: "Spam ký tự ẩn để đẩy chat qua webhook",
  usage: "?clearchat <sodong>",
  destructive: true,
  webhook: true,

  async execute(message, args) {
    const channelId = message.channel.id;
    abortTaskInChannel(channelId);

    let soluong = parseInt(args[0], 10);
    if (isNaN(soluong) || soluong <= 0) soluong = 50;
    soluong = Math.min(soluong, 5000);

    await message.reply({
      embeds: [{ title: "🧹 ĐANG XÓA CHAT", description: `Số tin nhắn: **${soluong}**`, color: 0xf39c12, timestamp: new Date().toISOString() }],
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

    const { username, avatarURL } = resolveWebhookIdentity(message);

    // Ký tự trống hiển thị như khoảng trắng trắng trơn (không lộ dấu/ký tự lạ)
    // U+2800 Braille blank → không bị trim, không hiện glyph xấu như "ٴ"
    const BLANK_CHARS = ["\u2800", "\u3164", "\uFFA0"];
    let blankIndex = 0;
    const invisibleStr = () => BLANK_CHARS[blankIndex].repeat(2000);

    (async () => {
      let sentCount = 0;
      let emptyRetries = 0;
      try {
        while (sentCount < soluong) {
          if (taskData.aborted) break;
          try {
            await sendWithBackoff(() => webhook.send({
              content: invisibleStr(),
              username,
              avatarURL,
            }));
            sentCount++;
            taskData.count = sentCount;
          } catch (err) {
            if (taskData.aborted) break;
            if (err.httpStatus === 429 || err.code === 429) { await handleRateLimit(err, 1); continue; }
            if (err.httpStatus === 403) break;
            // Ký tự trống bị Discord coi là rỗng (400) → đổi ký tự khác rồi gửi lại
            if (err.httpStatus === 400 && blankIndex < BLANK_CHARS.length - 1 && emptyRetries < BLANK_CHARS.length) {
              blankIndex++;
              emptyRetries++;
              logger.warn(`?clearchat: đổi ký tự trống → U+${BLANK_CHARS[blankIndex].codePointAt(0).toString(16).toUpperCase()}`);
              continue;
            }
            if (err.name !== "AbortError") logger.error(`?clearchat: ${err.message}`);
            break;
          }
          await sleep(jitter(150, 0.4));
        }
        if (sentCount > 0) logSend("clearchat", message, sentCount);
        if (!taskData.aborted) {
          await message.channel.send({
            embeds: [{ title: "✅ ĐÃ XÓA XONG", description: `Đã gửi **${sentCount}** tin nhắn xóa`, color: 0x2ecc71 }],
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") logger.error(`?clearchat: ${err.message}`);
      } finally {
        try { webhook.destroy?.(); } catch {}
        activeTasks.delete(channelId);
      }
    })();
  },
};
