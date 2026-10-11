const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const inventory = require("../../utils/inventory");

// Bảng rơi: [tỉ lệ%, aura] — chỉ tăng, không bao giờ mất (cày free)
const DROPS = [
  [45, 5],
  [30, 10],
  [15, 25],
  [8, 50],
  [2, 100],
];

function rollDrop() {
  const r = Math.random() * 100;
  let acc = 0;
  for (const [pct, amount] of DROPS) {
    acc += pct;
    if (r < acc) return amount;
  }
  return 5;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mayman")
    .setDescription("Hộp quà may mắn — FREE, +5 đến +100 aura (không bao giờ mất), hồi chiêu 10 phút"),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Mở quà cần một server!");
    }
    const userId = interaction.user.id;
    const cdMin = Math.round(game.COOLDOWNS.mayman / 60000);
    const cd = game.checkCooldown(guild.id, userId, "mayman");
    if (cd) {
      return game.replyErr(interaction, "⏳ Quà chưa mở được", `Chờ **${game.fmtLeft(cd)}** nữa (hồi chiêu **${cdMin} phút**)!`);
    }
    game.setCooldown(guild.id, userId, "mayman");

    let amount = rollDrop();
    const dbl = inventory.popDoubleDrop(userId);
    if (dbl) amount *= 2;
    const res = aura.gain(userId, amount, { success: true });
    const grade = amount >= 50 ? "🌟 QUÁ ĐÃ" : amount >= 25 ? "✨ Ngon rồi" : "🎁 Cầm đỡ";

    const embed = new EmbedBuilder()
      .setTitle(`🎁 MỞ HỘP QUÀ — ${grade}`)
      .setColor(amount >= 50 ? 0xf1c40f : 0x2ecc71)
      .setDescription(
        `Hộp quà may mắn bật ra — **không mất aura nào**, chỉ có được!\n\n` +
          `> 🎁 Rơi trúng **+${amount} aura** (bảng rơi: 5/10/25/50/100)${dbl ? " — 🎁 **NHÂN ĐÔI** đã áp!" : ""}\n` +
          `> ${game.gameGain(res)}\n` +
          `> ⏳ Mở lại sau **${cdMin} phút**`,
      )
      .addFields({
        name: "🆓 Cày aura FREE",
        value:
          `> 💬 Chat **+2**/45s • 📦 \`/aurabox\` **+5–50**/5 phút • 🎁 \`/hangngay\` **+30–130**/24h\n` +
          `> 🎰 ${DROPS.map(([p, a]) => `${a}aura(${p}%)`).join(" • ")}`,
      })
      .setFooter({ text: "JUST LONELY · AURA GAME" })
      .setTimestamp();

    await interaction.reply({ content: `<@${userId}>`, embeds: [embed] });
  },
};
