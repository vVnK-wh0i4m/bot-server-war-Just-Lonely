const { SlashCommandBuilder } = require("discord.js");
const { runCC } = require("./shared");
const game = require("../../utils/game");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leuleucay")
    .setDescription("Lêu lêu cay — mute **3s**, hồi chiêu 6s, tỉ lệ giảm theo chênh role")
    .addUserOption((o) => o.setName("nguoi").setDescription("Nạn nhân").setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Lệnh này cần một server để lêu lêu cay!");
    }
    const seconds = game.TUNE.mute.leuleu;
    await runCC(interaction, {
      cmd: "leuleucay",
      kind: "leuleu",
      label: "😏 LÊU LÊU CAY",
      seconds,
      title: "😏 LÊU LÊU CAY!",
      color: 0xe67e22,
      taunt: "**Lêu lêu!** Không cãi lại được đâu — miệng đang bị mute kìa!",
    });
  },
};
