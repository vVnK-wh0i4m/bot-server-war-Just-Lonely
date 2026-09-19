const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("av")
    .setDescription("Xem ảnh đại diện của user bất kỳ")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Chọn người muốn soi")
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser =
      interaction.options.getMember("user") || interaction.member;
    const avatarUrl = targetUser.displayAvatarURL({
      size: 1024,
      dynamic: true,
    });

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Ảnh đại diện của ${targetUser.user.username}`)
      .setColor(0x2b2d31)
      .setImage(avatarUrl)
      .setFooter({
        text: `Yêu cầu bởi: ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      });

    const downloadBtn = new ButtonBuilder()
      .setLabel("Tải xuống")
      .setStyle(ButtonStyle.Link)
      .setURL(avatarUrl)
      .setEmoji("📥");

    const copyBtn = new ButtonBuilder()
      .setCustomId("av_copy_link")
      .setLabel("Lấy link để copy")
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
      if (i.customId === "av_copy_link") {
        await i.reply({
          content: `Link ảnh gốc đây: ${avatarUrl}`,
          ephemeral: true,
        });
      }
    });
  },
};
