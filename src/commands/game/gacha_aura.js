const { SlashCommandBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const items = require("../../utils/items");
const inventory = require("../../utils/inventory");

const MAX_CHAIN = 30;              // chặn chuỗi vòng bonus (cap 95% vẫn có thể dài)
const ROLE_NAME = "🎰 GACHA JACKPOT";
const ROLE_COLOR = 0xf1c40f;
const ITEM_BAKY_PCT = 5;           // trong pool mythic/bá khí: 5% ra ❕
const SPECIAL_BONUS_PCT = 200;     // +200% cược khi ra vật phẩm mythic/bá khí HOẶC jackpot role
const RARITY_EMOJI = { mythical: "🔴", baky: "❕" };

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Ảnh chụp luật của một vòng quay (winChance random trong band)
function derive(u, pct, forcedChance) {
  const band = aura.gachaWinBand(u.gStreak);
  return {
    band,
    winChance: forcedChance != null ? forcedChance : randInt(band[0], band[1]),
    bonusPct: aura.gachaBonusPct(u.gStreak, pct),
    cutPct: 40 + pct,
    rolePct: Math.min(100, aura.GACHA_PITY_BASE * 2 ** u.gPity),
    itemPct: Math.min(100, aura.GACHA_ITEM_BASE * 2 ** u.gItem),
    extraPct: Math.min(aura.GACHA_EXTRA_CAP, aura.GACHA_EXTRA_BASE + aura.GACHA_EXTRA_STEP * u.gExtra),
  };
}

function fmtSigned(v) {
  return v >= 0 ? `+${v}` : `${v}`;
}

async function awardJackpotRole(interaction) {
  try {
    const guild = interaction.guild;
    if (!guild?.roles?.cache) return false;
    let role = guild.roles.cache.find((r) => r.name === ROLE_NAME && !r.managed);
    if (!role) {
      role = await guild.roles.create({
        name: ROLE_NAME,
        colors: { primaryColor: ROLE_COLOR },
        reason: "gacha_aura jackpot",
      });
    }
    const member = interaction.member;
    if (!member?.roles?.add || !role) return false;
    await member.roles.add(role).catch(() => null);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gacha_aura")
    .setDescription("🪙 Gacha — 90% đầu, chuỗi thắng: band ↓ bonus +20%/lần, jackpot role, cd 8s")
    .addIntegerOption((o) => o.setName("cuoc").setDescription("Số aura cược (50-1000)").setRequired(true).setMinValue(50).setMaxValue(1000)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger("cuoc", true);
    const cdSec = Math.round(game.COOLDOWNS.gacha_aura / 1000);

    const cd = game.checkCooldown(interaction.guildId, userId, "gacha_aura");
    if (cd) return game.replyErr(interaction, "🪙 Xu đang nghỉ", `Chờ **${game.fmtLeft(cd)}** nữa (hồi chiêu **${cdSec}s**)!`);

    const have = aura.get(userId).aura;
    if (have < bet) {
      return game.replyErr(interaction, "💸 Không đủ aura", `Bạn chỉ có **${have}** aura — không đủ cược **${bet}**!`);
    }

    const pct0 = aura.immunityFor(have);
    const st0 = aura.gachaMeta(userId);
    const d0 = derive(st0, pct0); // pre-roll tỉ lệ vòng 1 để hiển thị trong embed_cast
    const bandTxt = d0.band[0] === d0.band[1]
      ? `**${d0.winChance}%**`
      : `**${d0.winChance}%** (chuỗi **${st0.gStreak}**, band ${d0.band[0]}–${d0.band[1]}%)`;
    const bonus0 = Math.round((bet * d0.bonusPct) / 100);
    const cut0 = Math.round((bet * d0.cutPct) / 100);

    await interaction.reply({
      content: `<@${userId}>`,
      embeds: [game.castEmbed("🪙", `<@${userId}> cược **${bet}** — tỉ lệ vòng 1 ${bandTxt} • thắng **+${bonus0}** bonus • thua mất **${cut0}** • 🎰 **${d0.rolePct}%** • 🎁 **${d0.itemPct}%** • 🔁 **${d0.extraPct}%** • hồi chiêu **${cdSec}s**!`)],
    });

    try {
      game.setCooldown(interaction.guildId, userId, "gacha_aura");
      aura.spend(userId, bet);

      const spins = [];
      let net = -bet;
      let roleHits = 0;
      let capped = false;

      for (let n = 1; n <= MAX_CHAIN; n++) {
        const u = aura.gachaMeta(userId);
        const d = n === 1 ? d0 : derive(u, aura.immunityFor(u.aura));
        const isExtra = n > 1;
        const line = { n, extra: isExtra, chance: d.winChance, win: false, net: 0, bonus: 0, role: false, item: null, special: 0, extraHit: false };

        // 1) thắng/thua (chuỗi thắng: thắng → band ↓10; thua → reset 90%)
        line.win = Math.random() * 100 < d.winChance;
        if (line.win) {
          const bonus = Math.round((bet * d.bonusPct) / 100);
          const credit = bet * 2 + bonus;
          aura.credit(userId, credit);
          net += credit;
          line.bonus = bonus;
          line.net = credit - (isExtra ? 0 : bet);
          u.gStreak += 1;
        } else {
          const cut = Math.round((bet * d.cutPct) / 100);
          if (isExtra) {
            const before = u.aura;
            aura.spend(userId, cut);
            const paid = before - u.aura;
            net -= paid;
            line.net = -paid;
          } else {
            const back = Math.max(0, bet - cut);
            aura.credit(userId, back);
            net += back;
            line.net = back - bet;
          }
          u.gStreak = 0;
        }

        // 2) jackpot role: 1% ×2 pity mỗi lần quay, trúng reset
        line.role = Math.random() * 100 < d.rolePct;
        if (line.role) {
          u.gPity = 0;
          roleHits += 1;
        } else {
          u.gPity += 1;
        }

        // 3) vật phẩm aura shop (pool chỉ mythic/bá khí — legend trở xuống KHÔNG rơi)
        const itemHit = Math.random() * 100 < d.itemPct;
        if (itemHit) {
          u.gItem = 0;
          const rarity = Math.random() * 100 < ITEM_BAKY_PCT ? "baky" : "mythical";
          const item = items.pickRandomByRarity(rarity);
          if (item) {
            inventory.addItem(userId, item.key, 1);
            line.item = item;
          } else {
            u.gItem += 1;
          }
        } else {
          u.gItem += 1;
        }

        // 4) bonus 200% cược nếu ra vật phẩm mythic/bá khí HOẶC jackpot role
        if (line.role || line.item) {
          line.special = Math.round((bet * SPECIAL_BONUS_PCT) / 100);
          aura.credit(userId, line.special);
          net += line.special;
        }

        // 5) vòng bonus: 35% +15% mỗi lần kích hoạt (cap 95%), luật y hệt vòng chính
        line.extraHit = Math.random() * 100 < d.extraPct;
        if (line.extraHit) u.gExtra += 1;

        spins.push(line);
        if (!line.extraHit) break;
        if (n === MAX_CHAIN) {
          capped = true;
          break;
        }
      }

      let roleOk = true;
      if (roleHits > 0) roleOk = await awardJackpotRole(interaction);

      const lines = spins.map((s) => {
        const parts = [
          `**${s.n}.** ${s.extra ? "🔁" : "🪙"} ${s.win
            ? `**THẮNG** \`${fmtSigned(s.net)}\` (tỉ lệ ${s.chance}%)`
            : `**THUA** \`${fmtSigned(s.net)}\` (tỉ lệ ${s.chance}%)`}`,
        ];
        const notes = [];
        if (s.role) notes.push(`🎰 **ROLE JACKPOT!**`);
        if (s.item) notes.push(`🎁 ${RARITY_EMOJI[s.item.rarity] || "🎁"} **${s.item.name}** ×1`);
        if (s.special) notes.push(`💰 **+${s.special}**`);
        if (s.extraHit) notes.push("🔁 **+1 vòng!**");
        if (notes.length) parts.push(notes.join(" • "));
        return parts.join(" ");
      });
      const bodyLines = lines.slice();
      if (capped) bodyLines.push(`⏸️ Đạt giới hạn **${MAX_CHAIN}** vòng/lần — vòng bonus còn sót giữ cho lần quay sau!`);
      if (roleHits > 0 && !roleOk) bodyLines.push(`⚠️ Trúng role nhưng **không gán được @${ROLE_NAME}** (bot thiếu quyền \`Manage Roles\`)!`);

      const wins = spins.filter((s) => s.win).length;
      const body = bodyLines.join("\n");
      let desc = `# 🪙 ${wins}/${spins.length} vòng THẮNG`;
      const spinFields = [];
      if (body.length <= 3400) {
        desc += `\n${body}`;
      } else {
        // chia nhỏ vào field (≤1024) để không vượt giới hạn embed
        let buf = [], len = 0;
        for (const l of bodyLines) {
          if (len + l.length + 1 > 1000 && buf.length) { spinFields.push(buf.join("\n")); buf = []; len = 0; }
          buf.push(l); len += l.length + 1;
        }
        if (buf.length) spinFields.push(buf.join("\n"));
      }

      const uFinal = aura.gachaMeta(userId);
      const total = aura.get(userId).aura;
      const title = net > 0 ? "LÃI RỒI!" : net === 0 ? "HÒA VỐN!" : "LỖ RỒI!";
      const color = net > 0 ? 0x2ecc71 : net === 0 ? 0xf39c12 : 0xe74c3c;

      const nextBand = aura.gachaWinBand(uFinal.gStreak);
      const nextBonusPct = aura.gachaBonusPct(uFinal.gStreak, aura.immunityFor(total));
      const rolePctF = Math.min(100, aura.GACHA_PITY_BASE * 2 ** uFinal.gPity);
      const itemPctF = Math.min(100, aura.GACHA_ITEM_BASE * 2 ** uFinal.gItem);
      const extraPctF = Math.min(aura.GACHA_EXTRA_CAP, aura.GACHA_EXTRA_BASE + aura.GACHA_EXTRA_STEP * uFinal.gExtra);

      const embed = game.errEmbed(`🪙 ${title}`, "")
        .setColor(color)
        .setDescription(desc)
        .addFields(
          ...spinFields.map((v, i) => ({ name: i === 0 ? "🪙 Kết quả" : `🪙 Kết quả (${i + 1})`, value: v, inline: false })),
          { name: "💰 Lãi/lỗ lần này", value: `**${fmtSigned(net)}** aura`, inline: true },
          { name: "💎 Tổng aura", value: `**${total}**`, inline: true },
          { name: "🎰 Jackpot", value: roleHits > 0 ? "**TRÚNG!** 🎉" : `**${rolePctF}%** (1% ×2/quay)`, inline: true },
          {
            name: "📈 Tiến trình chuỗi thắng",
            value: `> 🎯 Chuỗi hiện tại **${uFinal.gStreak}** — vòng sau **${nextBand[0]}–${nextBand[1]}%**, bonus **${nextBonusPct}%** cược\n` +
              `> 🎁 Vật phẩm **${itemPctF}%** (pool 🔴/❕, ×2/quay, trúng reset) • 🔁 Vòng bonus **${extraPctF}%**${extraPctF >= aura.GACHA_EXTRA_CAP ? " (đã cap)" : ""}\n` +
              `> 📏 Luật: **thắng ×2 + bonus, thua mất ${cut0}** — chuỗi thắng bonus **+20%/lần**, **thua reset 90%**\n` +
              `> 🎰 Trúng role/vật phẩm → **+${Math.round((bet * SPECIAL_BONUS_PCT) / 100)}** bonus 200% cược • ⏱️ Hồi chiêu **${cdSec}s**\n` +
              game.auraSummary(userId),
            inline: false,
          },
          {
            name: "⚖️ Ưu ái",
            value: `> ⚖️ Aura cao **được ưu ái** mọi phép thử (giảm phạt role, nhiều slot, tù rẻ) — nhưng **khó kiếm aura hơn**\n` +
              `> 🎰 Role đặc biệt: **@${ROLE_NAME}** — ai trúng được gán ngay`,
            inline: false,
          },
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

      const g = await game.fetchGuild(interaction.guildId);
      const member = g ? await g.members.fetch(userId).catch(() => null) : null;
      if (member) await game.syncTierRole(member);

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({ embeds: [game.errEmbed("🪙 Đồng xu kẹt", `\`${err.message}\``)] });
    }
  },
};
