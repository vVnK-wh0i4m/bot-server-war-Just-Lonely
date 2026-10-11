const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, PermissionFlagsBits,
} = require("discord.js");
const logger = require("./logger");
const history = require("./history");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "duatop.json");

const ALLOWED_GUILD = "1523310158715949156";
const ROLE_30 = "1553401666303168613";
const ROLE_50_TOP3 = "1553401000864260196";
const BOARD_CHANNEL = "📊-bxh-moi-gioi";
const TOP_SIZE = 20;
const MAX_JOINED = 300;

// Dữ liệu lưu theo từng server — state.guilds[guildId] = { channelId, messageId, invites, creators, lastUpdate }
let state = { guilds: {} };
let saveTimer = null;

function emptyGuildState() {
  return { channelId: null, messageId: null, invites: {}, creators: {}, lastUpdate: 0 };
}

function normalizeGuildState(g) {
  return { ...emptyGuildState(), ...(g || {}), invites: (g && g.invites) || {}, creators: (g && g.creators) || {} };
}

function load() {
  try {
    if (!fs.existsSync(FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));

    if (parsed && parsed.guilds) {
      state = { guilds: {} };
      for (const [gid, g] of Object.entries(parsed.guilds)) state.guilds[gid] = normalizeGuildState(g);
      return;
    }

    // Dữ liệu cũ (đơn server) → chuyển sang dạng theo server, giữ nguyên số liệu
    state = {
      guilds: {
        [ALLOWED_GUILD]: normalizeGuildState({
          channelId: parsed?.channelId || null,
          messageId: parsed?.messageId || null,
          invites: parsed?.invites || {},
          creators: parsed?.creators || {},
          lastUpdate: parsed?.lastUpdate || 0,
        }),
      },
    };
  } catch (err) {
    logger.warn(`duatop load failed: ${err.message}`);
    state = { guilds: {} };
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushNow, 300);
}

function flushNow() {
  clearTimeout(saveTimer);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    logger.error(`duatop save failed: ${err.message}`);
  }
}

function getState() {
  return state;
}

// Đọc (không tạo mới) — trả về bản sao rỗng nếu server chưa có dữ liệu
function gs(guildId) {
  return state.guilds[guildId] || emptyGuildState();
}

// Ghi (tạo mới nếu chưa có)
function gsMut(guildId) {
  if (!state.guilds[guildId]) state.guilds[guildId] = emptyGuildState();
  return state.guilds[guildId];
}

function getCreator(guildId, userId) {
  const g = gsMut(guildId);
  if (!g.creators[userId]) g.creators[userId] = { tag: null, total: 0, links: [], joined: [] };
  return g.creators[userId];
}

function topList(guildId, limit = TOP_SIZE) {
  return Object.entries(gs(guildId).creators)
    .map(([id, c]) => ({ id, tag: c.tag, total: c.total || 0 }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function rankOf(guildId, userId) {
  const all = topList(guildId, Number.MAX_SAFE_INTEGER);
  const idx = all.findIndex((c) => c.id === userId);
  return idx === -1 ? null : idx + 1;
}

// Số người vào tổng của 1 server — nguồn duy nhất cho mọi embed
function totalJoins(guildId) {
  return Object.values(gs(guildId).creators).reduce((s, c) => s + (c.total || 0), 0);
}

function fmtTime(t) {
  return new Date(t).toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nameOf(id, fallback) {
  return fallback || (id ? `<@${id}>` : "?");
}

// Ghi danh sách người vào — luôn cộng dồn đúng bằng số lượng để khớp với tổng
function pushJoined(creator, source, count = 1) {
  creator.joined = creator.joined || [];
  for (let i = 0; i < count; i++) {
    creator.joined.push({
      id: source.id || null,
      tag: source.tag || "Thành viên (không rõ)",
      at: Date.now(),
    });
  }
  if (creator.joined.length > MAX_JOINED) creator.joined = creator.joined.slice(-MAX_JOINED);
}

// ---- Bảng xếp hạng (tin "ghim" tương tác, cập nhật realtime) ----
function renderBoard(client, guildId) {
  const g = gs(guildId);
  const top = topList(guildId, TOP_SIZE);
  const joins = totalJoins(guildId);
  const linkCount = Object.keys(g.invites).length;

  const boardLines = top.length
    ? top.map((c, i) => `**${i + 1}.** ${nameOf(c.id, c.tag)} — \`${c.total}\` người`).join("\n")
    : "_Chưa có ai tạo link_";

  const embed = new EmbedBuilder()
    .setTitle("📈 BẢNG XẾP HẠNG MỜI — REALTIME")
    .setColor(0xff4655)
    .setDescription(
      `**Tổng người vào qua link:** \`${joins}\` • **Link đang hoạt động:** \`${linkCount}\`\n\n${boardLines}`,
    )
    .setFooter({ text: `Cập nhật ${fmtTime(g.lastUpdate || Date.now())} • Nhấn nút hoặc chọn danh sách bên dưới` });

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("duatop_create").setLabel("Tạo link mời").setStyle(ButtonStyle.Success).setEmoji("➕"),
      new ButtonBuilder().setCustomId("duatop_board").setLabel("Xem BHX").setStyle(ButtonStyle.Primary).setEmoji("🏆"),
      new ButtonBuilder().setCustomId("duatop_members").setLabel("Thành viên của tôi").setStyle(ButtonStyle.Secondary).setEmoji("👥"),
    ),
  ];

  if (top.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("duatop_select")
          .setPlaceholder("Chọn người để xem chi tiết…")
          .addOptions(
            top.slice(0, 25).map((c, i) => ({
              label: `${i + 1}. ${nameOf(c.id, c.tag).replace(/<@|>/g, "")} — ${c.total} người`.slice(0, 100),
              description: `ID ${c.id}`.slice(0, 100),
              value: `duatop_user_${c.id}`,
            })),
          ),
      ),
    );
  }

  return { embeds: [embed], components: rows };
}

