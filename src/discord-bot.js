const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require("../config");
const logger = require("./utils/logger");
const stats = require("./utils/stats");
const history = require("./utils/history");
const gate = require("./utils/gate");
const game = require("./utils/game");
const aura = require("./utils/aura");
const access = require("./utils/access");
const devlist = require("./utils/devlist");
const { loadCommands, loadEvents } = require("./utils/loader");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

loadCommands(client);
loadEvents(client);

// ---- Lưới an toàn: KHÔNG để lỗi bất đồng bộ giết bot giữa lúc đang nhắn ----
process.on("uncaughtException", (err) => logger.error(`uncaughtException: ${err?.stack || err}`));
process.on("unhandledRejection", (reason) => logger.error(`unhandledRejection: ${reason?.stack || reason}`));
client.on("error", (err) => logger.error(`client error: ${err.message}`));
client.on("shardError", (err) => logger.error(`shard error: ${err.message}`));
client.on("invalidated", () => logger.error("Session INVALIDATED — token có thể đã bị đổi, cần login lại"));

// Soi REST: mọi response tới interaction endpoint (404/400 = token đã bị nơi khác consume)
client.rest.on("response", (data, res) => {
  const p = String(data?.path || "");
  if (p.includes("interaction")) {
    logger.info(`REST< ${res?.status ?? "?"} ${data?.method || ""} ${p} retries=${data?.retries ?? 0}`);
  }
});

// Giám sát: bot có bị kick/thoát server hay không (code không có lệnh leave)
client.on("guildCreate", (guild) => logger.success(`bot VÀO server: ${guild.name} (${guild.id})`));
client.on("guildDelete", (guild) =>
  logger.warn(`bot RỜI server: ${guild.name} (${guild.id}) — không phải code tự leave → kiểm tra kick/ token`),
);

// Prefix dài hơn phải xếp trước để "n?nuk3" không bị bắt nhầm bởi "?"
const PREFIXES = ["n?", "?"];

// Lệnh prefix nào cần quyền nào trong panel dev (mặc định ai cũng có — dev tắt đi được)
const PREFIX_FLAGS = { "?spam": "spam", "?ngon": "spam", "?nhay": "spam", "?clearchat": "clearchat", "?stop": "stop" };

