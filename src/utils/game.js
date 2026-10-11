const {
  EmbedBuilder, PermissionFlagsBits, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const aura = require("./aura");
const inventory = require("./inventory");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "game.json");

const ROLE_DEFS = {
  owner: { name: "👑 Chủ Chiếm", color: 0xf1c40f },
  possessed: { name: "Bị Sở Hữu", color: 0x8e44ad },
  prisoner: { name: "Tù Nhân Tầng Hầm", color: 0x7f8c8d },
  shocked: { name: "Bị Chích Điện", color: 0xf1c40f },
  stripped: { name: "Mất Đồ", color: 0xc0392b },
};
// 30 role bậc tier theo mốc aura — "Aura 1K" → "Aura 1B" (sinh từ aura.TIERS)
for (const t of aura.TIERS) ROLE_DEFS[t.key] = { name: t.name, color: t.color };

const COOLDOWNS = {
  batcocloli: 30000,
  chichdien: 10000,
  cudamsamset: 30000,
  leuleucay: 6000,
  nhothamloli: 60000,
  tronthoat: 10000,
  aurabox: 300000,
  duaura: 10000,
  gacha_aura: 8000,
  aurashop: 3000,
  mayman: 600000,
  cuopaura: 120000,
};

// Thông số game — mọi embed đều phải hiển thị các giá trị này
const TUNE = {
  mute: { chich: 5, cudam: 15, leuleu: 3 },      // giây
  batcoc: { chance: 50, minutes: 30 },            // %, phút
  prison: { minutes: 10, escape: 25, channel: "tang-ham-loli", payPerMin: 10, maxHide: 120 },
  // Mục tiêu rank cao hơn bạn → tỉ lệ bị GIẢM (mọi người đều bị tác động, trừ bot)
  rank: { perStep: 10, max: 60, ccFloor: 5, captureFloor: 2.5 },
  // Miễn nhiễm: cần ≥20% aura (≥400) VÀ bị giảm xuống < 5s — không vô lý với mute ngắn
  immune: { minPct: 20, belowSec: 5 },
};

const AURA_GAIN = {
  chich: 12, chichVictim: 6,
  leuleu: 10, leuleuVictim: 5,
  cudam: 18, cudamVictim: 8,
  possess: 20, possessVictim: 10,
  jail: 15, jailVictim: 8,
  escape: 30, escapeFail: 5,
  caughtLoss: 10,
  boxMin: 5, boxMax: 50,
};

// Farm aura khi chat: +2 mỗi 45s, 1.5% may mắn +20
const FARM = { AURA: 2, COOLDOWN_MS: 45000, LUCKY_CHANCE: 1.5, LUCKY_AURA: 20 };
const farmAt = {};

let state = { possessions: {}, prisons: {}, effects: [], cooldowns: {} };
let client = null;
let ticker = null;
let ticking = false;
let saveTimer = null;
const roleCache = {};

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      state = Object.assign({ possessions: {}, prisons: {}, effects: [], cooldowns: {} }, parsed);
      if (!Array.isArray(state.effects)) state.effects = [];
    }
  } catch (err) {
    logger.warn(`game load failed: ${err.message}`);
    state = { possessions: {}, prisons: {}, effects: [], cooldowns: {} };
  }
}

function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state));
  } catch (err) {
    logger.error(`game save failed: ${err.message}`);
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}

// ---------- format ----------
function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m && sec) return `${m} phút ${sec} giây`;
  if (m) return `${m} phút`;
  return `${sec} giây`;
}

function errEmbed(title, desc) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0xe74c3c)
    // discord.js bắt description ≥1 ký tự — "" sẽ ném EmbedValidationError
    .setDescription(desc || " ")
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();
}

function castEmbed(emoji, desc) {
  return new EmbedBuilder()
    .setTitle(`${emoji} Đang thi triển...`)
    .setColor(0x9b59b6)
    .setDescription(desc)
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();
}

function auraGainLine(userId, res) {
  if (!res || res.amount <= 0) return "";
  return `✨ **+${res.amount} AURA** → \`${res.total}\`${res.streak ? ` • chuỗi x${res.streak}` : ""} <@${userId}>`;
}

function auraSummary(userId) {
  const u = aura.get(userId);
  const rk = aura.rankOf(u.aura);
  const t = aura.tierOf(u.aura);
  const p = aura.progressInfo(u.aura);
  const slots = aura.slotsFor(u.aura);
  return [
    `${rk.icon} **${rk.name}** · ${t.icon} **${t.name}** • ✨ \`${u.aura}\` aura`,
    `${p.bar} \`${p.into}/100\` → slot kế **${p.nextSlot}**`,
    `🛡️ Miễn khống chế **${aura.immunityFor(u.aura)}%** • 👥 Slot sở hữu **${slots}**`,
    `🔥 Chuỗi **x${u.streak}** (cao nhất x${u.bestStreak})`,
  ].join("\n");
}

// ---------- reply helpers ----------
async function replyErr(interaction, title, desc) {
  const payload = { content: `<@${interaction.user.id}>`, embeds: [errEmbed(title, desc)] };
  if (interaction.deferred && !interaction.replied) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp({ ...payload, ephemeral: true });
  return interaction.reply({ ...payload, ephemeral: true });
}

// ---------- role ----------
async function ensureRole(guild, key) {
  const def = ROLE_DEFS[key];
  if (!def) return null;
  const cacheKey = `${guild.id}:${key}`;
  if (roleCache[cacheKey]) {
    const cached = guild.roles.cache.get(roleCache[cacheKey]);
    if (cached) return cached;
  }
  let role = guild.roles.cache.find((r) => r.name === def.name && !r.managed);
  if (!role) {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error("Bot thiếu quyền `Manage Roles` — không tạo được role game.");
    }
    role = await guild.roles.create({
      name: def.name,
      colors: { primaryColor: def.color },
      reason: "Mini game AURA",
    });
    logger.info(`game: tạo role @${def.name} trong ${guild.id}`);
  }
  roleCache[cacheKey] = role.id;
  return role;
}

async function addRoleSafe(member, key) {
  try {
    const role = await ensureRole(member.guild, key);
    if (role && !member.roles.cache.has(role.id)) await member.roles.add(role, "Mini game AURA");
    return role;
  } catch (err) {
    logger.warn(`game addRole ${key}: ${err.message}`);
    return null;
  }
}