// ---- Kênh chứa bảng ----
async function ensureBoardChannel(guild) {
  const g = gsMut(guild.id);

  if (g.channelId) {
    const cached = guild.channels.cache.get(g.channelId);
    if (cached) return cached;
    const fetched = await guild.channels.fetch(g.channelId).catch(() => null);
    if (fetched) return fetched;
  }

  const existing = guild.channels.cache.find((c) => c.name === BOARD_CHANNEL);
  if (existing) {
    g.channelId = existing.id;
    save();
    return existing;
  }

  const created = await guild.channels.create({
    name: BOARD_CHANNEL,
    type: ChannelType.GuildText,
    reason: "duatop: kênh bảng xếp hạng",
  });
  g.channelId = created.id;
  save();
  history.record("duatop", "channel.create", { guild: guild.id, detail: `#${created.name}` });
  return created;
}

// Tạo mới hoặc cập nhật tin bảng (đẩy lên + ghim)
async function publishBoard(guild, client) {
  const g = gsMut(guild.id);
  const channel = await ensureBoardChannel(guild);
  const payload = renderBoard(client, guild.id);

  let message = g.messageId ? await channel.messages.fetch(g.messageId).catch(() => null) : null;
  if (message) {
    await message.edit(payload);
  } else {
    message = await channel.send(payload);
    g.messageId = message.id;
    await message.pin().catch(() => {});
  }

  g.channelId = channel.id;
  g.lastUpdate = Date.now();
  save();
  return { channel, message };
}

// Cập nhật tin bảng có sẵn của 1 server
async function refreshBoard(client, guildId = ALLOWED_GUILD) {
  const g = state.guilds[guildId];
  if (!g || !g.messageId || !g.channelId) return false;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;
  const channel = guild.channels.cache.get(g.channelId);
  if (!channel) return false;
  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  if (!message) return false;
  g.lastUpdate = Date.now();
  await message.edit(renderBoard(client, guildId)).catch(() => {});
  return true;
}

// Cập nhật mọi bảng mà bot đang giữ
async function refreshAllBoards(client) {
  let n = 0;
  for (const guildId of Object.keys(state.guilds)) {
    if (await refreshBoard(client, guildId)) n++;
  }
  return n;
}

// ---- Tạo link mời ----
async function createInvite(guild, creatorId, creatorTag) {
  const g = gsMut(guild.id);
  const creator = getCreator(guild.id, creatorId);
  creator.tag = creatorTag || creator.tag;

  let target = g.channelId ? guild.channels.cache.get(g.channelId) : null;
  if (!target || !target.isTextBased?.()) {
    target =
      guild.systemChannel ||
      guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite),
      );
  }
  if (!target) throw new Error("Không tìm được kênh để tạo link");

  const invite = await guild.invites.create(target, {
    maxAge: 0,
    maxUses: 0,
    unique: true,
    reason: `duatop: ${creatorTag || creatorId}`,
  });

  g.invites[invite.code] = {
    creatorId,
    channelId: target.id,
    createdAt: Date.now(),
    uses: invite.uses || 0,
  };
  if (!creator.links.includes(invite.code)) creator.links.push(invite.code);
  g.lastUpdate = Date.now();
  save();

  history.record("duatop", "invite.create", {
    user: creatorTag || creatorId,
    guild: guild.id,
    detail: `discord.gg/${invite.code} → #${target.name}`,
  });

  return { url: `https://discord.gg/${invite.code}`, code: invite.code, channel: target };
}