client.on("messageCreate", async (message) => {
  if (!message.guild) return;

  // Sticky ticket tù: tin nhắn MỚI trong ô tù → xóa ticket cũ, gửi lại ở cuối kênh
  // (tức luôn là tin mới nhất). Chạy cho cả bot lẫn người — ticket không được cũ hơn ai.
  try {
    await game.refreshSticky(message.guildId, message.channelId, message.id);
  } catch (err) {
    logger.warn(`sticky: ${err.message}`);
  }

  if (message.author.bot) return;

  // Đen danh — bot làm ngơ hoàn toàn: không farm, không lệnh, không phản hồi
  if (access.isBlocked(message.author.id)) return;

  // Farm aura thụ động khi chat (+2/45s, 1.5% may mắn +20)
  try {
    const farm = game.farmOnMessage(message.guildId, message.author.id);
    if (farm?.lucky) {
      await message.react("✨").catch(() => {});
      await message.reply({
        content: `<@${message.author.id}>`,
        embeds: [
          game.errEmbed("🍀 SAO MAY MẮN RƠI XUỐNG!", "")
            .setColor(0xf1c40f)
            .setDescription(
              `<@${message.author.id}> gặp **vận may bùng nổ** và nhận **+${farm.amount} aura** → \`${farm.total}\`!\n` +
                `> 🔥 Chuỗi **x${farm.streak}** • 👥 Slot **${aura.slotsFor(farm.total)}**`,
            ),
        ],
      }).catch(() => {});
    }
  } catch { /* không để lỗi farm làm sập bot */ }

  const prefix = PREFIXES.find((p) => message.content.startsWith(p));
  if (!prefix) return;

  const withoutPrefix = message.content.slice(prefix.length).trim();
  if (!withoutPrefix) return;
  const parts = withoutPrefix.split(/\s+/);
  const cmdKey = prefix + parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = client.prefixCommands?.get(cmdKey);
  if (!command) return;

  // Quyền theo user — tắt trong panel dev là không dùng được
  const needFlag = PREFIX_FLAGS[cmdKey];
  if (needFlag && !access.canUse(message.author.id, needFlag)) {
    await message.reply("⛔ Bạn không có quyền dùng lệnh này.").catch(() => {});
    return;
  }
  // Chế độ `inf` cần quyền riêng
  if (
    (cmdKey === "?ngon" || cmdKey === "?nhay") &&
    args.some((a) => a.toLowerCase() === "inf") &&
    !access.canUse(message.author.id, "inf")
  ) {
    await message.reply("⛔ Bạn không có quyền chạy chế độ `inf`.").catch(() => {});
    return;
  }

  // Bắt buộc vào server trước khi dùng bất kỳ lệnh nào (fail-open nếu gate lỗi)
  let gateResult = { ok: true, checked: false };
  try {
    gateResult = await gate.ensure(client, message.author);
  } catch (err) {
    logger.warn(`gate (message): ${err.message}`);
  }
  if (!gateResult.ok) {
    await message.reply({ embeds: [gate.deniedEmbed(message.author)] }).catch(() => {});
    return;
  }

  // Lệnh dev có maskArgs → không lộ mật khẩu trong log/lịch sử
  const shownArgs = command.maskArgs ? args.map((arg) => (/^\d+$/.test(arg) ? arg : "***")) : args;

  logger.cmd(`${message.author.tag} -> ${cmdKey} ${shownArgs.join(" ")}`.slice(0, 200));
  stats.record(cmdKey, message.author);
  history.record("command", cmdKey, {
    user: message.author.tag,
    guild: message.guildId,
    detail: shownArgs.join(" ").slice(0, 120),
  });

  try {
    await command.execute(message, args, client);
  } catch (err) {
    logger.error(`Error in ${cmdKey}: ${err.message}`);
    await message.reply(`❌ Lỗi: \`${err.message}\``).catch(() => {});
  }
});

// Tự dọn kênh 2 tầng — MỌI tin nhắn bot đều tự xóa, default = 30 phút:
//   15s  — tin nhắc giờ/thời gian (hết mute, sắp hết X, hết hạn, được tha)
//   30p  — mọi tin còn lại (kết quả, thưởng, info, có nút/menu) — muốn xem lại thì chạy lệnh mới
//   trừ  — ticket tù (sticky, nút 🏃/💸): không auto-delete, chỉ xóa khi hết tù
const AUTO_DELETE_MS = 30 * 60 * 1000;
const AUTO_DELETE_FAST_MS = 15000;
const FAST_TITLES = [
  /HẾT KHỐNG CHẾ/, // hết mute — mở miệng nói lại
  /PHỤC HỒI ROLE/, // hết cướp role
  /^⏳ SẮP/, // sắp hết sở hữu / thoát ngục / hết phạt (còn X giây)
  /HẾT HẠN SỞ HỮU/, // hết giờ sở hữu
  /^🔓 ĐƯỢC THA/, // hết hạn tù, cửa tự mở
];
client.on("messageCreate", (message) => {
  if (message.author.id !== client.user?.id) return;
  // Ticket tù (nút 🏃/💸) KHÔNG auto-delete — chỉ freePrison xóa khi tù nhân hết tù
  const isPrisonTicket = message.components?.some((row) =>
    row.components.some((c) => c.customId?.startsWith("tronthoat_")),
  );
  if (isPrisonTicket) return;
  const title = message.embeds?.[0]?.title || "";
  const fast = FAST_TITLES.some((re) => re.test(title));
  setTimeout(() => {
    message.delete().catch(() => {}); // đã bị xóa / thiếu quyền → bỏ qua
  }, fast ? AUTO_DELETE_FAST_MS : AUTO_DELETE_MS);
});