async function removeRoleSafe(member, key) {
  try {
    const def = ROLE_DEFS[key];
    if (!def) return;
    const role =
      member.guild.roles.cache.get(roleCache[`${member.guild.id}:${key}`]) ||
      member.guild.roles.cache.find((r) => r.name === def.name && !r.managed);
    if (role && member.roles.cache.has(role.id)) await member.roles.remove(role, "Mini game AURA");
  } catch (err) {
    logger.warn(`game removeRole ${key}: ${err.message}`);
  }
}

const TIER_ROLES = aura.TIERS.map((t) => [t.min, t.key]);
const TIER_ROLE_NAMES = new Set(aura.TIERS.map((t) => t.name));

async function syncTierRole(member) {
  try {
    const u = aura.get(member.id);
    const a = u.aura;
    let target = null;
    for (const t of TIER_ROLES) if (a >= t[0]) target = t;
    for (const [, key] of TIER_ROLES) {
      const role = await ensureRole(member.guild, key).catch(() => null);
      if (!role) continue;
      const has = member.roles.cache.has(role.id);
      if (target && key === target[1] && !has) await member.roles.add(role, "Aura tier");
      if ((!target || key !== target[1]) && has) await member.roles.remove(role, "Aura tier");
    }

    // Role custom "AURA <tên>" — từ 15M aura (tên đặt qua /flexaura)
    const customHeld = member.roles.cache.filter(
      (r) => r.name.startsWith("AURA ") && !TIER_ROLE_NAMES.has(r.name),
    );
    if (a >= aura.CUSTOM_ROLE_MIN && u.auraRoleName) {
      const want = `AURA ${u.auraRoleName}`;
      let role = member.guild.roles.cache.find((r) => r.name === want && !r.managed);
      if (!role) {
        role = await member.guild.roles
          .create({ name: want, colors: { primaryColor: 0x00cec9 }, reason: "Aura role custom" })
          .catch(() => null);
      }
      if (role) {
        for (const r of customHeld) {
          if (r.id !== role.id) await member.roles.remove(r, "Aura custom").catch(() => {});
        }
        if (!member.roles.cache.has(role.id)) await member.roles.add(role, "Aura custom");
      }
    } else {
      for (const r of customHeld) await member.roles.remove(r, "Aura custom").catch(() => {});
    }
  } catch (err) {
    logger.warn(`game tierRole: ${err.message}`);
  }
}

// ---------- cooldown ----------
function checkCooldown(guildId, userId, cmd) {
  const exp = state.cooldowns[`${guildId}:${userId}:${cmd}`] || 0;
  return Math.max(0, exp - Date.now());
}

function setCooldown(guildId, userId, cmd) {
  const ms = COOLDOWNS[cmd] || 15000;
  state.cooldowns[`${guildId}:${userId}:${cmd}`] = Date.now() + ms;
  save();
}

function pruneCooldowns(now) {
  for (const [k, v] of Object.entries(state.cooldowns)) {
    if (v <= now) delete state.cooldowns[k];
  }
}

// Item "Đồng Hồ Cát Vỡ": xóa sạch cooldown của 1 người
function clearCooldowns(guildId, userId) {
  const p = `${guildId}:${userId}:`;
  let n = 0;
  for (const k of Object.keys(state.cooldowns)) {
    if (k.startsWith(p)) {
      delete state.cooldowns[k];
      n++;
    }
  }
  save();
  return n;
}

// ---------- kiểm tra mục tiêu ----------
// Trốn hụt → gia hạn án +50% (tối đa MAX_EXTENSIONS lần)
const MAX_EXTENSIONS = 2;

// Mọi người trong server (trừ bot) đều bị tác động — role cao hơn chỉ GIẢM tỉ lệ.
// Aura của thủ phạm xòa nhẹ chênh lệch role (aura quyết định tất cả).
// kind: "capture" (batcocloli) | "cc" (chich/leuleu/cudam)
function canTarget(invoker, target, guild, kind = "cc") {
  if (!target) return { ok: false, reason: "Không tìm thấy người này trong server." };
  const me = guild.members.me;
  if (target.id === me?.id) return { ok: false, reason: "Không được nhắm vào bot — chúng chẳng có aura!" };
  if (target.user.bot) return { ok: false, reason: "Bot không có aura — hãy chọn người thật." };
  if (target.id === invoker.id) return { ok: false, reason: "Không được tự chọc mình — hãy chọn người khác!" };

  // Bảo vệ người mới — chặn chênh lệch aura quá lớn so với newbie
  const guard = aura.newbieGuard(invoker.id, target.id);
  if (guard?.blocked) return { ok: false, reason: guard.reason };

  const diff = (target.roles?.highest?.position ?? 0) - (invoker.roles?.highest?.position ?? 0);
  const raw = diff > 0 ? Math.min(TUNE.rank.max, diff * TUNE.rank.perStep) : 0;
  const soak = aura.immunityFor(aura.get(invoker.id).aura);
  const penalty = Math.round((raw * (100 - soak)) / 100);
  return { ok: true, penalty, raw, soak, diff: Math.max(0, diff) };
}

// Tỉ lệ trúng cuối cùng — không bao giờ xuống dưới sàn (tránh vô lý)
// Bùa may mắn trong túi đồ (luck_charm): +X% cho hành động kế tiếp, dùng 1 lần rồi mất
function hitChance(base, penalty, floor = TUNE.rank.ccFloor, invokerId = null) {
  let chance = Math.max(floor, base - penalty);
  if (invokerId) {
    const luck = inventory.popLuck(invokerId);
    if (luck > 0) chance = Math.min(100, chance + luck);
  }
  return chance;
}

// Slot thực tế = slot theo aura + item "Túi Thần Kỳ/Rương Không Gian" (tạm thời)
function effectiveSlots(userId) {
  return aura.slotsFor(aura.get(userId).aura) + inventory.slotBonusFor(userId);
}

// ---------- gửi tin ----------
async function sendTo(channelId, payload) {
  if (!client || !channelId) return null;
  try {
    const ch = client.channels.cache.get(channelId) || (await client.channels.fetch(channelId));
    if (ch?.isTextBased()) return await ch.send(payload);
  } catch (err) {
    logger.warn(`game send: ${err.message}`);
  }
  return null;
}

async function fetchGuild(guildId) {
  if (!client) return null;
  return client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
}

function buildReminds(durationMs, offsetsSec) {
  const now = Date.now();
  return offsetsSec.filter((o) => o * 1000 < durationMs - 3000).map((o) => now + durationMs - o * 1000);
}

