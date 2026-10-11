const { SlashCommandBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const { fetchMember, baseEmbed, rolePenaltyLine } = require("./shared");

// Tỉ lệ: mục tiêu aura càng thấp càng dễ (5% → 50% khi target = 0 aura);
// kẻ cướp aura ≥ 3000 bị ×0.6 — aura cao được ưu ái nhưng khó kiếm thêm
const TARGET_FULL_AT = 4000;
const HIGH_AURA_PENALTY = 3000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cuopaura")
    .setDescription("Cướp aura — 5%, target aura thấp → dễ hơn, ăn 100%, hồi chiêu 120s")
    .addUserOption((o) => o.setName("nguoi").setDescription("Người muốn cướp aura").setRequired(true)),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Cướp aura cần một server để gây án!");
    }

    const invokerId = interaction.user.id;
    const targetUser = interaction.options.getUser("nguoi", true);
    const cdSec = Math.round(game.COOLDOWNS.cuopaura / 1000);

    const cd = game.checkCooldown(guild.id, invokerId, "cuopaura");
    if (cd) {
      return game.replyErr(interaction, "⏳ Đang nguội gáy", `Chờ **${game.fmtLeft(cd)}** nữa mới cướp lại (hồi chiêu **${cdSec}s**)!`);
    }

    const target = await fetchMember(guild, targetUser.id);
    const chk = game.canTarget(interaction.member, target, guild, "cc");
    if (!chk.ok) return game.replyErr(interaction, "❌ Không hợp lệ", chk.reason);

    const targetAura = aura.get(target.id).aura;
    const invokerAura = aura.get(invokerId).aura;
    let chance = 5 + Math.round((1 - Math.min(targetAura, TARGET_FULL_AT) / TARGET_FULL_AT) * 45);
    const richPenalty = invokerAura >= HIGH_AURA_PENALTY;
    if (richPenalty) chance = Math.max(2, Math.round(chance * 0.6));
    chance = game.hitChance(chance, chk.penalty, 5, invokerId);

    await interaction.reply({
      content: `<@${target.id}> <@${invokerId}>`,
      embeds: [game.castEmbed("🥷", `<@${invokerId}> đang **cướp aura** của <@${target.id}> — tỉ lệ **${chance}%**, cướp **100%** nếu trúng, hồi chiêu **${cdSec}s**`)],
    });

    try {
      game.setCooldown(guild.id, invokerId, "cuopaura");
      const roll = Math.floor(Math.random() * 100) + 1;
      const statLine =
        `> 🎯 Tỉ lệ **${chance}%** (roll **${roll}**) • ⏱️ Hồi chiêu **${cdSec}s**\n` +
        `> 📉 Target càng nghèo càng dễ cướp (0 aura = **50%**, ≥${TARGET_FULL_AT} aura = **5%**)\n` +
        (richPenalty ? `> ⚖️ Aura bạn ≥ **${HIGH_AURA_PENALTY}** — **ưu ái bạn khó được**, tỉ lệ ×**0.6**\n` : "");
      const roleLine = rolePenaltyLine(chk);

      if (roll > chance) {
        aura.resetStreak(invokerId);
        aura.bump(invokerId, "fails");
        const u = aura.get(invokerId);
        const embed = baseEmbed({
          title: "💨 CƯỚP HỤT!",
          color: 0xe74c3c,
          description:
            `<@${invokerId}> với <@${target.id}> — bị tát **${roll - chance}** điểm, cuốn mất dạng!\n\n` +
            roleLine + statLine +
            `> 🔥 Chuỗi reset • ✨ \`${u.aura}\` aura của bạn\n` +
            `> 💡 Muốn chắc tay hơn? Target **aura thấp** sẽ dễ cướp hơn!`,
        });
        return interaction.editReply({ embeds: [embed] });
      }

      const stolen = targetAura;
      if (stolen <= 0) {
        const embed = baseEmbed({
          title: "🕳️ MỤC TIÊU RỖNG",
          color: 0x95a5a6,
          description:
            `<@${target.id}> **khử một aura** — cướp được nhưng chả có gì để lấy!\n\n` +
            roleLine + statLine +
            `> 💸 Kẻ cướp tốn công • ⏱️ Vẫn hồi chiêu **${cdSec}s**`,
        });
        return interaction.editReply({ embeds: [embed] });
      }

      const res = aura.transfer(target.id, invokerId, stolen);
      if (!res.ok) return interaction.editReply({ embeds: [game.errEmbed("❌ Cướp lỗi", `\`${res.reason}\``)] });
      aura.resetStreak(target.id);
      aura.bump(invokerId, "steals");
      aura.bump(target.id, "taken");
      await game.syncTierRole(await fetchMember(guild, invokerId));
      await game.syncTierRole(target);

      const embed = baseEmbed({
        title: "🥷 CƯỚP THÀNH CÔNG!",
        color: 0x8e44ad,
        description:
          `<@${invokerId}> **cuỗm sạch** aura của <@${target.id}>!\n\n` +
          roleLine + statLine +
          `> 💰 Cướp **100%**: **-${stolen}✨** từ <@${target.id}> → **+${stolen}✨** cho bạn\n` +
          `> 📉 <@${target.id}> về \`${res.from}\` aura • 🔥 Chuỗi của họ reset\n` +
          `> 📊 Bạn: ${game.auraSummary(invokerId).split("\n")[0]}`,
      });
      embed.addFields(
        { name: "🔮 AURA của bạn", value: game.auraSummary(invokerId), inline: false },
        { name: "📌 Trạng thái mục tiêu", value: game.statusLines(guild.id, target.id).join("\n"), inline: false },
      );
      return interaction.editReply({ content: `<@${target.id}> <@${invokerId}>`, embeds: [embed] });
    } catch (err) {
      return interaction.editReply({ embeds: [game.errEmbed("❌ Cướp lỗi", `\`${err.message}\``)] });
    }
  },
};
