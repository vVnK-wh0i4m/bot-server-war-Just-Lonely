const { SlashCommandBuilder } = require("discord.js");
const { activeTasks, spamLoop, antiDevTag, antiDevMention, isSpamBlocked, msg, embedMsg } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nhay")
    .setDescription("Spam text from nhay.txt file")
    .addNumberOption((o) => o.setName("delay").setDescription("Delay between batches (seconds, min 0.3)").setRequired(true))
    .addUserOption((o) => o.setName("tag").setDescription("Target user to mention").setRequired(false))
    .addRoleOption((o) => o.setName("role").setDescription("Target role to mention").setRequired(false))
    .addIntegerOption((o) => o.setName("sodong").setDescription("Number of lines (empty = infinite)")),

  async execute(interaction) {
    const channelId = interaction.channelId;
    if (isSpamBlocked(channelId)) {
      return interaction.reply({ ...embedMsg("❌ CẤM SPAM", "Kênh này đã bị cấm spam!", 0xe74c3c), ephemeral: true });
    }
    if (activeTasks.has(channelId)) activeTasks.get(channelId).aborted = true;

    const delay = Math.max(interaction.options.getNumber("delay"), 0.3);
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

    const targetName = targetObj?.displayName || "NO_TARGET";
    await interaction.reply({ ...embedMsg("🚀 BẮT ĐẦU NHÂY", `Target: **${targetName}**\nDelay: **${delay}s**`, 0xf39c12), ephemeral: true });

    const ac = new AbortController();
    activeTasks.set(channelId, {
      abort: ac.abort.bind(ac),
      aborted: false,
      startTime: Date.now(),
      user: interaction.user,
      target: targetObj || { displayName: "SPAM" },
      count: 0,
    });

    spamLoop(interaction, delay, targetObj, sodong, "nhay.txt", { mention: mentionStr }).then(() => activeTasks.delete(channelId));
  },
};