async function popReminds(rec, buildFn) {
  if (!rec.reminds?.length) return;
  const now = Date.now();
  const due = rec.reminds.filter((t) => t <= now);
  if (!due.length) return;
  rec.reminds = rec.reminds.filter((t) => t > now);
  save();
  const left = Math.max(1, Math.ceil((rec.until - now) / 1000));
  await sendTo(rec.channelId, buildFn(left)).catch(() => {});
}

// ---------- sở hữu ----------
function possessionOf(guildId, userId) {
  return state.possessions[guildId]?.[userId] || null;
}

function possessionsBy(guildId, ownerId) {
  const map = state.possessions[guildId] || {};
  return Object.entries(map)
    .filter(([, rec]) => rec.ownerId === ownerId)
    .map(([uid, rec]) => ({ userId: uid, ...rec }));
}

async function possess({ guild, ownerId, targetId, minutes, channelId, force = false }) {
  const map = (state.possessions[guild.id] = state.possessions[guild.id] || {});
  if (map[targetId]) {
    if (map[targetId].ownerId === ownerId) return { ok: false, reason: "Người này **đã là của bạn** rồi." };
    return { ok: false, reason: `Người này đang bị <@${map[targetId].ownerId}> sở hữu trước.` };
  }
  const member = await guild.members.fetch(targetId);
  await addRoleSafe(member, "possessed");
  const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
  if (ownerMember) await addRoleSafe(ownerMember, "owner");
  const durationMs = minutes * 60000;
  map[targetId] = {
    ownerId,
    until: Date.now() + durationMs,
    minutes,
    channelId,
    reminds: buildReminds(durationMs, [60, 30, 10]),
    nextDrip: Date.now() + 60000,
    force,
  };
  save();
  return { ok: true, member };
}

async function releasePossession(guildId, userId, reasonText, opts = {}) {
  const map = state.possessions[guildId];
  const rec = map?.[userId];
  if (!rec) return null;
  delete map[userId];
  if (!Object.keys(map).length) delete state.possessions[guildId];
  save();
  try {
    const guild = await fetchGuild(guildId);
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        const stillOwned = possessionOf(guildId, userId);
        if (!stillOwned) await removeRoleSafe(member, "possessed");
      }
      // Chủ hết người giữ → gỡ role 👑 Chủ Chiếm
      if (!possessionsBy(guildId, rec.ownerId).length) {
        const ownerMember = await guild.members.fetch(rec.ownerId).catch(() => null);
        if (ownerMember) await removeRoleSafe(ownerMember, "owner");
      }
    }
  } catch (err) {
    logger.warn(`game releasePossess: ${err.message}`);
  }
  if (opts.silent) return rec; // người gọi tự lo phần thông báo (vd: /danhsachloli + gif)
  const embed = new EmbedBuilder()
    .setTitle("💘 HẾT HẠN SỞ HỮU")
    .setColor(0x2ecc71)
    .setDescription(
      `<@${userId}> đã **tự do** khỏi tay <@${rec.ownerId}>!\n\n` +
        `> 🕒 Bị sở hữu **${rec.minutes} phút** — ${reasonText}\n> ✨ Aura hút được đã chảy vào túi chủ nhân.`,
    )
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();
  await sendTo(rec.channelId, { content: `<@${userId}> <@${rec.ownerId}>`, embeds: [embed] });
  return rec;
}

// ---------- nhà tù ----------
function prisonOf(guildId, userId) {
  return state.prisons[guildId]?.[userId] || null;
}

// Kênh tầng hầm cố định theo yêu cầu game
function channelName() {
  return TUNE.prison.channel;
}

// Giá mua tự do: 10 aura × phút còn lại, giảm theo % miễn nhiễm aura (tối thiểu 10)
function payCost(rec) {
  const leftMin = Math.max(1, (rec.until - Date.now()) / 60000);
  const imm = aura.immunityFor(aura.get(rec.prisonerId).aura);
  const raw = TUNE.prison.payPerMin * leftMin;
  return Math.max(10, Math.round((raw * (100 - imm)) / 100));
}

// Trừ aura tù nhân mỗi phút: gốc random 5-200, chỉnh bởi tier (cao → đau hơn),
// nửa sau án và số lần trốn hụt → nặng hơn; luôn kẹp trong [5, 200]
function prisonDrain(rec) {
  const base = 5 + Math.floor(Math.random() * 196);
  const a = aura.get(rec.prisonerId).aura;
  let tierIdx = 0;
  for (let i = 0; i < aura.TIERS.length; i++) if (a >= aura.TIERS[i].min) tierIdx = i;
  let mult = 0.5 + tierIdx * 0.15;
  const totalMs = Math.max(1, rec.minutes * 60000);
  if (1 - (rec.until - Date.now()) / totalMs > 0.5) mult *= 1.25;
  if (rec.attempts > 0) mult *= 1.25;
  return Math.max(5, Math.min(200, Math.round(base * mult)));
}

function escapeRow(rec) {
  const cost = payCost(rec);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tronthoat_try")
      .setLabel(`Thử trốn thoát (${rec.chance}%)`)
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🏃"),
    new ButtonBuilder()
      .setCustomId("tronthoat_pay")
      .setLabel(`Trả ${cost} aura thoát ngay`)
      .setStyle(ButtonStyle.Success)
      .setEmoji("💸"),
  );
}

function prisonEmbed(rec, now = Date.now()) {
  const left = Math.max(0, rec.until - now);
  const cost = payCost(rec);
  return new EmbedBuilder()
    .setTitle("🏚️ TẦNG HẦM — BẠN BỊ NHỐT")
    .setColor(0x34495e)
    .setDescription(
      `Tù nhân <@${rec.prisonerId}> bị <@${rec.jailerId}> ném xuống tầng hầm!\n\n` +
        `> 🕳️ Kênh: \`#${TUNE.prison.channel}\` • Tỉ lệ nhốt **100%**\n` +
        `> 🎫 Kiểu **ticket**: tù nhân **chỉ thấy** kênh này — **${rec.hidden?.length || 0}** kênh khác đang bị ẩn\n` +
        `> ⏳ Còn lại: **${fmtLeft(left)}** (hết lúc <t:${Math.floor(rec.until / 1000)}:T>)\n` +
        `> 🎲 Tỉ lệ trốn: **${rec.chance}%** • Thử sai: **${rec.attempts}** lần (+5%/lần, max 95%)\n` +
        `> ⛔ Gia hạn án: **${rec.extensions || 0}/${MAX_EXTENSIONS}** lần (trốn hụt = +50% thời gian)\n` +
        `> 💸 Mua tự do ngay: **${cost} aura** (aura càng cao càng rẻ, sàn **10**)\n` +
        `> 🩸 Mỗi phút bị trừ **5-200 aura** (tier cao / ngồi lâu / trốn hụt → đau hơn) — đã trừ **${rec.drainTotal || 0}**✨\n` +
        `> 💰 Thoát được sẽ **QUẢ BÁO**: ngược đãi lại người nhốt!\n` +
        (rec.note ? `> ⚠️ **${rec.note}**\n` : ""),
    )
    .setFooter({ text: `Bấm 🏃 thử trốn hoặc 💸 trả aura • /tronthoat • JUST LONELY` })
    .setTimestamp();
}

