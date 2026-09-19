const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const config = require("../../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("devinfo")
    .setDescription("Thông tin về developer của bot"),

  async execute(interaction) {
    const devId = "1376022909096689668";
    const roleId = "1550151149359997048";
    const serverInvite = "https://discord.gg/qUk8XTdMHv";

    const dev = await interaction.client.users.fetch(devId);

    const embed = new EmbedBuilder()
      .setTitle("Developer Info")
      .setDescription(
        `Bot được phát triển và thuộc quyền sở hữu của\n**${dev.username}** & **JUST LONELY**`
      )
      .setColor(0x2b2d31)
      .setThumbnail(dev.displayAvatarURL({ dynamic: true, size: 1024 }))
      .addFields(
        {
          name: "👨‍💻 Developer",
          value: `<@${devId}>`,
          inline: true,
        },
        {
          name: "🎖️ Role",
          value: `<@&${roleId}>`,
          inline: true,
        },
        {
          name: "🔗 Links",
          value:
            `🌐 [Bio / Portfolio](https://vvnk-wh0i4m.netlify.app)\n` +
            `🔫 [Guns.lol](https://guns.lol/vivuanamky)\n` +
            `💬 [Discord Server](${serverInvite})`,
          inline: false,
        }
      )
      .setAuthor({
        name: dev.username,
        iconURL: dev.displayAvatarURL({ dynamic: true }),
      })
      .setFooter({
        text: "JUST LONELY • Dev Info",
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  },
};