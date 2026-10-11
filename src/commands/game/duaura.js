const { SlashCommandBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");

const FLAVORS = [
  "Aura chuyển khoản — nhanh, gọn, lẹ!",
  "Một người hào phóng, một người vui như Tết!",
  "Hối lộ giám ngục hay tỏ tình thì tuỳ bạn 😏",
  "Tình cảm đong đầy, Aura thả ga!",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("duaura")
    .setDescription("🎁 Chuyển aura cho người khác — hối lộ, đền bù hay tỏ tình tuỳ bạn")
    .addUserOption((o) => o.setName("nguoichoi").setDescription("Người nhận aura").setRequired(true))
    .addIntegerOption((o) => o.setName("soluong").setDescription("Số aura muốn chuyển (10-99999999)").setRequired(true).setMinValue(10).setMaxValue(99999999)),

  async execute(interaction) {
    const target = interaction.options.getMember("nguoichoi");
    const amount = interaction.options.getInteger("soluong", true);
    const invokerId = interaction.user.id;

    if (!target) return game.replyErr(interaction, "❌ Không tìm thấy", "Người này không ở trong server!");
    if (target.user.bot) return game.replyErr(interaction, "🤖 Bot không cần aura", "Aura của bot là chính bạn!");
    if (target.id === invokerId) return game.replyErr(interaction, "🤡 Tự chuyển cho mình?", "Aura không nhân đôi đâu — thử `/aurabox` đi!");

    const cd = game.checkCooldown(interaction.guildId, invokerId, "duaura");
    if (cd) return game.replyErr(interaction, "⏳ Hồi chiêu", `Chờ **${game.fmtLeft(cd)}** nữa mới chuyển tiếp được!`);

    const res = aura.transfer(invokerId, target.id, amount);
    if (!res.ok) return game.replyErr(interaction, "💸 Không đủ aura", res.reason);

    game.setCooldown(interaction.guildId, invokerId, "duaura");

    // Defer trước khi sync role (có thể tạo role → chậm >3s)
    await interaction.deferReply().catch(() => {});

    await game.syncTierRole(target);
    const invoker = await interaction.guild.members.fetch(invokerId).catch(() => null);
    if (invoker) await game.syncTierRole(invoker);

    const flavor = FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
    const embed = game.errEmbed("🎁 CHUYỂN KHOẢN AURA THÀNH CÔNG", "")
      .setColor(0xf1c40f)
      .setDescription(`**${flavor}**\n\n<@${invokerId}> ➡️ <@${target.id}>`)
      .addFields(
        { name: "📤 Người gửi", value: `<@${invokerId}>\nCòn lại: **${res.from}** aura`, inline: true },
        { name: "📥 Người nhận", value: `<@${target.id}>\nTổng: **${res.to}** aura`, inline: true },
        { name: "💰 Số chuyển", value: `**${amount}** aura`, inline: true },
        { name: "🔮 Tier người nhận", value: game.auraSummary(target.id), inline: false },
      )
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }));

    return interaction.editReply({ content: `<@${invokerId}> <@${target.id}>`, embeds: [embed] });
  },
};