// Payload ticket trong ô tù — dùng cho lần gửi đầu và mỗi lần sticky gửi lại
function cellPayload(rec) {
  return { content: `<@${rec.prisonerId}>`, embeds: [prisonEmbed(rec)], components: [escapeRow(rec)] };
}

async function getPrisonCategory(guild) {
  let cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.includes("Tầng Hầm"));
  if (!cat && guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    cat = await guild.channels
      .create({ name: "🎸 Tầng Hầm — AURA", type: ChannelType.GuildCategory, reason: "Mini game AURA" })
      .catch(() => null);
  }
  return cat;
}

// Ticket: ẩn mọi kênh khác với tù nhân — chỉ #tang-ham-loli hiện ra
async function hideChannelsFor(guild, memberId, excludeId) {
  const hidden = [];
  try {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) return hidden;
    const chans = [...guild.channels.cache.values()].filter(
      (c) =>
        c.id !== excludeId &&
        c.type !== ChannelType.GuildCategory &&
        c.type !== ChannelType.GuildDirectory &&
        typeof c.permissionOverwrites?.edit === "function",
    );
    for (const c of chans.slice(0, TUNE.prison.maxHide)) {
      try {
        await c.permissionOverwrites.edit(memberId, { ViewChannel: false }, "AURA: ticket tầng hầm");
        hidden.push(c.id);
      } catch (err) {
        logger.warn(`game hide ${c.id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.warn(`game hideChannels: ${err.message}`);
  }
  return hidden;
}

// Hết tù → hiện lại đúng các kênh đã ẩn
async function restoreChannels(guild, memberId, ids) {
  for (const id of ids || []) {
    try {
      const c = guild.channels.cache.get(id) || (await guild.channels.fetch(id).catch(() => null));
      if (c?.permissionOverwrites) {
        await c.permissionOverwrites.edit(memberId, { ViewChannel: null }, "AURA: hết tù");
      }
    } catch (err) {
      logger.warn(`game restore ${id}: ${err.message}`);
    }
  }
}

async function imprison({ guild, jailerId, prisonerId, minutes, chance, channelId, note, announce = true }) {
  const map = (state.prisons[guild.id] = state.prisons[guild.id] || {});
  if (map[prisonerId]) return { ok: false, reason: "Người này **đang ngồi tù** rồi." };

  const me = guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return { ok: false, reason: "Bot thiếu quyền `Manage Channels` — không tạo được tầng hầm." };
  }
  const prisoner = await guild.members.fetch(prisonerId);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: prisonerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] },
  ];
  if (jailerId && jailerId !== prisonerId) {
    overwrites.push({ id: jailerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
  }

  // Dùng lại ô tù trống — chỉ tạo kênh mới khi hết ô (giảm tạo kênh, tránh văng sv)
  const used = new Set(Object.values(map).map((r) => r.channelId));
  let channel =
    guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === channelName() && !used.has(c.id),
    ) || null;

  if (channel) {
    await channel.permissionOverwrites
      .set(overwrites, `AURA: ${jailerId} nhốt ${prisonerId}`)
      .catch((err) => logger.warn(`game reuse cell: ${err.message}`));
  } else {
    const category = await getPrisonCategory(guild);
    channel = await guild.channels.create({
      name: channelName(),
      type: ChannelType.GuildText,
      parent: category?.id || undefined,
      permissionOverwrites: overwrites,
      reason: `AURA: ${jailerId} nhốt ${prisonerId}`,
    });
  }

  await addRoleSafe(prisoner, "prisoner");

  const durationMs = minutes * 60000;
  const rec = {
    guildId: guild.id,
    prisonerId,
    jailerId,
    channelId: channel.id,
    announceChannelId: channelId,
    until: Date.now() + durationMs,
    minutes,
    chance,
    attempts: 0,
    note: note || null,
    hidden: [],
    reminds: buildReminds(durationMs, [120, 60, 30, 10]),
    nextDrip: Date.now() + 60000,
    drainTotal: 0,
    lastEdit: 0,
    cooldownUntil: 0,
  };
  // Tin ticket có sticker nếu server có (thử kèm sticker, lỗi thì gửi thường)
  const sticker = guild.stickers?.cache?.first?.();
  const payload = cellPayload(rec);
  let msg = null;
  try {
    msg = await channel.send(sticker ? { ...payload, stickers: [sticker.id] } : payload);
  } catch {
    msg = await channel.send(payload);
  }
  rec.messageId = msg.id;
  map[prisonerId] = rec;
  save();

  // Ticket: ẩn toàn bộ kênh khác với tù nhân rồi cập nhật số lượng vào embed
  rec.hidden = await hideChannelsFor(guild, prisonerId, channel.id);
  save();
  await updatePrisonMessage(rec);

  if (announce) {
    const embed = new EmbedBuilder()
      .setTitle("⛓️ XUỐNG TẦNG HẦM!")
      .setColor(0x95a5a6)
      .setDescription(
        `<@${jailerId}> đã ném <@${prisonerId}> vào **ngục**!\n\n` +
          `> 🕳️ Kênh: <#${channel.id}>\n> ⏳ Thời gian: **${minutes} phút** • 🎲 Thoát được **${chance}%**\n` +
          `> 🎫 Ticket: tù nhân chỉ thấy kênh này • 💸 Mua tự do **${payCost(rec)} aura**\n` +
          `> 🏃 Bấm **🏃 trốn** hoặc **💸 trả aura** (hoặc gõ \`/tronthoat\`)`,
      )
        .setFooter({ text: "JUST LONELY · AURA GAME" })
      .setTimestamp();
    await sendTo(channelId, { content: `<@${prisonerId}> <@${jailerId}>`, embeds: [embed] });
  }
  return { ok: true, channel, rec };
}

async function updatePrisonMessage(rec) {
  if (!client || !rec.messageId) return;
  try {
    const ch = client.channels.cache.get(rec.channelId) || (await client.channels.fetch(rec.channelId));
    const msg = ch && (await ch.messages.fetch(rec.messageId));
    if (msg) await msg.edit({ embeds: [prisonEmbed(rec)], components: [escapeRow(rec)] });
  } catch (err) {
    logger.warn(`game prison edit: ${err.message}`);
  }
}

// ---------- sticky: ticket tù LUÔN là tin nhắn mới nhất ----------
// Kênh có ticket tù: tin nhắn mới → dời ticket xuống cuối.
// + Debounce 2.5s: chuỗi tin nhắn liên tiếp → chỉ dời MỘT lần khi im ắng (hết nhấp nháy xóa/hiện)
// + Tự nhận ticket của chính mình → cập nhật id thay vì xóa gửi lại (hết vòng lặp)
// Không auto-delete 30p — chỉ freePrison xóa khi tù nhân hết tù.
const STICKY_DEBOUNCE_MS = 2500;
const stickyLocks = new Map(); // key → có tin mới đến trong lúc đang gửi lại?
const stickyTimers = new Map(); // key → timer debounce
const stickyPending = new Map(); // key → id tin nhắn tới gần nhất

async function refreshSticky(guildId, channelId, incomingId) {
  if (!client || !state.prisons[guildId]) return;
  const key = `${guildId}:${channelId}`;
  stickyPending.set(key, incomingId);
  if (stickyTimers.has(key)) clearTimeout(stickyTimers.get(key));
  stickyTimers.set(
    key,
    setTimeout(() => {
      stickyTimers.delete(key);
      const id = stickyPending.get(key);
      stickyPending.delete(key);
      doRefreshSticky(guildId, channelId, id).catch((err) => logger.warn(`game sticky: ${err.message}`));
    }, STICKY_DEBOUNCE_MS),
  );
}

async function doRefreshSticky(guildId, channelId, incomingId) {
  if (!client || !state.prisons[guildId]) return;
  const key = `${guildId}:${channelId}`;
  if (stickyLocks.has(key)) {
    stickyLocks.set(key, true); // đang bận → gửi lại thêm một vòng nữa sau khi xong
    return;
  }
  stickyLocks.set(key, false);
  try {
    do {
      stickyLocks.set(key, false);
      const recs = Object.values(state.prisons[guildId] || {}).filter(
        (r) => r.channelId === channelId && r.messageId && r.messageId !== incomingId,
      );
      if (!recs.length) return;
      const ch = client.channels.cache.get(channelId) || (await client.channels.fetch(channelId).catch(() => null));
      if (!ch?.isTextBased?.()) return;

      // Tin vừa tới là CHÍNH ticket (race khi vừa gửi xong) → nhận luôn id, không xóa/gửi lại
      if (incomingId) {
        const incoming = await ch.messages.fetch(incomingId).catch(() => null);
        const isTicket =
          incoming &&
          incoming.author?.id === client.user?.id &&
          incoming.components?.some((row) => row.components.some((c) => c.customId?.startsWith("tronthoat_")));
        if (isTicket) {
          for (const rec of recs) {
            const cur = state.prisons[guildId]?.[rec.prisonerId];
            if (cur && cur.channelId === channelId) {
              cur.messageId = incomingId;
              save();
            }
          }
          return;
        }
        // Ticket đã là tin cuối kênh → không cần dời
        const rec0 = state.prisons[guildId]?.[recs[0].prisonerId];
        if (rec0 && ch.lastMessageId === rec0.messageId) return;
      }

      const sticker = client.guilds.cache.get(guildId)?.stickers?.cache?.first?.();
      for (const rec of recs) {
        const cur = state.prisons[guildId]?.[rec.prisonerId];
        if (!cur || cur.messageId !== rec.messageId) continue; // vừa hết tù
        const old = await ch.messages.fetch(rec.messageId).catch(() => null);
        await old?.delete().catch(() => {});
        const cur2 = state.prisons[guildId]?.[rec.prisonerId];
        if (!cur2 || cur2.messageId !== rec.messageId) continue; // vừa hết tù giữa chừng
        const payload = cellPayload(rec);
        let msg = null;
        try {
          msg = await ch.send(sticker ? { ...payload, stickers: [sticker.id] } : payload);
        } catch {
          msg = await ch.send(payload).catch(() => null);
        }
        if (msg) {
          cur2.messageId = msg.id;
          save();
        }
      }
    } while (stickyLocks.get(key));
  } catch (err) {
    logger.warn(`game sticky: ${err.message}`);
  } finally {
    stickyLocks.delete(key);
  }
}

async function freePrison(guild, userId, opts = {}) {
  const map = state.prisons[guild.id];
  const rec = map?.[userId];
  if (!rec) return null;

  // Ticket: hiện lại toàn bộ kênh đã ẩn — làm TRƯỚC, xóa rec SAU (crash giữa chừng thì tick thử lại)
  await restoreChannels(guild, userId, rec.hidden);

  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) await removeRoleSafe(member, "prisoner");
  } catch (err) {
    logger.warn(`game freePrison role: ${err.message}`);
  }

  // Dọn ô tù cho người kế: gỡ overwrite tù nhân/gaoler, xóa tin ticket cũ — GIỮ kênh
  try {
    const cell =
      guild.channels.cache.get(rec.channelId) || (await guild.channels.fetch(rec.channelId).catch(() => null));
    if (cell?.permissionOverwrites) {
      await cell.permissionOverwrites.delete(rec.prisonerId).catch(() => {});
      if (rec.jailerId && rec.jailerId !== rec.prisonerId) {
        await cell.permissionOverwrites.delete(rec.jailerId).catch(() => {});
      }
      if (rec.messageId) {
        const m = await cell.messages.fetch(rec.messageId).catch(() => null);
        await m?.delete().catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(`game cleanCell: ${err.message}`);
  }

  // Xóa rec SAU khi đã restore/dọn xong
  delete map[userId];
  if (!Object.keys(map).length) delete state.prisons[guild.id];
  save();

  if (opts.announce !== false) {
    const paid = opts.paid || 0;
    const title = opts.escape ? "🏃 THOÁT THÀNH CÔNG!" : paid ? "💰 MUA TỰ DO!" : "🔓 ĐƯỢC THA";
    const color = opts.escape ? 0x2ecc71 : paid ? 0xf1c40f : 0x3498db;
    const desc = opts.escape
      ? `<@${userId}> **đạp tung** cánh cửa tầng hầm!\n\n> 🏃 Tự do sau **${rec.attempts}** lần thử • 🎲 Tỉ lệ cuối: **${rec.chance}%**`
      : paid
        ? `<@${userId}> **trả ${paid} aura** để mua tự do khỏi tầng hầm!\n\n> 💸 Aura còn lại: \`${aura.get(userId).aura}\` • Không quả báo`
        : `<@${userId}> hết hạn ngồi tù — cánh cửa tự mở.\n\n> ⏳ Bị nhốt **${rec.minutes} phút**`;
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription(desc)
        .setFooter({ text: "JUST LONELY · AURA GAME" })
      .setTimestamp();
    const ping = rec.jailerId ? `<@${userId}> <@${rec.jailerId}>` : `<@${userId}>`;
    await sendTo(rec.announceChannelId, { content: ping, embeds: [embed] });
  }
  return rec;
}

// Trả aura để thoát ngay — aura quyết định giá (cao = rẻ)
async function buyFreedom(guild, userId) {
  const rec = prisonOf(guild.id, userId);
  if (!rec) return { ok: false, reason: "Bạn hiện **không** bị nhốt ở tầng hầm nào." };
  const cost = payCost(rec);
  const u = aura.get(userId);
  if (u.aura < cost) {
    return {
      ok: false,
      reason: `Bạn chỉ có \`${u.aura}\` aura — cần **${cost} aura** để mua tự do. Aura cao hơn sẽ được giảm giá!`,
    };
  }
  aura.spend(userId, cost);
  await freePrison(guild, userId, { announce: false });
  const embed = new EmbedBuilder()
    .setTitle("💰 MUA TỰ DO THÀNH CÔNG!")
    .setColor(0xf1c40f)
    .setDescription(
      `<@${userId}> **trả ${cost} aura** để rời tầng hầm ngay!\n\n` +
        `> 💸 Aura còn lại: \`${aura.get(userId).aura}\` • Không quả báo, không phạt\n` +
        `> 👁️ **${rec.hidden?.length || 0}** kênh đã hiện lại đầy đủ`,
    )
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();
  return { ok: true, cost, content: rec.jailerId ? `<@${userId}> <@${rec.jailerId}>` : `<@${userId}>`, embed };
}

// Thử trốn thoát — dùng chung cho /tronthoat và nút bấm
async function attemptEscape(guild, userId, ctxChannelId) {
  const rec = prisonOf(guild.id, userId);
  if (!rec) {
    return { ok: false, reason: "Bạn hiện **không** bị nhốt ở tầng hầm nào. Cứ yên tâm quậy!" };
  }
  const now = Date.now();
  if (rec.cooldownUntil && now < rec.cooldownUntil) {
    return { ok: false, reason: `Vừa ngã sấp mặt — chờ **${fmtLeft(rec.cooldownUntil - now)}** nữa mới nhảy lại được!` };
  }
  rec.cooldownUntil = now + (COOLDOWNS.tronthoat || 10000);
  save();

  const roll = Math.floor(Math.random() * 100) + 1;
  const chance = rec.chance;

  if (roll <= chance) {
    const minutes = rec.minutes;
    const jailerId = rec.jailerId;
    const originalChance = rec.chance;
    const announceHere = ctxChannelId && ctxChannelId === rec.announceChannelId;
    await freePrison(guild, userId, { escape: true, announce: !announceHere });

    let reverseNote = "";
    if (jailerId && jailerId !== userId) {
      try {
        await guild.members.fetch(jailerId);
        const p = await possess({ guild, ownerId: userId, targetId: jailerId, minutes, channelId: rec.announceChannelId, force: true });
        const imp = await imprison({
          guild, jailerId: userId, prisonerId: jailerId, minutes,
          chance: originalChance, channelId: rec.announceChannelId,
          note: "QUẢ BÁO — bị tù nhân của chính mình nhốt!", announce: false,
        });
        if (p.ok || imp.ok) {
          reverseNote = `\n\n☠️ **QUẢ BÁO!** <@${userId}> **sở hữu** <@${jailerId}> và ném ngược xuống tầng hầm **${minutes} phút** (tỉ lệ thoát ${originalChance}%)!`;
          await sendTo(rec.announceChannelId, {
            content: `<@${jailerId}> <@${userId}>`,
            embeds: [
              new EmbedBuilder()
                .setTitle("☠️ QUẢ BÁO THÀNH")
                .setColor(0xe74c3c)
                .setDescription(
                  `Tù nhân <@${userId}> lật kèo! **<@${jailerId}>** giờ bị sở hữu + nhốt tù **${minutes} phút**.\n\n` +
                    `> 👻 Sở hữu: <@${userId}> → <@${jailerId}>\n> 🕳️ Ngục: ${imp.ok ? `<#${imp.channel.id}>` : "(tạo lại khi bot rảnh)"}`,
                )
                .setFooter({ text: "JUST LONELY · AURA GAME" })
                .setTimestamp(),
            ],
          });
        }
      } catch (err) {
        reverseNote = `\n\n⚠️ Không ngược đãi được jailer (${err.message}) — nhưng bạn vẫn THOÁT!`;
      }
    }

    const gain = aura.gain(userId, AURA_GAIN.escape, { success: true });
    aura.bump(userId, "escapes");
    const escaper = await guild.members.fetch(userId).catch(() => null);
    if (escaper) await syncTierRole(escaper).catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle("🏃 THOÁT THÀNH CÔNG!")
      .setColor(0x2ecc71)
      .setDescription(
        `<@${userId}> **đạp tung** cánh cửa và bay ra ngoài!\n\n` +
          `> 🎲 Roll **${roll}/${chance}** — trượt vỏ chanh lần nữa là ngồi tù thêm\n` +
          `> ⏳ Sau **${rec.attempts}** lần thử • ${fmtLeft(rec.minutes * 60000)} trong ngục\n` +
          `${gameGain(gain)}${reverseNote}`,
      )
        .setFooter({ text: "JUST LONELY · AURA GAME" })
      .setTimestamp();
    return {
      ok: true, success: true,
      content: rec.jailerId ? `<@${userId}> <@${rec.jailerId}>` : `<@${userId}>`,
      embed,
    };
  }

  rec.attempts += 1;
  rec.chance = Math.min(95, chance + 5);
  // Trốn hụt → gia hạn án +50% (tối đa 2 lần)
  let extended = false;
  if ((rec.extensions || 0) < MAX_EXTENSIONS) {
    rec.until += Math.round((rec.until - now) * 0.5);
    rec.extensions = (rec.extensions || 0) + 1;
    rec.reminds = buildReminds(Math.max(30000, rec.until - Date.now()), [60, 10]);
    extended = true;
  }
  const lost = aura.spend(userId, AURA_GAIN.escapeFail);
  aura.resetStreak(userId);
  save();
  await updatePrisonMessage(rec);
  const embed = new EmbedBuilder()
    .setTitle("💀 TRỐN THẤT BẠI")
    .setColor(0xe74c3c)
    .setDescription(
      `<@${userId}> **chạy thẳng vào cửa** và ngã sấp mặt!\n\n` +
        `> 🎲 Roll **${roll}/${chance}** — trượt ${roll - chance} điểm\n` +
        `> 📈 Lần sau lên **${rec.chance}%** (+5%/thất bại)\n` +
        (extended
          ? `> ⛔ **Án bị gia hạn +50%** (${rec.extensions}/${MAX_EXTENSIONS}) — ra tù <t:${Math.floor(rec.until / 1000)}:T>\n`
          : `> ⚠️ Hết lượt gia hạn — chịu trận đi 🤷\n`) +
        `> 💸 Phạt **-${AURA_GAIN.escapeFail} aura** → \`${aura.get(userId).aura}\`\n` +
        `> ⏳ Còn **${fmtLeft(rec.until - Date.now())}** trong ngục`,
    )
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();
  return { ok: true, success: false, content: `<@${userId}>`, embed };
}

function gameGain(res) {
  if (!res || res.amount <= 0) return "";
  const nm = res.nmult > 1 ? ` 🆕×${res.nmult}` : "";
  return `✨ **+${res.amount} AURA**${nm} → \`${res.total}\`${res.streak ? ` • chuỗi x${res.streak}` : ""}`;
}

// ---------- khống chế (mute/timeout) ----------
async function applyCC({ guild, targetId, seconds, kind, channelId, label, invokerId }) {
  const me = guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    throw new Error("Bot thiếu quyền `Moderate Members` (timeout) — không mute được.");
  }
  const member = await guild.members.fetch(targetId);
  if (member.roles.highest.position >= me.roles.highest.position) {
    throw new Error("Rank mục tiêu cao hơn bot — không timeout được.");
  }
  const { pct, original, final } = aura.reduceDuration(seconds, aura.get(targetId).aura);
  // Miễn nhiễm: aura ≥20% VÀ giảm xuống < 5s (0 aura vẫn chịu đủ thời gian)
  if (pct >= TUNE.immune.minPct && final < TUNE.immune.belowSec) {
    return { member, immune: true, pct, original, applied: 0 };
  }
  const applied = Math.max(2, final);
  await member.timeout(applied * 1000, label);
  await addRoleSafe(member, "shocked");
  const durationMs = applied * 1000;
  const rec = {
    type: kind, guildId: guild.id, userId: targetId,
    until: Date.now() + durationMs, channelId, label, invokerId,
    reminds: buildReminds(durationMs, [30, 10]),
  };
  state.effects.push(rec);
  save();
  return { member, immune: false, pct, original, applied, rec };
}

