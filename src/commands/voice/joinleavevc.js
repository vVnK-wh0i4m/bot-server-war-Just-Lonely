const { SlashCommandBuilder, ChannelType } = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
} = require("@discordjs/voice");
const logger = require("../../utils/logger");
const { runningTasks } = require("./shared");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cleanupVoice(guild) {
  const conn = getVoiceConnection(guild.id);
  if (conn) {
    try { conn.destroy(); } catch {}
    await sleep(1000);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joinleavevc")
    .setDescription("Bot vào/ra voice channel liên tục")
    .addChannelOption((o) =>
      o.setName("kenh").setDescription("Kênh voice muốn vào").addChannelTypes(ChannelType.GuildVoice)
    )
    .addNumberOption((o) =>
      o.setName("delay").setDescription("Thời gian ở trong kênh (giây, mặc định: 3)")
    )
    .addIntegerOption((o) =>
      o.setName("solan").setDescription("Số lần vào/ra (để trống = vô hạn)")
    ),

  async execute(interaction) {
    await interaction.deferReply();

    let kenh = interaction.options.getChannel("kenh");
    const delay = interaction.options.getNumber("delay") || 3;
    const solan = interaction.options.getInteger("solan") ?? null;

    if (!kenh) {
      kenh = interaction.member.voice?.channel;
      if (!kenh) return interaction.followUp("❌ Bạn chưa vào kênh voice nào.");
    }
    if (delay < 1) return interaction.followUp("❌ Delay tối thiểu là 1 giây.");

    if (runningTasks.has(interaction.guild.id)) {
      runningTasks.get(interaction.guild.id).abort();
      await sleep(1500);
    }

    await interaction.followUp(
      `✅ Bắt đầu vào/ra **${kenh.name}** | Delay: \`${delay}s\` | Số lần: \`${solan === null ? "Vô hạn" : solan}\`\nDùng \`/stopvc\` để dừng.`
    );

    const ac = new AbortController();
    runningTasks.set(interaction.guild.id, ac);

    (async () => {
      let count = 0;
      try {
        while ((solan === null || count < solan) && !ac.signal.aborted) {
          await cleanupVoice(interaction.guild);
          if (ac.signal.aborted) break;
          try {
            joinVoiceChannel({
              channelId: kenh.id,
              guildId: interaction.guild.id,
              adapterCreator: interaction.guild.voiceAdapterCreator,
              selfDeaf: false,
              selfMute: false,
            });
          } catch {
            await cleanupVoice(interaction.guild);
            await sleep(1000);
            try {
              joinVoiceChannel({
                channelId: kenh.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
              });
            } catch (err) {
              logger.error(`Voice join failed: ${err.message}`);
              break;
            }
          }
          await sleep(delay * 1000);
          if (ac.signal.aborted) break;
          await cleanupVoice(interaction.guild);
          await sleep(delay * 1000);
          count++;
        }
        await cleanupVoice(interaction.guild);
        if (ac.signal.aborted) {
          await interaction.channel.send(`🛑 Đã dừng sau **${count}** lần vào/ra **${kenh.name}**.`);
        } else {
          await interaction.channel.send(`✅ Hoàn thành **${count}** lần vào/ra **${kenh.name}**.`);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          await cleanupVoice(interaction.guild);
          await interaction.channel.send(`❌ Lỗi: \`${err.message}\``);
        }
      } finally {
        runningTasks.delete(interaction.guild.id);
      }
    })();
  },
};
