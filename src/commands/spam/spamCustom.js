const { SlashCommandBuilder } = require("discord.js");
const { activeTasks, spamLoop, splitCustomContent, antiDevTag, antiDevMention, isSpamBlocked, embedMsg } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("spam")
    .setDescription("Spam custom text (supports multiline, high speed)")
    .addStringOption((o) => o.setName("content").setDescription("Spam content (multiline supported)").setRequired(true))
    .addNumberOption((o) => o.setName("delay").setDescription("Delay giữa các batch (0.01-600s)").setMinValue(0.01).setMaxValue(600).setRequired(true))
    .addUserOption((o) => o.setName("tag").setDescription("Target user to mention").setRequired(false))
    .addRoleOption((o) => o.setName("role").setDescription("Target role to mention").setRequired(false))
    .addIntegerOption((o) => o.setName("sodong").setDescription("Number of messages (empty = infinite)")),

  async execute(interaction) {
    const channelId = interaction.channelId;
    if (isSpamBlocked(channelId)) {
      return interaction.reply({ ...embedMsg("❌ CẤM SPAM", "Kênh này đã bị cấm spam!", 0xe74c3c), ephemeral: true });
    }
    if (activeTasks.has(channelId)) activeTasks.get(channelId).aborted = true;

    const rawContent = interaction.options.getString("content");
    const delay = interaction.options.getNumber("delay");
    const tag = antiDevTag(interaction.options.getMember("tag"), interaction);
    const role = interaction.options.getRole("role");
    const sodong = interaction.options.getInteger("sodong") ?? null;

    let mentionStr = null;
    let targetObj = null;
    if (tag) {
      mentionStr = antiDevMention(`<@${tag.id}>`, interaction);
      targetObj = tag;
    } else if (role) {
      mentionStr = `<@&${role.id}>`;
      targetObj = { displayName: role.name };
    }

    const contentLines = splitCustomContent(rawContent);
    if (!contentLines.length) {
      return interaction.reply({ ...embedMsg("❌ LỖI", "Nội dung spam trống!", 0xe74c3c), ephemeral: true });
    }

    const targetName = targetObj?.displayName || "NO_TARGET";
    await interaction.reply({
      embeds: [{
        title: "⚡ CUSTOM SPAM",
        description: `Target: **${targetName}**\nLines: **${contentLines.length}**\nDelay: **${delay}s**`,
        color: 0x9b59b6,
        timestamp: new Date().toISOString(),
      }],
      ephemeral: true,
    });

    const ac = new AbortController();
    const taskData = {
      abort: ac.abort.bind(ac),
      aborted: false,
      startTime: Date.now(),
      user: interaction.user,
      target: targetObj || { displayName: "SPAM" },
      count: 0,
    };
    activeTasks.set(channelId, taskData);

    spamLoop(interaction, delay, targetObj, sodong, "ngon.txt", { content: contentLines, mention: mentionStr, bigText: true }).then(() => {
      const task = activeTasks.get(channelId);
      if (task) {
        const duration = Math.floor((Date.now() - task.startTime) / 1000);
        interaction.channel.send({
          embeds: [{
            title: "✅ SPAM HOÀN THÀNH",
            description: `Target: **${targetName}**\nTổng tin: **${task.count}**\nThời gian: **${duration}s**`,
            color: 0x2ecc71,
            timestamp: new Date().toISOString(),
          }],
        });
        activeTasks.delete(channelId);
      }
    });
  },
};
