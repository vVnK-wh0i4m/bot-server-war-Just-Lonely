const { SlashCommandBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const inventory = require("../../utils/inventory");
const { fetchMember, baseEmbed, rolePenaltyLine, imgPayload } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("batcocloli")
    .setDescription("Bắt cóc — 50% tỉ lệ, giữ **30 phút**, slot 5+bonus theo aura, hồi chiêu 30s")
    .addUserOption((o) => o.setName("nguoi").setDescription("Người muốn bắt").setRequired(true)),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Bắt cóc cần một server để ẩn nạn nhân!");
    }

    const invokerId = interaction.user.id;
    const targetUser = interaction.options.getUser("nguoi", true);
    const cdSec = Math.round(game.COOLDOWNS.batcocloli / 1000);

    const cd = game.checkCooldown(guild.id, invokerId, "batcocloli");
    if (cd) {
      return game.replyErr(interaction, "⏳ Đang hồi chiêu", `Chờ **${game.fmtLeft(cd)}** nữa mới bắt lại được (hồi chiêu **${cdSec}s**)!`);
    }

    const target = await fetchMember(guild, targetUser.id);
    const chk = game.canTarget(interaction.member, target, guild, "capture");
    if (!chk.ok) return game.replyErr(interaction, "❌ Không hợp lệ", chk.reason);

    // Item khiên (shield_capture/shield_all) trong túi đồ → miễn bị bắt cóc
    if (inventory.isShielded(target.id, "capture")) {
      return game.replyErr(
        interaction,
        "🛡️ Mục tiêu được bảo vệ",
        `<@${target.id}> đang bật **khiên chống bắt cóc** — bạn tóm hụt!\n> Chờ khiên hết hạn hoặc chọn mục tiêu khác.`,
      );
    }

    // Tỉ lệ = 25% trừ chênh role (sàn 2.5%) — ai cũng bị tác động, role cao chỉ giảm tỉ lệ

    const chance = game.hitChance(game.TUNE.batcoc.chance, chk.penalty, game.TUNE.rank.captureFloor, invokerId);
    const minutes = game.TUNE.batcoc.minutes;
    const slots = game.effectiveSlots(invokerId);
    const current = game.possessionsBy(guild.id, invokerId).length;
    const roleLine = rolePenaltyLine(chk);

    if (current >= slots) {
      return game.replyErr(
        interaction,
        "🚫 Đã đủ chỗ trong nhà",
        `Bạn đang sở hữu **${current}/${slots}** người` +
          `\n> 👥 Slot = **${aura.BASE_SLOTS} cơ bản** + bonus aura/item (đang \`${aura.get(invokerId).aura}\` aura)` +
          `\n> 🏃 Thử \`/nhothamloli\` nhốt bớt xuống tầng hầm, hoặc dùng item **+slot** từ \`/aurashop\`!`,
      );
    }

    await interaction.reply({
      content: `<@${target.id}> <@${invokerId}>`,
      embeds: [game.castEmbed("🦹", `<@${invokerId}> đang **bắt cóc** <@${target.id}> — tỉ lệ **${chance}%**, giữ **${minutes} phút**, hồi chiêu **${cdSec}s**`)],
    });

    try {
      game.setCooldown(guild.id, invokerId, "batcocloli");

      // 🪞 Tinh Thể Hỗn Mang: bắt cóc người持有 item → bị họ bắt ngược
      if (target.id !== invokerId && inventory.hasReflect(target.id)) {
        inventory.useReflect(target.id);
        const left = inventory.reflectLeft(target.id);
        const bounce = await game.possess({ guild, ownerId: target.id, targetId: invokerId, minutes, channelId: interaction.channelId });
        let desc = [
          `🪞 <@${target.id}> mang **Tinh Thể Hỗn Mang** — **bắt cóc BỊ PHẢN**! <@${invokerId}> bị <@${target.id}> **bắt ngược**!`,
          "",
          `> 🔮 Còn **${left}** lần phản hôm nay · ⏱️ Hồi chiêu **${cdSec}s**`,
        ];
        if (bounce.ok) {
          const gAtk = aura.gain(target.id, game.AURA_GAIN.possess, { success: true });
          aura.spend(invokerId, game.AURA_GAIN.caughtLoss);
          const gVic = aura.gain(invokerId, game.AURA_GAIN.possessVictim, {});
          aura.bump(target.id, "possessions");
          aura.bump(invokerId, "taken");
          await game.syncTierRole(await fetchMember(guild, invokerId));
          await game.syncTierRole(target);
          const owned = game.possessionsBy(guild.id, target.id);
          const slots = game.effectiveSlots(target.id);
          desc.push(
            `> ⏳ <@${invokerId}> bị sở hữu **${minutes} phút** (hết <t:${Math.floor((Date.now() + minutes * 60000) / 1000)}:T>)`,
            `> 👥 <@${target.id}> đang sở hữu **${owned.length}/${slots}** người`,
            `> 🩸 Phạt **-${game.AURA_GAIN.caughtLoss} aura**`,
            `> ${game.auraGainLine(target.id, gAtk)}`,
            `> ${game.auraGainLine(invokerId, gVic)}`,
          );
        } else {
          const lost = aura.spend(invokerId, game.AURA_GAIN.escapeFail);
          aura.bump(invokerId, "fails");
          aura.resetStreak(invokerId);
          desc.push(
            `> ❌ <@${target.id}> không còn chỗ — phản đòn trượt, nhưng <@${invokerId}> vẫn **hụt mất ${game.AURA_GAIN.escapeFail} aura** → \`${lost}\``,
            `> 🔥 Chuỗi reset`,
          );
        }
        const embed = baseEmbed({ title: "🪞 BẮT CÓC BỊ PHẢN ĐÒN", color: 0xe91e63, description: desc.join("\n") });
        return interaction.editReply({ content: `<@${target.id}> <@${invokerId}>`, ...imgPayload("batcocloli", embed) });
      }

      // Roll liên tục để sàn 2.5% đúng tuyệt đối — chance nguyên thì hiển thị roll số nguyên như cũ
      const rollF = Math.random() * 100;
      const hit = rollF < chance;
      const roll = Number.isInteger(chance) ? Math.floor(rollF) + 1 : +rollF.toFixed(2);
      const statLine = `> 🎯 Tỉ lệ **${chance}%** (roll **${roll}**) • ⏱️ Hồi chiêu **${cdSec}s**`;

      if (!hit) {
        const lost = aura.spend(invokerId, game.AURA_GAIN.escapeFail);
        aura.bump(invokerId, "fails");
        aura.resetStreak(invokerId); // fail = mất chuỗi, không farm streak bằng spam
        const g = aura.get(invokerId);
        const embed = baseEmbed({
          title: "🙈 BẮT CÓC THẤT BẠI",
          color: 0xe74c3c,
          description:
            `<@${invokerId}> tóm <@${target.id}> hụt — trượt **${+(roll - chance).toFixed(2)}** điểm!\n\n` +
            roleLine + statLine +
            `> 💨 Nạn nhân cắn vào tay và chạy mất dạng\n` +
            `> 💸 Phạt **-${game.AURA_GAIN.escapeFail} aura** → \`${lost}\`\n` +
            `> 🔥 Chuỗi reset về **x${g.streak}**\n` +
            `> 📊 Bạn: ${game.auraSummary(invokerId).split("\n")[0]}`,
        });
        return interaction.editReply(imgPayload("batcocloli", embed));
      }

      const res = await game.possess({ guild, ownerId: invokerId, targetId: target.id, minutes, channelId: interaction.channelId });
      if (!res.ok) {
        return interaction.editReply({ embeds: [game.errEmbed("❌ Không chiếm được", res.reason)] });
      }

      const gAtk = aura.gain(invokerId, game.AURA_GAIN.possess, { success: true });
      aura.spend(target.id, game.AURA_GAIN.caughtLoss);
      const gVic = aura.gain(target.id, game.AURA_GAIN.possessVictim, {});
      aura.bump(invokerId, "possessions");
      aura.bump(target.id, "taken");
      await game.syncTierRole(await fetchMember(guild, invokerId));
      await game.syncTierRole(target);

      const owned = game.possessionsBy(guild.id, invokerId);
      const embed = baseEmbed({
        title: "🦹 BẮT CÓC THÀNH CÔNG!",
        color: 0x8e44ad,
        description:
          `<@${invokerId}> tóm được <@${target.id}> và lôi về hang!\n\n` +
          roleLine + statLine +
          `> ⏳ Sở hữu **${minutes} phút** (hết <t:${Math.floor((Date.now() + minutes * 60000) / 1000)}:T>)\n` +
          `> 👥 Đang sở hữu **${owned.length}/${slots}** người: ${owned.map((p) => `<@${p.userId}>`).join(" ")}\n` +
          `> 🎭 Gắn role **@Bị Sở Hữu** (+ 👑 **Chủ Chiếm** cho bạn)\n` +
          `> 🩸 Nạn nhân phạt **-${game.AURA_GAIN.caughtLoss} aura**\n` +
          `> ${game.auraGainLine(invokerId, gAtk)}\n` +
          `> ${game.auraGainLine(target.id, gVic)}`,
      });
      embed.addFields(
        { name: "🔮 AURA của bạn", value: game.auraSummary(invokerId), inline: false },
        { name: "📌 Trạng thái nạn nhân", value: game.statusLines(guild.id, target.id).join("\n"), inline: false },
      );
      return interaction.editReply({ content: `<@${target.id}> <@${invokerId}>`, ...imgPayload("batcocloli", embed) });
    } catch (err) {
      return interaction.editReply({ embeds: [game.errEmbed("❌ Bắt cóc lỗi", `\`${err.message}\``)] });
    }
  },
};