// Đồng bộ số lượt dùng khi bot start — link bị lỡ lúc bot tắt được cộng lại vào bảng
async function cacheInvites(guild) {
  const g = state.guilds[guild.id];
  if (!g || !Object.keys(g.invites).length) return;

  let invites;
  try {
    invites = await guild.invites.fetch();
  } catch (err) {
    logger.warn(`duatop cache invites (${guild.id}): ${err.message}`);
    return;
  }

  const resynced = [];
  for (const [code, inv] of invites) {
    const tracked = g.invites[code];
    if (!tracked) continue;
    const uses = inv.uses || 0;
    if (uses > tracked.uses) {
      const delta = uses - tracked.uses;
      const creator = getCreator(guild.id, tracked.creatorId);
      creator.total = (creator.total || 0) + delta;
      pushJoined(creator, { id: null, tag: "Thành viên (vào khi bot tắt)" }, delta);
      resynced.push(`discord.gg/${code} +${delta}`);
    }
    tracked.uses = uses;
  }

  if (resynced.length) {
    g.lastUpdate = Date.now();
    history.record("duatop", "invite.resync", { guild: guild.id, detail: resynced.join(", ") });
  }
  save();
}

// ---- Thành viên vào qua link ----
async function handleMemberJoin(guild, member) {
  const g = state.guilds[guild.id];
  if (!g || !Object.keys(g.invites).length) return;

  let invites;
  try {
    invites = await guild.invites.fetch();
  } catch (err) {
    logger.warn(`duatop fetch invites: ${err.message}`);
    return;
  }

  // Tính đúng số lượt tăng TỪNG link (trước đây gộp vào 1 chỗ nên lệch chủ link)
  const increased = [];
  for (const [code, inv] of invites) {
    const tracked = g.invites[code];
    if (!tracked) continue;
    const uses = inv.uses || 0;
    if (uses > tracked.uses) increased.push({ code, tracked, delta: uses - tracked.uses });
    tracked.uses = uses;
  }
  if (!increased.length) return;

  increased.sort((a, b) => a.delta - b.delta);

  let attributed = false;
  let totalDelta = 0;
  for (const inc of increased) {
    const creator = getCreator(guild.id, inc.tracked.creatorId);
    creator.total = (creator.total || 0) + inc.delta;
    totalDelta += inc.delta;
    for (let i = 0; i < inc.delta; i++) {
      if (!attributed) {
        pushJoined(creator, { id: member.id, tag: member.user.tag }, 1);
        attributed = true;
      } else {
        pushJoined(creator, { id: null, tag: "Thành viên (không rõ)" }, 1);
      }
    }
  }

  g.lastUpdate = Date.now();
  save();

  const main = increased[0];
  history.record("duatop", "member.join", {
    user: member.user.tag,
    guild: guild.id,
    detail: `+${totalDelta} qua link của ${getCreator(guild.id, main.tracked.creatorId).tag || main.tracked.creatorId}`,
  });

  for (const inc of increased) await applyRoles(guild, inc.tracked.creatorId);
  await refreshBoard(guild.client, guild.id);
}

// Gán role cho người tạo link khi đạt ngưỡng
async function applyRoles(guild, creatorId) {
  const g = state.guilds[guild.id];
  const creator = g?.creators[creatorId];
  if (!creator) return;

  const total = creator.total || 0;
  const rank = rankOf(guild.id, creatorId);
  const member = await guild.members.fetch(creatorId).catch(() => null);
  if (!member) return;

  const wanted = [];
  if (total >= 30 && guild.roles.cache.has(ROLE_30)) wanted.push(ROLE_30);
  if (total >= 50 && rank && rank <= 3 && guild.roles.cache.has(ROLE_50_TOP3)) wanted.push(ROLE_50_TOP3);

  for (const roleId of wanted) {
    if (member.roles.cache.has(roleId)) continue;
    try {
      await member.roles.add(roleId);
      history.record("duatop", "role.grant", {
        user: member.user.tag,
        guild: guild.id,
        detail: `role ${roleId} • tổng ${total} • hạng ${rank}`,
      });
    } catch (err) {
      history.record("duatop", "role.grant", {
        user: member.user.tag,
        guild: guild.id,
        detail: `role ${roleId} lỗi: ${err.message}`,
        ok: false,
      });
      logger.error(`duatop role grant: ${err.message}`);
    }
  }
}

// ---- Embed cho tin ẩn (tự xóa sau 1 phút) — cùng nguồn dữ liệu với tin bảng ----
function inviteLines(guildId, userId) {
  const g = gs(guildId);
  const creator = g.creators[userId];
  const links = creator?.links || [];
  if (!links.length) return "_Chưa có link — bấm **➕ Tạo link mời**_";

  return links
    .slice(-3)
    .reverse()
    .map((code) => {
      const info = g.invites[code];
      return `https://discord.gg/${code} — \`${info ? info.uses || 0 : 0}\` lượt dùng`;
    })
    .join("\n");
}

