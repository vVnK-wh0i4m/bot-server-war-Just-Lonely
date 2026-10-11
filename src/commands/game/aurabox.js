const { SlashCommandBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const inventory = require("../../utils/inventory");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("aurabox")
    .setDescription("Mở rương AURA bí ẩn — nhận 5-50 aura ngẫu nhiên (hồi chiêu 5 phút)"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const cd = game.checkCooldown(interaction.guildId, userId, "aurabox");
    if (cd) {
      return game.replyErr(interaction, "⏳ Rương đang nạp năng lượng", `Mở lại được sau **${game.fmtLeft(cd)}**!`);
    }

    await interaction.reply({
      content: `<@${userId}>`,
      embeds: [game.castEmbed("📦", `<@${userId}> đang bóc tem rương AURA...`)],
    });

    try {
      game.setCooldown(interaction.guildId, userId, "aurabox");
      const { AURA_GAIN } = game;
      const base = Math.floor(Math.random() * (AURA_GAIN.boxMax - AURA_GAIN.boxMin + 1)) + AURA_GAIN.boxMin;

      // Jackpot 7% → nhân 3
      const jackpot = Math.random() < 0.07;
      let roll = jackpot ? base * 3 : base;
      const dbl = inventory.popDoubleDrop(userId);
      if (dbl) roll *= 2;
      const g = aura.gain(userId, roll, { success: true });
      const guild = await game.fetchGuild(interaction.guildId);
      const member = await guild?.members?.fetch(userId).catch(() => null);
      if (member) await game.syncTierRole(member);

      const tier = aura.tierOf(g.total);
      const p = aura.progressInfo(g.total);
      const embed = game.errEmbed(jackpot ? "🎰 JACKPOT — RƯƠNG VÀNG!" : "📦 RƯƠNG AURA MỞ RA!", "");
      embed
        .setColor(jackpot ? 0xf1c40f : 0x9b59b6)
        .setDescription(
          `<@${userId}> mở rương và nhận:\n\n` +
            `> ✨ **+${g.amount} AURA** → \`${g.total}\`${jackpot ? " 🎰 **x3 JACKPOT!**" : ""}\n` +
            (dbl ? `> 🎁 **HỘP QUÀ NHÂN ĐÔI** — đã x2 số aura rương này!\n` : "") +
            `> ${game.auraGainLine(userId, g)}\n` +
            `> 🔥 Chuỗi **x${g.streak}** • 📍 Tier **${tier.icon} ${tier.name}**\n` +
            `> 👥 Slot **${aura.slotsFor(g.total)}** • 🛡️ Miễn khống chế **${aura.immunityFor(g.total)}%**\n` +
            `> ${p.bar} \`${p.into}/100\` → slot kế **${p.nextSlot}**`,
        )
        .setFooter({ text: "JUST LONELY · AURA GAME · Hồi chiêu 5 phút" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({ embeds: [game.errEmbed("❌ Rương hỏng", `\`${err.message}\``)] });
    }
  },
};