// ---------- cướp role + mute ----------
async function stripRoles({ guild, targetId, seconds, channelId, label, invokerId }) {
  const me = guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    throw new Error("Bot thiếu quyền `Moderate Members` (timeout).");
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error("Bot thiếu quyền `Manage Roles` — không cướp role được.");
  }
  const member = await guild.members.fetch(targetId);
  if (member.roles.highest.position >= me.roles.highest.position) {
    throw new Error("Rank mục tiêu cao hơn bot — không strip được.");
  }
  const removable = member.roles.cache.filter(
    (r) => r.id !== guild.id && !r.managed && r.position < me.roles.highest.position,
  );
  const saved = [...removable.keys()];
  const savedNames = [...removable.values()].slice(0, 15).map((r) => r.name);
  if (saved.length) await member.roles.remove(saved, label);
  await addRoleSafe(member, "stripped");

  const { pct, original, final } = aura.reduceDuration(seconds, aura.get(targetId).aura);
  const immune = pct >= TUNE.immune.minPct && final < TUNE.immune.belowSec;
  if (!immune) {
    await member.timeout(Math.max(2, final) * 1000, label);
  }
  // Role vẫn bị strip kể cả khi miễn nhiễm (miễn nhiễm chỉ áp cho mute)
  const applied = immune ? 0 : final;
  const durationMs = Math.max(5, final) * 1000;
  const rec = {
    type: "strip", guildId: guild.id, userId: targetId,
    until: Date.now() + durationMs, channelId, label, invokerId,
    savedRoles: saved, savedNames,
    reminds: buildReminds(durationMs, [30, 10]),
  };
  state.effects.push(rec);
  save();
  return { member, pct, original, applied, immune, saved, savedNames, rec };
}

