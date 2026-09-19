const { SlashCommandBuilder, ChannelType } = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("../../utils/logger");
const { runningTasks } = require("./shared");
const { isSpamBlocked, embedMsg } = require("../spam/shared");

const AUDIO_FILE = path.resolve(__dirname, "..", "..", "..", "xavc.mp3");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xavoice")
    .setDescription("Xả file mp3 vào voice channel (spam voice)"),

  async execute(interaction) {
    const guildId = interaction.guild?.id;
    if (!guildId) {
      return interaction.reply({ ...embedMsg("❌ LỖI", "Lệnh này chỉ dùng được trong server!", 0xe74c3c), ephemeral: true });
    }

    if (isSpamBlocked(interaction.channelId)) {
      return interaction.reply({ ...embedMsg("❌ CẤM SPAM", "Kênh này đã bị cấm spam!", 0xe74c3c), ephemeral: true });
    }

    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ ...embedMsg("❌ LỖI", "Bạn chưa vào kênh voice nào!", 0xe74c3c), ephemeral: true });
    }

    if (!fs.existsSync(AUDIO_FILE)) {
      return interaction.reply({ ...embedMsg("❌ LỖI", "Không tìm thấy file xavc.mp3!", 0xe74c3c), ephemeral: true });
    }

    if (runningTasks.has(guildId)) {
      runningTasks.get(guildId).abort();
      await new Promise((r) => setTimeout(r, 1500));
    }

    await interaction.reply({
      embeds: [{
        title: "🔊 XẢ VOICE",
        description: `Kênh: **${voiceChannel.name}**\nFile: **xavc.mp3**\nVolume: **MAX**\nBoost 2-4kHz: **MAX**\nLặp: **Vô hạn**\n\nDùng \`/stop\` để dừng.`,
        color: 0xe74c3c,
        timestamp: new Date().toISOString(),
      }],
    });

    const ac = new AbortController();
    runningTasks.set(guildId, ac);

    const conn = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    conn.subscribe(player);

    const playLoop = () => {
      if (ac.signal.aborted) return;

      const ffmpeg = spawn(getFfmpegPath(), [
        "-re",
        "-i", AUDIO_FILE,
        "-af", [
          "volume=10dB",
          "equalizer=f=3000:t=q:w=1:g=20",
          "equalizer=f=2500:t=q:w=1:g=15",
          "equalizer=f=3500:t=q:w=1:g=15",
          "equalizer=f=2000:t=q:w=1:g=10",
          "equalizer=f=4000:t=q:w=1:g=10",
          "loudnorm=I=-14:TP=-1:LRA=11",
        ].join(","),
        "-f", "opus",
        "-ar", "48000",
        "-ac", "2",
        "pipe:1",
      ], { stdio: ["ignore", "pipe", "ignore"] });

      ffmpeg.on("error", (err) => {
        logger.error(`[xavoice] ffmpeg error: ${err.message}`);
        if (!ac.signal.aborted) setTimeout(playLoop, 2000);
      });

      const resource = createAudioResource(ffmpeg.stdout, { inputType: 2 });
      player.play(resource);

      player.once(AudioPlayerStatus.Idle, () => {
        if (!ac.signal.aborted) setTimeout(playLoop, 500);
      });

      player.once("error", (err) => {
        logger.error(`[xavoice] player error: ${err.message}`);
        if (!ac.signal.aborted) setTimeout(playLoop, 2000);
      });
    };

    playLoop();

    const checkAlive = setInterval(() => {
      if (ac.signal.aborted) {
        clearInterval(checkAlive);
        try { player.stop(); } catch {}
        try { conn.destroy(); } catch {}
        runningTasks.delete(guildId);
      }
    }, 2000);

    ac.signal.addEventListener("abort", () => {
      clearInterval(checkAlive);
      try { player.stop(); } catch {}
      try { conn.destroy(); } catch {}
      runningTasks.delete(guildId);
    });
  },
};

function getFfmpegPath() {
  try { return require("ffmpeg-static"); } catch {}
  return "ffmpeg";
}