function renderTopEmbed(client, guildId, userId) {
  const top = topList(guildId, TOP_SIZE);
  const me = gs(guildId).creators[userId];
  const joins = totalJoins(guildId);
  const linkCount = Object.keys(gs(guildId).invites).length;

  const lines = top.length
    ? top.map((c, i) => `**${i + 1}.** ${nameOf(c.id, c.tag)} — \`${c.total}\` người`).join("\n")
    : "_Chưa có ai_";

  const embed = new EmbedBuilder()
    .setTitle("🏆 BẢNG XẾP HẠNG — TOP 20")
    .setColor(0xff4655)
    .setDescription(`**Tổng người vào qua link:** \`${joins}\` • **Link đang hoạt động:** \`${linkCount}\`\n\n${lines}`)
    .addFields(
      {
        name: "Của bạn",
        value: me
          ? `Số người đã vào qua link: **${me.total || 0}**\nHạng hiện tại: **${rankOf(guildId, userId) || "—"}**\nLink đã tạo: **${(me.links || []).length}**`
          : "Bạn chưa tạo link nào.",
        inline: false,
      },
      { name: "🔗 Link mời của bạn", value: inviteLines(guildId, userId), inline: false },
    )
    .setFooter({ text: `Giống tin bảng • Tổng cộng: ${joins} người • Tin này tự xóa sau 1 phút` });

  return { embeds: [embed] };
}

function renderMembersEmbed(guildId, userId) {
  const creator = gs(guildId).creators[userId];
  const joined = creator?.joined || [];
  const total = creator?.total || 0;

  const lines = joined.length
    ? joined
        .slice(-30)
        .reverse()
        .map((j, i) => `${i + 1}. ${j.id ? `**${j.tag}**` : `*${j.tag}*`} — ${fmtTime(j.at)}`)
        .join("\n")
    : "_Chưa có thành viên nào vào qua link của bạn_";

  const embed = new EmbedBuilder()
    .setTitle("👥 THÀNH VIÊN ĐÃ VÀO QUA LINK CỦA BẠN")
    .setColor(0x2ecc71)
    .setDescription(lines.length > 3900 ? `${lines.slice(0, 3900)}…` : lines)
    .addFields({
      name: "🔗 Link mời của bạn",
      value: inviteLines(guildId, userId),
      inline: false,
    })
    .setFooter({
      text: `Tổng người vào: ${total} • Đã ghi ${joined.length} lượt • Hiện 30 gần nhất • Tự xóa sau 1 phút`,
    });

  return { embeds: [embed] };
}

function renderCreatorEmbed(guildId, targetId) {
  const creator = gs(guildId).creators[targetId];
  if (!creator) {
    return { embeds: [new EmbedBuilder().setTitle("❌ Không có dữ liệu").setColor(0xe74c3c).setDescription("Người này chưa tạo link.")] };
  }

  const joined = (creator.joined || []).slice(-30).reverse();
  const lines = joined.length
    ? joined.map((j, i) => `${i + 1}. ${j.id ? `**${j.tag}**` : `*${j.tag}*`} — ${fmtTime(j.at)}`).join("\n")
    : "_Chưa có ai_";

  const embed = new EmbedBuilder()
    .setTitle(`📊 CHI TIẾT: ${creator.tag || targetId}`)
    .setColor(0xff4655)
    .addFields(
      { name: "Tổng người vào", value: `**${creator.total || 0}**`, inline: true },
      { name: "Hạng", value: `**${rankOf(guildId, targetId) || "—"}**`, inline: true },
      { name: "Link đã tạo", value: `**${(creator.links || []).length}**`, inline: true },
      { name: "🔗 Link mời", value: inviteLines(guildId, targetId), inline: false },
      { name: "Thành viên vào (30 gần nhất)", value: lines.length > 900 ? `${lines.slice(0, 900)}…` : lines, inline: false },
    )
    .setFooter({ text: "Tự xóa sau 1 phút" });

  return { embeds: [embed] };
}

load();
// Không mất số liệu khi bot tắt
process.on("exit", flushNow);

module.exports = {
  ALLOWED_GUILD,
  ROLE_30,
  ROLE_50_TOP3,
  TOP_SIZE,
  getState,
  getCreator,
  topList,
  rankOf,
  totalJoins,
  renderBoard,
  publishBoard,
  refreshBoard,
  refreshAllBoards,
  ensureBoardChannel,
  createInvite,
  cacheInvites,
  handleMemberJoin,
  renderTopEmbed,
  renderMembersEmbed,
  renderCreatorEmbed,
  save,
};