// ---------- kết thúc hiệu ứng ----------
async function expireFx(fx) {
  try {
    const guild = await fetchGuild(fx.guildId);
    if (!guild) return;
    const member = await guild.members.fetch(fx.userId).catch(() => null);
    if (member) {
      await removeRoleSafe(member, "shocked");
      if (fx.type === "strip") {
        await removeRoleSafe(member, "stripped");
        const me = guild.members.me;
        const valid = (fx.savedRoles || []).filter((id) => {
          const r = guild.roles.cache.get(id);
          return r && !r.managed && r.position < me.roles.highest.position;
        });
        if (valid.length) await member.roles.add(valid, "Hết hạn mất đồ").catch(() => {});
      }
    }
    const title = fx.type === "strip" ? "🎭 PHỤC HỒI ROLE!" : "🔊 HẾT KHỐNG CHẾ!";
    const color = fx.type === "strip" ? 0x2ecc71 : 0x3498db;
    const desc =
      fx.type === "strip"
        ? `<@${fx.userId}> được trả lại **${(fx.savedRoles || []).length} role** và hết phạt.\n\n> 🎭 Mất role: \`${(fx.savedNames || []).slice(0, 8).join(", ") || "chẳng có gì"}\``
        : `<@${fx.userId}> **hết mute** — mở miệng nói lại được rồi!\n\n> ⚡ Bị chích bởi \`${fx.label || "?"}\``;
    const embed = new EmbedBuilder().setTitle(title).setColor(color).setDescription(desc).setTimestamp()
      .setFooter({ text: "JUST LONELY · AURA GAME" });
    await sendTo(fx.channelId, { content: `<@${fx.userId}>`, embeds: [embed] });
  } catch (err) {
    logger.warn(`game expireFx: ${err.message}`);
  }
}

