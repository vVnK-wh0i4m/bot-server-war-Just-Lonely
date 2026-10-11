const { EmbedBuilder } = require("discord.js");
const logger = require("./logger");

// ---- Cổng bắt buộc: user phải ở trong server của invite này mới dùng được lệnh ----
const INVITE_CODE = process.env.REQUIRED_INVITE_CODE || "qUk8XTdMHv";
const INVITE_URL = `https://discord.gg/${INVITE_CODE}`;

let cachedGuildId = null; // guild id lấy từ invite, chỉ fetch 1 lần
let resolveFailed = false;
let resolveRetryAt = 0;

async function resolveGuildId(client) {
  if (cachedGuildId) return cachedGuildId;
  if (resolveFailed) {
    if (Date.now() < resolveRetryAt) return null;
    resolveFailed = false; // thử lại sau mỗi phút thay vì bỏ cuộc vĩnh viễn
  }

  try {
    const invite = await client.fetchInvite(INVITE_CODE);
    cachedGuildId = invite.guild?.id || null;
    if (cachedGuildId) logger.info(`gate: invite ${INVITE_CODE} → guild ${cachedGuildId}`);
    else {
      resolveFailed = true;
      resolveRetryAt = Date.now() + 60000;
    }
  } catch (err) {
    resolveFailed = true;
    resolveRetryAt = Date.now() + 60000;
    logger.warn(`gate: không đọc được invite ${INVITE_CODE}: ${err.message}`);
  }
  return cachedGuildId;
}

async function getRequiredGuild(client) {
  const guildId = await resolveGuildId(client);
  if (!guildId) return null;

  const cached = client.guilds.cache.get(guildId);
  if (cached) return cached;

  try {
    return await client.guilds.fetch(guildId);
  } catch {
    return null;
  }
}

// Trả về true/false, hoặc null nếu không kiểm tra được (bot không ở trong server / invite hỏng)
async function isMember(client, userId) {
  const guild = await getRequiredGuild(client);
  if (!guild) return null;

  try {
    const member = await guild.members.fetch(userId);
    return !!member;
  } catch {
    return false;
  }
}

// Gọi trước MỌI lệnh: ok = true → chạy lệnh, ok = false → chặn + báo ngay trong kênh
async function ensure(client, user) {
  if (!user?.id) return { ok: true, checked: false };

  const member = await isMember(client, user.id);

  // Không kiểm tra được → cho qua (fail-open) để bot không chết khi invite sai
  if (member === null) return { ok: true, checked: false };

  if (member) return { ok: true, checked: true };

  logger.cmd(`gate: chặn ${user.tag} (${user.id}) — chưa vào ${INVITE_URL}`);
  return { ok: false, checked: true };
}

function deniedEmbed(user) {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🔒 Bạn chưa ở trong server")
    .setDescription(
      `Chưa dùng được lệnh đâu. Hãy **tham gia server** trước:\n\n` +
        `🔗 **${INVITE_URL}**\n\n` +
        `Vào xong gõ lại lệnh là dùng được ngay.`
    )
    .setFooter({ text: `Yêu cầu bắt buộc • ${user.tag}` })
    .setTimestamp();
}

module.exports = {
  INVITE_CODE,
  INVITE_URL,
  ensure,
  isMember,
  deniedEmbed,
  resolveGuildId,
};
