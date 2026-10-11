const { SlashCommandBuilder } = require("discord.js");
const { runCC } = require("./shared");
const game = require("../../utils/game");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chichdien")
    .setDescription("Chích điện — mute **5s**, hồi chiêu 10s, tỉ lệ trúng giảm theo chênh role")
    .addUserOption((o) => o.setName("nguoi").setDescription("Nạn nhân").setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Lệnh này cần một server để chích điện!");
    }
    const seconds = game.TUNE.mute.chich;
    await runCC(interaction, {
      cmd: "chichdien",
      kind: "chich",
      label: "⚡ CHÍCH ĐIỆN",
      seconds,
      title: "⚡ CHÍCH ĐIỆN!",
      color: 0xf1c40f,
      taunt: "Dây điện uốn lượn... **zapping!** Cảm giác tê tái à?",
    });
  },
};