// Nút / ô chọn / form nào thuộc lệnh nào (customId dạng "<tenlenh>_...")
  const COMPONENT_OWNERS = { dev: "dev_only", duatop: "duatop", tronthoat: "tronthoat", aurashop: "aurashop", tuido: "tuido", danhsachloli: "danhsachloli", flex: "flexaura" };

client.on("interactionCreate", async (interaction) => {
  // Đen danh — chặn MỌI slash/component (trừ dev vẫn còn trong whitelist)
  if (access.isBlocked(interaction.user.id) && !devlist.isAllowed(interaction.user.id)) {
    await interaction.reply({ content: "⛔ Bạn không được phép dùng bot.", ephemeral: true }).catch(() => {});
    return;
  }

  // Nút select trong /help
  if (interaction.isStringSelectMenu() && interaction.customId === "help_select") {
    // Để help.js tự xử lý qua collector, bỏ qua ở đây
    return;
  }

  // Component (nút bấm / ô chọn / form) của các lệnh khác
  const customId = interaction.customId || "";
  const isComponent = interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit();
  if (isComponent) {
    const owner = COMPONENT_OWNERS[customId.split("_")[0]];
    if (!owner) return;
    const command = client.commands.get(owner);
    if (!command?.onComponent) return;

    let compGate = { ok: true };
    try {
      compGate = await gate.ensure(client, interaction.user);
    } catch (err) {
      logger.warn(`gate (component): ${err.message}`);
    }
    if (!compGate.ok) {
      await interaction.reply({ embeds: [gate.deniedEmbed(interaction.user)], ephemeral: true }).catch(() => {});
      return;
    }

    try {
      await command.onComponent(interaction, client);
    } catch (err) {
      const age = Date.now() - (interaction.createdTimestamp || Date.now());
      logger.error(
        `Error in ${owner} component ${customId}: ${err.message}` +
          ` [age=${age}ms replied=${interaction.replied} deferred=${interaction.deferred} acked=${interaction.acked}]` +
          `\n${(err.stack || "").split("\n").slice(0, 6).join("\n")}`,
      );
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ Lỗi: \`${err.message}\``, ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const tEntry = Date.now();
  const entryAge = tEntry - (interaction.createdTimestamp || tEntry);

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Bắt buộc vào server trước khi dùng bất kỳ lệnh nào (fail-open nếu gate lỗi)
  let gateResult = { ok: true, checked: false };
  try {
    gateResult = await gate.ensure(client, interaction.user);
  } catch (err) {
    logger.warn(`gate (interaction): ${err.message}`);
  }
  const gateMs = Date.now() - tEntry;
  if (!gateResult.ok) {
    await interaction.reply({ embeds: [gate.deniedEmbed(interaction.user)], ephemeral: true }).catch(() => {});
    return;
  }

  logger.cmd(`${interaction.user.tag} -> /${interaction.commandName} [entry=${entryAge}ms gate=${gateMs}ms]`);
  stats.record(`/${interaction.commandName}`, interaction.user);
  history.record(
    "command",
    `/${interaction.commandName}`,
    {
      user: interaction.user.tag,
      guild: interaction.guildId,
      detail: (interaction.options?.data || [])
        .map((o) => `${o.name}=${o.name === "matkhau" ? "***" : o.value ?? ""}`)
        .join(" ")
        .slice(0, 120),
    },
  );

    try {
      await command.execute(interaction, client);
    } catch (err) {
      const age = Date.now() - (interaction.createdTimestamp || Date.now());
      const api = err.request?.url || err.url || "";
      logger.error(
        `Error in /${interaction.commandName}: ${err.message}` +
          ` [age=${age}ms replied=${interaction.replied} deferred=${interaction.deferred} status=${err.status ?? "?"} tokenLen=${(interaction.token || "").length} url=${api}]` +
          `\n${(err.stack || "").split("\n").slice(0, 6).join("\n")}`,
      );
      const reply = { content: `Error: ${err.message}`, ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
});

client.login(config.token);
