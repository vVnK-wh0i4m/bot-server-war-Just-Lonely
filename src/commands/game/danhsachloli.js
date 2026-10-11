const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");
const { imgPayload } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("danhsachloli")
    .setDescription("📜 Chi tiết danh sách người bạn đã bắt — thời gian, trạng thái, ai đang ở hầm"),

  async execute(interaction) {
    if (!interaction.guild) {
      return game.replyErr(interaction, "❌ Chỉ dùng trong server", "Danh sách tính theo từng server — vào server rồi dùng lại nhé.");
    }

    const list = game
      .possessionsBy(interaction.guild.id, interaction.user.id)
      .sort((a, b) => a.until - b.until);
    if (!list.length) {
      return game.replyErr(interaction, "🦹 DANH SÁCH TRỐNG", "Bạn chưa bắt ai — dùng **/batcocloli** để tóm lấy ai đó trước.");
    }

    const now = Date.now();
    const slots = game.effectiveSlots(interaction.user.id);
    const entries = [];
    const picks = [];

    let i = 0;
    for (const rec of list) {
      i++;
      const member = await interaction.guild.members.fetch(rec.userId).catch(() => null);
      const name = member?.displayName || `<@${rec.userId}>`;
      const u = aura.get(rec.userId);
      const tier = aura.tierOf(u.aura);
      const caughtAt = Math.floor((rec.until - rec.minutes * 60000) / 1000);
      const pr = game.prisonOf(interaction.guild.id, rec.userId);

      const bits = [`🕐 bắt <t:${caughtAt}:T>`, `án **${rec.minutes} phút**`];
      if (rec.force) bits.push("⚔️ bắt ép");
      if (pr) bits.push(`🕳️ **hầm** — hết <t:${Math.floor(pr.until / 1000)}:R> • thử **${pr.attempts}** lần`);
      const status = game
        .statusLines(interaction.guild.id, rec.userId)
        .filter((l) => !l.includes("Đang bị sở hữu") && !l.includes("Đang ngồi tù"));
      if (status.length) bits.push(status.join(" • "));

      entries.push(
        `**${i}. 🎯 ${name}** — ${tier.icon} \`${u.aura}\` aura • ⏳ còn **${game.fmtLeft(rec.until - now)}** (<t:${Math.floor(rec.until / 1000)}:R>)\n> ${bits.join(" • ")}`,
      );
      picks.push({ userId: rec.userId, name, aura: u.aura, tier, minutes: rec.minutes, until: rec.until });
    }

    // Chặn tràn embed 4096 ký tự (slot nhiều vẫn an toàn)
    const lines = [];
    let used = 0;
    for (let idx = 0; idx < entries.length; idx++) {
      if (used + entries[idx].length + 1 > 3800) {
        lines.push(`… và **${entries.length - idx}** người nữa — slot đầy vui lắm!`);
        break;
      }
      lines.push(entries[idx]);
      used += entries[idx].length + 1;
    }

    const first = list[0];
    const firstMember = await interaction.guild.members.fetch(first.userId).catch(() => null);
    const firstName = firstMember?.displayName || `<@${first.userId}>`;

    const embed = new EmbedBuilder()
      .setTitle(`📜 DANH SÁCH ĐÃ BẮC — ${interaction.user.username}`)
      .setColor(0x9b59b6)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .setDescription(lines.join("\n"))
      .addFields({
        name: "👥 Slot",
        value: `**${list.length}/${slots}** slot đang dùng • ⏳ sắp hết hạn: **${firstName}** <t:${Math.floor(first.until / 1000)}:R>`,
        inline: false,
      })
      .setFooter({ text: `JUST LONELY · AURA GAME · ${list.length}/${slots} slot` })
      .setTimestamp();

    // 🔓 Bỏ sở hữu — chọn người trong danh sách: tha sớm, người bị bắt được bù 100–500 aura
    const options = picks.slice(0, 25).map((p) => ({
      label: `${p.name} — ${game.fmtLeft(p.until - now)}`.slice(0, 100),
      description: `${p.tier.icon} ${p.aura} aura · án ${p.minutes} phút`.slice(0, 100),
      value: p.userId,
      emoji: { name: "🔓" },
    }));
    const components = [];
    if (options.length) {
      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("danhsachloli_release")
            .setPlaceholder("🔓 Chọn người để bỏ sở hữu — họ được bù 100–500 aura")
            .addOptions(options),
        ),
      );
    }
    if (picks.length > options.length) {
      embed.addFields({
        name: "⚠️ Giới hạn ô chọn",
        value: `Chỉ hiện **${options.length}** người sắp hết hạn — bỏ nốt phần còn lại ở lần chạy sau.`,
        inline: false,
      });
    }

    return interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embed], components });
  },

  // Chọn người trong ô danh sách → bỏ sở hữu + bù aura cho họ
  async onComponent(interaction) {
    if (interaction.customId !== "danhsachloli_release") return;
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: "❌ Chỉ dùng trong server.", ephemeral: true }).catch(() => {});
    }

    const targetId = interaction.values?.[0];
    if (!targetId) return interaction.update({}).catch(() => {});

    const rec = game.possessionOf(guild.id, targetId);
    if (!rec || rec.ownerId !== interaction.user.id) {
      return interaction
        .reply({ content: "❌ Người này không còn thuộc về bạn — họ đã hết hạn hoặc bị bỏ trước đó.", ephemeral: true })
        .catch(() => {});
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
      return interaction
        .reply({ content: "❌ Không tìm thấy thành viên này trong server — bỏ sở hữu thất bại.", ephemeral: true })
        .catch(() => {});
    }

    await game.releasePossession(guild.id, targetId, "bị bỏ sở hữu sớm bởi chủ nhân", { silent: true });
    const gift = 100 + Math.floor(Math.random() * 401);
    aura.credit(targetId, gift);
    await game.syncTierRole(member).catch(() => {});

    const left = game.possessionsBy(guild.id, interaction.user.id).length;
    const pr = game.prisonOf(guild.id, targetId);
    const desc = [
      `<@${targetId}> **được tha** sớm khỏi <@${rec.ownerId}> — bỏ sở hữu!`,
      "",
      `> ✨ Bù đắp **+${gift} aura** (100–500 ngẫu nhiên) → \`${aura.get(targetId).aura}\``,
      `> ⏱️ Bản án gốc **${rec.minutes} phút** — cắt ngắn`,
      pr ? `> 🕳️ Vẫn còn ở **tầng hầm** — ra khi hết hạn tù` : null,
      left ? `> 📜 <@${interaction.user.id}> còn **${left}** người trong danh sách` : `> 📜 Danh sách trống — thả hết rồi!`,
    ]
      .filter(Boolean)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🔓 BỎ SỞ HỮU — ĐƯỢC THA")
      .setColor(0x2ecc71)
      .setDescription(desc)
      .setFooter({ text: "JUST LONELY · AURA GAME" })
      .setTimestamp();

    return interaction.update({ content: `<@${targetId}> <@${rec.ownerId}>`, ...imgPayload("bosohuu", embed) });
  },
};
