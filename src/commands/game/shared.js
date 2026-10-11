const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const inventory = require("../../utils/inventory");

// Ảnh minh họa riêng cho từng lệnh — lưu vĩnh viễn trong assets/img
// (link CDN Discord có chữ ký ex/hm hết hạn sau ~24h nên không được dùng trực tiếp)
const IMG_DIR = path.join(__dirname, "..", "..", "..", "assets", "img");
const IMG_FILES = {
  batcocloli: "batcocloli.jpg",
  nhothamloli: "batcocloli.jpg", // dùng chung ảnh với bắt cóc (yêu cầu: giống cái bắt cóc)
  chichdien: "chichdien.gif",
  cudamsamset: "cudamsamset.gif",
  leuleucay: "leuleucay.jpg",
  bosohuu: "bosohuu.gif", // /danhsachloli — bỏ sở hữu, tha sớm cho người bị bắt
};

function cmdImage(cmd) {
  const name = IMG_FILES[cmd];
  if (!name) return null;
  const p = path.join(IMG_DIR, name);
  if (!fs.existsSync(p)) return null;
  return { name, files: [new AttachmentBuilder(p, { name })] };
}

// Trả về payload editReply/reply có đính kèm ảnh lệnh (nếu file tồn tại)
function imgPayload(cmd, embed) {
  const img = cmdImage(cmd);
  if (!img) return { embeds: [embed] };
  embed.setImage(`attachment://${img.name}`);
  return { embeds: [embed], files: img.files };
}

async function fetchMember(guild, id) {
  return guild.members.cache.get(id) || (await guild.members.fetch(id).catch(() => null));
}

// Dòng chênh lệch role: chỉ hiện khi mục tiêu rank cao hơn
function rolePenaltyLine(chk) {
  if (!chk.ok || !chk.raw) return "";
  return `> 🔻 Role mục tiêu cao hơn **${chk.diff} bậc**: -${chk.raw}%` +
    `${chk.soak ? ` → Aura bạn xòa còn **-${chk.penalty}%**` : ""}\n`;
}

function ccResultLines(invokerId, targetId, res, gAtk, gVic) {
  const lines = [];
  if (res.immune) {
    lines.push(`> 🛡️ **MIỄN NHIỄM ${res.pct}%** — thời gian < 5s, <@${targetId}> đứng yên thở dốc!`);
    lines.push(`> ❌ Không trúng phát nào`);
  } else {
    lines.push(`> ⏳ Mute **${game.fmtLeft(res.applied * 1000)}** — gốc **${res.original}s**, miễn **${res.pct}%** → còn **${res.applied}s**`);
  }
  const a1 = game.auraGainLine(invokerId, gAtk);
  const a2 = game.auraGainLine(targetId, gVic);
  if (a1) lines.push(`> ${a1}`);
  if (a2) lines.push(`> ${a2}`);
  return lines.join("\n");
}

function baseEmbed({ title, color, description }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setFooter({ text: "JUST LONELY · AURA GAME" })
    .setTimestamp();
  return embed;
}

