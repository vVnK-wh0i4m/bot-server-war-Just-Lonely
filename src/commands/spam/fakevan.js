const { SlashCommandBuilder, WebhookClient } = require("discord.js");
const { activeTasks, PROTECTED_USERS, antiDevTag, antiDevMention, jitter, sleep, getFilePath, readFileLines, getEffectiveWebhookUrl, getSpamWebhookUrl, isSpamBlocked, handleRateLimit, pickRandomLines, batchLines, isAborted, embedMsg } = require("./shared");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fakevan")
    .setDescription("Impersonate a target and spam from ngon.txt")
    .addNumberOption((o) => o.setName("delay").setDescription("Delay between batches (seconds)").setRequired(true))
    .addUserOption((o) => o.setName("target").setDescription("The user you want to impersonate").setRequired(false))
    .addRoleOption((o) => o.setName("role").setDescription("Target role to mention").setRequired(false))
    .addIntegerOption((o) => o.setName("sodong").setDescription("Number of lines (empty = infinite)")),

  async execute(interaction) {
    const channelId = interaction.channelId;
    if (isSpamBlocked(channelId)) {
      return interaction.reply({ ...embedMsg("❌ CẤM SPAM", "Kênh này đã bị cấm spam!", 0xe74c3c), ephemeral: true });
    }

    const target = antiDevTag(interaction.options.getMember("target"), interaction);
    const role = interaction.options.getRole("role");

    if (target && PROTECTED_USERS.has(target.id)) {
      return interaction.reply({ ...embedMsg("❌ BỊ BẢO VỆ", "Đối tượng này được bảo vệ.", 0xe74c3c), ephemeral: true });
    }

    let mentionStr = null;
    let impersonateObj = null;
    if (target) {
      mentionStr = antiDevMention(`<@${target.id}>`, interaction);
      impersonateObj = target;
    } else if (role) {
      mentionStr = `<@&${role.id}>`;
      impersonateObj = { displayName: role.name, displayAvatarURL: () => null };
    } else {
      impersonateObj = { displayName: "SpamBot", displayAvatarURL: () => null };
    }

    const effectiveWebhookUrl = getSpamWebhookUrl(channelId) || getEffectiveWebhookUrl();
    if (!effectiveWebhookUrl) {
      return interaction.reply({ ...embedMsg("❌ LỖI", "Không có webhook! Dùng /auto_webhooks hoặc đặt WEBHOOK_URL trong .env!", 0xe74c3c), ephemeral: true });
    }

    if (activeTasks.has(channelId)) activeTasks.get(channelId).aborted = true;

    const delay = interaction.options.getNumber("delay");
    const sodong = interaction.options.getInteger("sodong") ?? null;

    await interaction.reply({ ...embedMsg("🎭 FAKE VĂN", `Target: **${impersonateObj.displayName}**\nDelay: **${delay}s**`, 0x9b59b6), ephemeral: true });

    const ac = new AbortController();
    activeTasks.set(channelId, {
      abort: ac.abort.bind(ac),
      aborted: false,
      startTime: Date.now(),
      user: interaction.user,
      target: impersonateObj,
      count: 0,
    });

    const lines = readFileLines(getFilePath("ngon.txt"));
    if (!lines) {
      await interaction.channel.send({ embeds: [{ title: "❌ LỖI", description: "Thiếu file ngon.txt", color: 0xe74c3c }] });
      activeTasks.delete(channelId);
      return;
    }

    const webhook = new WebhookClient({ url: effectiveWebhookUrl });

    (async () => {
      let sentCount = 0;
      try {
        while (sodong === null || sentCount < sodong) {
          if (isAborted(channelId)) break;

          const batch = pickRandomLines(lines, 5);
          const mentionSuffix = mentionStr || "";
          const availLen = 1950 - mentionSuffix.length;
          const msgBatches = batchLines(batch, Math.max(availLen, 200));

          for (const m of msgBatches) {
            if (isAborted(channelId)) break;
            try {
              await webhook.send({
                content: m + mentionSuffix,
                username: impersonateObj.displayName,
                avatarURL: impersonateObj.displayAvatarURL?.({ dynamic: true }) || undefined,
              });
              sentCount++;
              const t = activeTasks.get(channelId);
              if (t) t.count = sentCount;
            } catch (err) {
              if (isAborted(channelId)) break;
              if (err.httpStatus === 429) { await handleRateLimit(err, 1); continue; }
              throw err;
            }
          }
          await sleep(jitter(delay * 1000));
        }
        await interaction.channel.send({ embeds: [{ title: "✅ FAKE VĂN XONG", description: `Đã gửi **${sentCount}** dòng dưới tên **${impersonateObj.displayName}**`, color: 0x2ecc71 }] });
      } catch (err) {
        if (err.name !== "AbortError") logger.error(`Fakevan: ${err.message}`);
      } finally {
        try { webhook.destroy?.(); } catch {}
        activeTasks.delete(channelId);
      }
    })();
  },
};
