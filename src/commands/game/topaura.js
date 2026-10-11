const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const aura = require("../../utils/aura");

const MEDALS = ["🥇", "🥈", "🥉"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("topaura")
    .setDescription("Bảng xếp hạng AURA của server — ai mới là baddest?"),

  async execute(interaction) {
    const list = aura.top(10);
    if (!list.length) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📊 BẢNG XẾP HẠNG AURA")
            .setColor(0x95a5a6)
            .setDescription("Chưa có ai tích lũy aura. Đi **quậy** (`/chichdien`, `/batcocloli`, `/nhothamloli`) trước đã!")
            .setFooter({ text: "JUST LONELY · AURA GAME" })
            .setTimestamp(),
        ],
      });
    }

    const lines = list.map((e, i) => {
      const tier = aura.tierOf(e.aura);
      const medal = MEDALS[i] || `**#${i + 1}**`;
      return `${medal} <@${e.userId}> — \`${e.aura}\` aura ${tier.icon} *${tier.name}* • 🔥x${e.streak}`;
    });

    const me = aura.rank(interaction.user.id);
    const u = aura.get(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle("📊 TOP AURA — SERVER")
      .setColor(0xf1c40f)
      .setDescription(lines.join("\n"))
      .addFields({
        name: "🔮 Của bạn",
        value: me
          ? `📍 Hạng **#${me.position}**/${me.total} • ✨ \`${u.aura}\` aura • 👥 **${aura.slotsFor(u.aura)}** slot • 🛡️ **${aura.immunityFor(u.aura)}%** miễn khống chế`
          : `✨ \`${u.aura}\` aura — chưa vào top. Dùng \`/flexaura\` xem chi tiết!`,
        inline: false,
      })
      .setFooter({ text: "JUST LONELY · AURA GAME" })
      .setTimestamp();

    return interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embed] });
  },
};

module.exports.MEDALS = MEDALS;