// ---------- ticker: nhịp độ 1 giây ----------
async function tick() {
  if (!client || ticking) return;
  ticking = true;
  try {
    const now = Date.now();

    for (const [gid, map] of Object.entries(state.possessions)) {
      for (const [uid, rec] of Object.entries(map)) {
        if (rec.until <= now) await releasePossession(gid, uid, "hết giờ");
        else {
          await popReminds(rec, (left) => ({
            content: `<@${uid}> <@${rec.ownerId}>`,
            embeds: [
              new EmbedBuilder()
                .setTitle("⏳ SẮP HẾT SỞ HỮU")
                .setColor(0xe67e22)
                .setDescription(`<@${uid}> sắp thoát khỏi tay <@${rec.ownerId}> — còn **${left} giây**!\n\n> 🏃 Nhanh gõ /nhothamloli nhốt vào ngục trước khi mất nhé!`)
                .setTimestamp().setFooter({ text: "JUST LONELY · AURA GAME" }),
            ],
          }));
          if (now >= (rec.nextDrip || 0)) {
            rec.nextDrip = now + 60000;
            aura.gain(rec.ownerId, 2, { noStreak: true });
            aura.gain(uid, 1, { noStreak: true });
            save();
          }
        }
      }
    }

    for (const [gid, map] of Object.entries(state.prisons)) {
      for (const [uid, rec] of Object.entries(map)) {
        if (rec.until <= now) {
          const guild = await fetchGuild(gid);
          if (guild) await freePrison(guild, uid, { escape: false });
          else { delete map[uid]; save(); }
        } else {
          await popReminds(rec, (left) => ({
            content: `<@${uid}>${rec.jailerId ? ` <@${rec.jailerId}>` : ""}`,
            embeds: [
              new EmbedBuilder()
                .setTitle("⏳ SẮP THOÁT NGỤC")
                .setColor(0xe67e22)
                .setDescription(`Tù nhân <@${uid}> sắp được tha — còn **${left} giây**!\n\n> 🏃 Jailer <@${rec.jailerId}> ơi giữ chặt nè!`)
                .setTimestamp().setFooter({ text: "JUST LONELY · AURA GAME" }),
            ],
          }));
          if (now - (rec.lastEdit || 0) >= 15000) {
            rec.lastEdit = now;
            await updatePrisonMessage(rec);
          }
          if (now >= (rec.nextDrip || 0)) {
            rec.nextDrip = now + 60000;
            if (rec.jailerId) aura.gain(rec.jailerId, 2, { noStreak: true });
            const drain = prisonDrain(rec);
            rec.drainTotal = (rec.drainTotal || 0) + drain;
            aura.spend(uid, drain);
            save();
          }
        }
      }
    }

    const expired = state.effects.filter((f) => f.until <= now);
    if (expired.length) {
      state.effects = state.effects.filter((f) => f.until > now);
      save();
      for (const fx of expired) await expireFx(fx);
    } else {
      for (const fx of state.effects) {
        await popReminds(fx, (left) => ({
          content: `<@${fx.userId}>`,
          embeds: [
            new EmbedBuilder()
              .setTitle("⏳ SẮP HẾT PHẠT")
              .setColor(0xe67e22)
              .setDescription(`<@${fx.userId}> sắp được nói trở lại — còn **${left} giây**!\n\n> ⚡ \`${fx.label || "?"}\``)
              .setTimestamp().setFooter({ text: "JUST LONELY · AURA GAME" }),
          ],
        }));
      }
    }

    pruneCooldowns(now);
  } catch (err) {
    logger.warn(`game tick: ${err.message}`);
  } finally {
    ticking = false;
  }
}

