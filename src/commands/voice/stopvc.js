const { SlashCommandBuilder } = require("discord.js");
const { runningTasks } = require("./shared");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stopvc")
    .setDescription("Dừng vòng lặp vào/ra voice"),

  async execute(interaction) {
    await interaction.deferReply();

    const task = runningTasks.get(interaction.guild.id);
    if (!task) {
      return interaction.followUp("⚠️ Không có vòng lặp nào đang chạy.");
    }

    task.abort();
    await sleep(1000);
    await interaction.followUp("🛑 Đã dừng vòng lặp vào/ra voice.");
  },
};
