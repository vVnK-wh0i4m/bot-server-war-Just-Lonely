const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");

const DAY = 86400000;
const STREAK_OK = 2 * DAY; // lố hơn 2 ngày coi như đứt chuỗi

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hangngay")
    .setDescription("Nhận aura hằng ngày — FREE, +30 aura, chuỗi ngày +20/ngày (max +130), 1 lần/24h"),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Nhận thưởng cần một server!");
    }
    const userId = interaction.user.id;
    const u = aura.get(userId);
    const now = Date.now();

    if (u.lastDailyAt && now - u.lastDailyAt < DAY) {
      const left = u.lastDailyAt + DAY - now;
      return game.replyErr(
        interaction,
        "⏳ Đã nhận hôm nay",
        `Bạn đã nhận quà hằng ngày rồi — còn **${game.fmtLeft(left)}** nữa (lúc <t:${Math.floor((u.lastDailyAt + DAY) / 1000)}:T>).`,
      );
    }

    const streak = u.lastDailyAt && now - u.lastDailyAt < STREAK_OK ? (u.dailyStreak || 0) + 1 : 1;
    const bonus = Math.min(100, (streak - 1) * 20);
    const base = 30 + bonus;
    u.dailyStreak = streak;
    u.lastDailyAt = now;

    const res = aura.gain(userId, base, { success: true });
    const nextAt = now + DAY;

    const embed = new EmbedBuilder()
      .setTitle("🎁 NHẬN AURA HẰNG NGÀY!")
      .setColor(0x2ecc71)
      .setDescription(
        `Nhận thành công — đây là **cày aura FREE**!\n\n` +
          `> 🎁 Thưởng cơ bản **30** + chuỗi **+${bonus}** = **${base} aura base**\n` +
          `> 🔥 Chuỗi ngày: **${streak}** ngày (mỗi ngày +20, cap +100)\n` +
          `> ${game.gameGain(res)}\n` +
          `> ⏳ Lần nhận kế: <t:${Math.floor(nextAt / 1000)}:R>`,
      )
      .addFields({
        name: "🆓 Các cách cày aura FREE khác",
        value:
          `> 🆕 Aura thấp được **nhân bonus**: ×10 (<100K) · ×5 (<1M) · ×2 (<5M)\n` +
          `> 💬 Chat trong server: **+2** mỗi 45s (1.5% trúng **+20**)\n` +
          `> 📦 \`/aurabox\`: **+5–50** mỗi **5 phút**\n` +
          `> 🎁 \`/hangngay\`: **+30–130** mỗi **24h**\n` +
          `> 🎁 \`/mayman\`: **+5–100** mỗi **10 phút**\n` +
          `> 🏃 Thắng game (\`/tronthoat\`, \`/chichdien\`...): aura FREE`,
      })
      .setFooter({ text: "JUST LONELY · AURA GAME" })
      .setTimestamp();

    await interaction.reply({ content: `<@${userId}>`, embeds: [embed] });
  },
};