function start(bot) {
  if (ticker) return;
  client = bot;
  load();
  ticker = setInterval(tick, 1000);
  ticker.unref?.();
  logger.info("game: ticker 1s chạy rồi — sở hữu / ngục / khống chế theo thời gian thực");
}

process.on("exit", flush);

// ---------- farm aura khi chat ----------
function farmOnMessage(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  if (farmAt[key] && now - farmAt[key] < FARM.COOLDOWN_MS) return null;
  farmAt[key] = now;
  if (Math.random() * 100 < FARM.LUCKY_CHANCE) {
    const g = aura.gain(userId, FARM.LUCKY_AURA, { success: true });
    return { lucky: true, ...g };
  }
  const g = aura.gain(userId, FARM.AURA, { noStreak: true });
  return { lucky: false, ...g };
}

// ---------- trạng thái hiện tại của một người ----------
function statusLines(guildId, userId) {
  const now = Date.now();
  const lines = [];
  const own = possessionOf(guildId, userId);
  if (own) lines.push(`🚪 **Đang bị sở hữu** bởi <@${own.ownerId}> (${fmtLeft(own.until - now)})`);
  const pr = prisonOf(guildId, userId);
  if (pr) lines.push(`⛓️ **Đang ngồi tù** tầng hầm (${fmtLeft(pr.until - now)}) — số lần thử: ${pr.attempts}`);
  const fxs = state.effects.filter((f) => f.guildId === guildId && f.userId === userId && f.until > now);
  for (const fx of fxs) {
    if (fx.type === "strip") lines.push(`🎭 **Bị cướp role** + mute (${fmtLeft(fx.until - now)})`);
    else lines.push(`⚡ **Bị khống chế (${fx.type})** (${fmtLeft(fx.until - now)})`);
  }
  if (!lines.length) lines.push("🕊️ **Đang tự do** — không dính hiệu ứng nào");
  return lines;
}

module.exports = {
  start,
  COOLDOWNS,
  TUNE,
  hitChance,
  AURA_GAIN,
  fmtLeft,
  errEmbed,
  castEmbed,
  replyErr,
  auraGainLine,
  auraSummary,
  gameGain,
  canTarget,
  checkCooldown,
  setCooldown,
  clearCooldowns,
  effectiveSlots,
  ensureRole,
  syncTierRole,
  possessionOf,
  possessionsBy,
  possess,
  releasePossession,
  prisonOf,
  imprison,
  freePrison,
  buyFreedom,
  payCost,
  attemptEscape,
  escapeRow,
  prisonEmbed,
  refreshSticky,
  applyCC,
  stripRoles,
  sendTo,
  fetchGuild,
  statusLines,
  farmOnMessage,
  FARM,
  MAX_EXTENSIONS,
};
