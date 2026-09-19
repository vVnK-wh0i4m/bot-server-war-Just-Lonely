const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("svav")
    .setDescription("Xem ảnh đại diện của Server"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    if (!guild.iconURL()) {
      return interaction.followUp(
        "❌ Server này làm gì có ảnh đại diện mà soi ông ơi!"
      );
    }

    const iconUrl = guild.iconURL({ size: 1024, dynamic: true });

    const embed = new EmbedBuilder()
      .setTitle(`🏰 Ảnh đại diện của Server: ${guild.name}`)
      .setColor(0x2b2d31)
      .setImage(iconUrl)
      .setFooter({
        text: `Yêu cầu bởi: ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      });

    const downloadBtn = new ButtonBuilder()
      .setLabel("Tải xuống Icon")
      .setStyle(ButtonStyle.Link)
      .setURL(iconUrl)
      .setEmoji("🖼️");

    const copyBtn = new ButtonBuilder()
      .setCustomId("svav_copy_icon")
      .setLabel("Lấy link icon")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔗");

    const row = new ActionRowBuilder().addComponents(downloadBtn, copyBtn);

    const response = await interaction.followUp({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "svav_copy_icon") {
        await i.reply({
          content: `Link icon server đây: ${iconUrl}`,
          ephemeral: true,
        });
      }
    });
  },
};