async function runCC(interaction, {
  cmd, kind, label, seconds, title, color, taunt,
}) {
  const guild = interaction.guild;
  const invokerId = interaction.user.id;
  const targetUser = interaction.options.getUser("nguoi", true);
  const cdSec = Math.round((game.COOLDOWNS[cmd] || 15000) / 1000);

  const cd = game.checkCooldown(guild.id, invokerId, cmd);
  if (cd) return game.replyErr(interaction, "⏳ Đang hồi chiêu", `Chờ **${game.fmtLeft(cd)}** nữa mới dùng lại lệnh này!`);

  const target = await fetchMember(guild, targetUser.id);
  const chk = game.canTarget(interaction.member, target, guild, "cc");
  if (!chk.ok) return game.replyErr(interaction, "❌ Không hợp lệ", chk.reason);

  // Item khiên (shield_cc/shield_all) trong túi đồ → miễn khống chế
  if (inventory.isShielded(target.id, "cc")) {
    return game.replyErr(
      interaction,
      "🛡️ Mục tiêu được bảo vệ",
      `<@${target.id}> đang bật **khiên khống chế** — ${label} vô hiệu!\n> Chờ khiên hết hạn hoặc chọn mục tiêu khác.`,
    );
  }

  // Tỉ lệ trúng = 100% trừ chênh lệch role (sàn 5% — không bao giờ vô lý)

  const chance = game.hitChance(100, chk.penalty, game.TUNE.rank.ccFloor, invokerId);
  const roll = Math.floor(Math.random() * 100) + 1;
  const hit = roll <= chance;

  await interaction.reply({
    content: `<@${target.id}> <@${invokerId}>`,
    embeds: [game.castEmbed("🎬", `<@${invokerId}> đang thi triển **${label}** vào <@${target.id}> — tỉ lệ trúng **${chance}%**, hồi chiêu **${cdSec}s**`)],
  });

  // Set cooldown ngay: chống spam khi bot thiếu quyền
  game.setCooldown(guild.id, invokerId, cmd);
  const statLine = `> 🎯 Tỉ lệ **${chance}%** (roll **${roll}**) • ⏱️ Hồi chiêu **${cdSec}s**`;
  const roleLine = rolePenaltyLine(chk);

  // 🪞 Tinh Thể Hỗn Mang: tấn công người có item → phản ngược về chính mình (100%)
  if (target.id !== invokerId && inventory.hasReflect(target.id)) {
    inventory.useReflect(target.id);
    const left = inventory.reflectLeft(target.id);
    const res = kind === "strip"
      ? await game.stripRoles({ guild, targetId: invokerId, seconds, channelId: interaction.channelId, label, invokerId: target.id })
      : await game.applyCC({ guild, targetId: invokerId, seconds, kind, channelId: interaction.channelId, label, invokerId: target.id });
    aura.bump(invokerId, "taken");
    await game.syncTierRole(await fetchMember(guild, invokerId));
    const lines = [
      `🪞 <@${target.id}> mang **Tinh Thể Hỗn Mang** — **${label}** của <@${invokerId}> **bị phản ngược**!`,
      "",
      `> 🎯 Phản đòn **100%** — mọi tỉ lệ trúng đều bị vô hiệu`,
    ];
    if (res.immune) {
      lines.push(`> 🛡️ <@${invokerId}> miễn nhiễm **${res.pct}%** — không dính phát nào (phản hụt!)`);
    } else {
      lines.push(`> ⏳ <@${invokerId}> dính **${game.fmtLeft(res.applied * 1000)}** — ăn đòn của chính mình`);
      if (res.type === "strip" || res.savedNames) {
        lines.push(`> 🎭 Mất **${(res.savedNames || []).length}** role: \`${(res.savedNames || []).slice(0, 8).join(", ") || "chả có gì"}\``);
      }
    }
    lines.push(`> 🔮 Còn **${left}** lần phản hôm nay · ⏱️ Hồi chiêu **${cdSec}s**`);
    lines.push(`> 📊 Bạn: ${game.auraSummary(invokerId).split("\n")[0]}`);
    const embed = baseEmbed({ title: "🪞 PHẢN ĐÒN HỖN MANG", color: 0xe91e63, description: lines.join("\n") });
    if (!res.immune) embed.addFields({ name: "📌 Trạng thái", value: game.statusLines(guild.id, invokerId).join("\n"), inline: false });
    return interaction.editReply(imgPayload(cmd, embed));
  }

  if (!hit) {
    aura.resetStreak(invokerId);
    aura.bump(invokerId, "fails");
    const u = aura.get(invokerId);
    const desc = [
      `<@${target.id}> **nép mình** thoát ${label} của <@${invokerId}>!`,
      "",
      roleLine + statLine,
      `> 🔥 Chuỗi reset • ✨ \`${u.aura}\` aura của bạn`,
      `> ⏱️ Hồi chiêu **${cdSec}s** — thử lại khi role bạn cao hơn!`,
    ].filter(Boolean).join("\n");
    return interaction.editReply(imgPayload(cmd, baseEmbed({ title: "💨 NÉ ĐƯỢC!", color: 0xe74c3c, description: desc })));
  }

  try {
    const res = kind === "strip"
      ? await game.stripRoles({ guild, targetId: target.id, seconds, channelId: interaction.channelId, label, invokerId })
      : await game.applyCC({ guild, targetId: target.id, seconds, kind, channelId: interaction.channelId, label, invokerId });

    const base = kind === "strip" ? game.AURA_GAIN.cudam : kind === "leuleu" ? game.AURA_GAIN.leuleu : game.AURA_GAIN.chich;
    const victimBase = kind === "strip" ? game.AURA_GAIN.cudamVictim : kind === "leuleu" ? game.AURA_GAIN.leuleuVictim : game.AURA_GAIN.chichVictim;
    const gAtk = aura.gain(invokerId, res.immune ? Math.round(base / 2) : base, res.immune ? { fail: true } : { success: true });
    const gVic = aura.gain(target.id, victimBase, {});
    aura.bump(invokerId, "hits");
    aura.bump(target.id, "taken");
    await game.syncTierRole(await fetchMember(guild, invokerId));
    await game.syncTierRole(target);

    const desc = [`<@${target.id}> dính **${label}** từ <@${invokerId}>!`, ""];
    if (taunt) desc.push(`> ${taunt}`);
    desc.push(roleLine + statLine);
    desc.push(ccResultLines(invokerId, target.id, res, gAtk, gVic));
    if (res.type === "strip" || res.savedNames) {
      desc.push(`> 🎭 Mất **${(res.savedNames || []).length}** role: \`${(res.savedNames || []).slice(0, 8).join(", ") || "chả có gì"}\``);
    }
    if (res.saved) desc.push(`> 🛟 Tự hoàn **${res.saved}** role khi hết hạn`);
    desc.push(`> 📊 Bạn: ${game.auraSummary(invokerId).split("\n")[0]}`);

    const embed = baseEmbed({ title, color, description: desc.join("\n") });
    if (!res.immune) embed.addFields({ name: "📌 Trạng thái", value: game.statusLines(guild.id, target.id).join("\n"), inline: false });
    return interaction.editReply(imgPayload(cmd, embed));
  } catch (err) {
    return interaction.editReply({ embeds: [game.errEmbed("❌ Thi triển thất bại", `\`${err.message}\``)] });
  }
}

module.exports = { fetchMember, rolePenaltyLine, ccResultLines, baseEmbed, runCC, cmdImage, imgPayload };
