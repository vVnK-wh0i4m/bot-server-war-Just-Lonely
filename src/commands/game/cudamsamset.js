const { SlashCommandBuilder } = require("discord.js");
const { runCC } = require("./shared");
const game = require("../../utils/game");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cudamsamset")
    .setDescription("Cú đấm sấm sét — cướp hết role rồi mute **15s**, hồi chiêu 30s, tỉ lệ giảm theo chênh role")
    .addUserOption((o) => o.setName("nguoi").setDescription("Nạn nhân").setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Lệnh này cần một server để đấm sấm sét!");
    }
    const seconds = game.TUNE.mute.cudam;
    await runCC(interaction, {
      cmd: "cudamsamset",
      kind: "strip",
      label: "⚡ CÚ ĐẤM SẤM SÉT",
      seconds,
      title: "⚡ CÚ ĐẤM SẤM SÉT!",
      color: 0xc0392b,
      taunt: "**RẦM!** Sấm sét quật tới — role bay sạch, ngồi im nghe quản trị viên thở dài... 🎁",
    });
  },
};
