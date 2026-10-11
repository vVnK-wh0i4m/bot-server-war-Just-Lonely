const { SlashCommandBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const inventory = require("../../utils/inventory");
const { fetchMember, baseEmbed, imgPayload } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nhothamloli")
    .setDescription("Nhốt hầm loli — ticket chỉ thấy hầm, 10 phút, thoát 25% hoặc trả aura, cd 60s")
    .addUserOption((o) => o.setName("nguoi").setDescription("Người đã bị bắt (phải đang bị bạn sở hữu)").setRequired(true)),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return game.replyErr(interaction, "❌ Chỉ trong server", "Tầng hầm chỉ mở trong server!");
    }

    const invokerId = interaction.user.id;
    const targetUser = interaction.options.getUser("nguoi", true);
    const minutes = game.TUNE.prison.minutes;
    const chance = game.TUNE.prison.escape;
    const cdSec = Math.round(game.COOLDOWNS.nhothamloli / 1000);

    const cd = game.checkCooldown(guild.id, invokerId, "nhothamloli");
    if (cd) {
      return game.replyErr(interaction, "⏳ Đang hồi chiêu", `Chờ **${game.fmtLeft(cd)}** nữa mới lôi người xuống hầm (hồi chiêu **${cdSec}s**)!`);
    }

    const target = await fetchMember(guild, targetUser.id);
    const chk = game.canTarget(interaction.member, target, guild, "capture");
    if (!chk.ok) return game.replyErr(interaction, "❌ Không hợp lệ", chk.reason);

    const owned = game.possessionOf(guild.id, target.id);
    if (!owned || owned.ownerId !== invokerId) {
      return game.replyErr(
        interaction,
        "🚫 Chưa sở hữu người này",
        `<@${target.id}> **không** nằm trong tay bạn${owned ? ` — hiện bị <@${owned.ownerId}> sở hữu` : ""}.\n` +
          `> 🦹 Dùng \`/batcocloli\` (tỉ lệ **${game.TUNE.batcoc.chance}%**) bắt cóc trước, rồi mới nhốt!`,
      );
    }
    if (game.prisonOf(guild.id, target.id)) {
      return game.replyErr(interaction, "⛓️ Đang ngồi tù", `<@${target.id}> đang ở tầng hầm rồi — đợi hết hạn đã nhé!`);
    }

    await interaction.reply({
      content: `<@${target.id}> <@${invokerId}>`,
      embeds: [game.castEmbed("🕳️", `<@${invokerId}> lôi <@${target.id}> xuống **#${game.TUNE.prison.channel}** — nhốt **100%**, **${minutes} phút**, thoát **${chance}%**, hồi chiêu **${cdSec}s**`)],
    });

    try {
      game.setCooldown(guild.id, invokerId, "nhothamloli");

      // 🪞 Tinh Thể Hỗn Mang: lôi người持有 item xuống hầm → bị họ ném xuống thay
      if (target.id !== invokerId && inventory.hasReflect(target.id)) {
        inventory.useReflect(target.id);
        const left = inventory.reflectLeft(target.id);
        const bounce = await game.imprison({
          guild, jailerId: target.id, prisonerId: invokerId, minutes, chance,
          channelId: interaction.channelId, note: null, announce: false,
        });
        if (bounce.ok) {
          const gAtk = aura.gain(target.id, game.AURA_GAIN.jail, { success: true });
          const gVic = aura.gain(invokerId, game.AURA_GAIN.jailVictim, {});
          aura.bump(target.id, "jails");
          aura.bump(invokerId, "jailed");
          await game.syncTierRole(await fetchMember(guild, invokerId));
          await game.syncTierRole(target);
          const embed = baseEmbed({
            title: "🪞 PHẢN ĐÒN — XUỐNG HẦM!",
            color: 0xe91e63,
            description:
              `<@${target.id}> mang **Tinh Thể Hỗn Mang** — <@${invokerId}> **bị ném xuống hầm thay**!\n\n` +
              `> 🕳️ Kênh: <#${bounce.rec.channelId}> • ⏳ **${minutes} phút** — thoát **${chance}%**\n` +
              `> 🩸 Mỗi phút trừ **5-200 aura** (tier cao / ngồi lâu → đau hơn)\n` +
              `> 🔮 Còn **${left}** lần phản hôm nay · ⏱️ Hồi chiêu **${cdSec}s**\n` +
              `> ${game.auraGainLine(target.id, gAtk)}\n` +
              `> ${game.auraGainLine(invokerId, gVic)}`,
          });
          embed.addFields({ name: "📌 Trạng thái", value: game.statusLines(guild.id, invokerId).join("\n"), inline: false });
          return interaction.editReply({ content: `<@${target.id}> <@${invokerId}>`, ...imgPayload("nhothamloli", embed) });
        }
        const lost = aura.spend(invokerId, game.AURA_GAIN.escapeFail);
        aura.bump(invokerId, "fails");
        const embed = baseEmbed({
          title: "🪞 PHẢN ĐÒN HỤT",
          color: 0xe91e63,
          description:
            `<@${target.id}> mang **Tinh Thể Hỗn Mang** — nhưng <@${invokerId}> **đang ngồi tù rồi**, phản đòn trượt!\n\n` +
            `> 💸 Vẫn bị trừ **-${game.AURA_GAIN.escapeFail} aura** → \`${lost}\`\n` +
            `> 🔮 Còn **${left}** lần phản hôm nay · ⏱️ Hồi chiêu **${cdSec}s**`,
        });
        return interaction.editReply({ content: `<@${target.id}> <@${invokerId}>`, ...imgPayload("nhothamloli", embed) });
      }

      const res = await game.imprison({
        guild,
        jailerId: invokerId,
        prisonerId: target.id,
        minutes,
        chance,
        channelId: interaction.channelId,
        note: null,
        announce: false,
      });
      if (!res.ok) {
        return interaction.editReply({ embeds: [game.errEmbed("❌ Không nhốt được", res.reason)] });
      }

      const gAtk = aura.gain(invokerId, game.AURA_GAIN.jail, { success: true });
      const gVic = aura.gain(target.id, game.AURA_GAIN.jailVictim, {});
      aura.bump(invokerId, "jails");
      aura.bump(target.id, "jailed");
      await game.syncTierRole(await fetchMember(guild, invokerId));
      await game.syncTierRole(target);

      const embed = baseEmbed({
        title: "🕳️ XUỐNG TẦNG HẦM!",
        color: 0x34495e,
        description:
          `<@${invokerId}> ném <@${target.id}> xuống **tầng hầm**!\n\n` +
          `> 🕳️ Kênh: \`#${game.TUNE.prison.channel}\` → <#${res.channel.id}>\n` +
          `> 🎫 Kiểu **ticket**: tù nhân **chỉ thấy hầm** — đã ẩn **${res.rec.hidden?.length || 0}** kênh khác\n` +
          `> ⏳ **${minutes} phút** — hết <t:${Math.floor((Date.now() + minutes * 60000) / 1000)}:T> • 🎯 Tỉ lệ nhốt **100%**\n` +
            `> 🎲 Tù nhân thoát được **${chance}%** (thử sai +5%/lần, cap 95%, hồi chiêu **${cdSec}s**)\n` +
            `> 🩸 Mỗi phút trừ **5-200 aura** — tier cao / ngồi lâu / trốn hụt → đau hơn\n` +
          `> 🏃 Nút **🏃 trốn** hoặc **💸 trả ${game.payCost(res.rec)} aura** (aura cao giảm giá) • gõ \`/tronthoat\`\n` +
          `> ⛔ Trốn hụt = gia hạn án **+50%** (tối đa ${game.MAX_EXTENSIONS} lần) + phạt **-${game.AURA_GAIN.escapeFail} aura**\n` +
          `> ☠️ Thoát được là **QUẢ BÁO**: ngược đãi lại bạn ${minutes} phút\n` +
          `> ${game.auraGainLine(invokerId, gAtk)}\n` +
          `> ${game.auraGainLine(target.id, gVic)}`,
      });
      embed.addFields({ name: "📌 Trạng thái tù nhân", value: game.statusLines(guild.id, target.id).join("\n"), inline: false });
      return interaction.editReply({ content: `<@${target.id}> <@${invokerId}>`, ...imgPayload("nhothamloli", embed) });
    } catch (err) {
      return interaction.editReply({ embeds: [game.errEmbed("❌ Làm hầm lỗi", `\`${err.message}\``)] });
    }
  },
};
