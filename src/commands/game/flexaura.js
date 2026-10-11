const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");

function buildModal() {
  const nameInput = new TextInputBuilder()
    .setCustomId("ten")
    .setLabel("Tên cho role AURA (VD: Khoa)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32)
    .setPlaceholder("Tên hiển thị của bạn");
  return new ModalBuilder()
    .setCustomId("flex_role_modal")
    .setTitle("Đặt tên role AURA")
    .addComponents(new ActionRowBuilder().addComponents(nameInput));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("flexaura")
    .setDescription("Xem hồ sơ AURA của bạn (hoặc của ai đó) — phân hạng, tier, slot, miễn khống chế")
    .addUserOption((o) => o.setName("nguoi").setDescription("Xem thay cho người này (mặc định: bạn)")),

  async execute(interaction) {
    const user = interaction.options.getUser("nguoi") || interaction.user;
    const u = aura.get(user.id);
    const tier = aura.tierOf(u.aura);
    const rank = aura.rankOf(u.aura);
    const p = aura.progressInfo(u.aura);
    const r = aura.rank(user.id);
    const slots = game.effectiveSlots(user.id);
    const nt = aura.nextTier(u.aura);

    const embed = new EmbedBuilder()
      .setTitle(`${rank.icon} AURA — ${user.username}`)
      .setColor(rank.color)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setDescription(
        `${rank.icon} **Phân hạng: ${rank.name}** • ${tier.icon} **${tier.name}** • ✨ \`${u.aura}\` aura\n` +
          `${r ? `📍 Hạng **#${r.position}**/${r.total} server` : "📍 Chưa xếp hạng"}`,
      )
      .addFields(
        {
          name: "🔮 Tiến độ slot",
          value: `${p.bar} \`${p.into}/100\`\n> 👥 Slot: **${slots}**\n> 🛡️ Miễn khống chế: **${aura.immunityFor(u.aura)}%** (tối đa 60%)`,
          inline: false,
        },
        {
          name: "📈 Thống kê",
          value:
            `> 🦹 Chích/cướp trúng: **${u.hits}** • 🎯 Bị đánh: **${u.taken}**\n` +
            `> 🕳️ Nhốt người: **${u.jails}** • ⛓️ Bị nhốt: **${u.jailed}**\n` +
            `> 🏃 Thoát ngục: **${u.escapes}** • 💀 Thử trốn fail: **${u.fails}**\n` +
            `> 🔥 Chuỗi hiện tại: **x${u.streak}** (cao nhất x${u.bestStreak})`,
          inline: false,
        },
        {
          name: "🕹️ Trạng thái hiện tại",
          value: interaction.guild ? game.statusLines(interaction.guild.id, user.id).join("\n") : "—",
          inline: false,
        },
      )
      .setFooter({ text: `JUST LONELY · AURA GAME · ${user.tag}` })
      .setTimestamp();

    if (nt) {
      embed.addFields({
        name: "🎯 Gần nhất",
        value:
          `Đến **${nt.name}** (\`${nt.min}\`) — còn **${nt.min - u.aura}** aura\n` +
          `> ${tier.icon} Hiện tại: **${tier.name}** · slot ${slots}/15 · miễn khống chế **${aura.immunityFor(u.aura)}%**`,
        inline: false,
      });
    } else {
      embed.addFields({
        name: "👑 Đã đạt đỉnh",
        value: `Đã có **${tier.name}** — bậc cao nhất! 🏆`,
        inline: false,
      });
    }

    const rows = [];
    if (u.aura >= aura.CUSTOM_ROLE_MIN) {
      const btn = new ButtonBuilder()
        .setCustomId("flex_role")
        .setLabel(u.auraRoleName ? `🎨 Đổi tên role (${u.auraRoleName})` : "🎨 Đặt tên role AURA")
        .setStyle(ButtonStyle.Primary);
      rows.push(new ActionRowBuilder().addComponents(btn));
    }

    return interaction.reply({ content: `<@${user.id}>`, embeds: [embed], components: rows });
  },

  async onComponent(interaction) {
    const id = interaction.customId;
    const userId = interaction.user.id;

    if (id === "flex_role") {
      const u = aura.get(userId);
      if (u.aura < aura.CUSTOM_ROLE_MIN) {
        return interaction.reply({
          content: `❌ Cần từ **${aura.CUSTOM_ROLE_MIN}** aura để có role custom (bạn: **${u.aura}**).`,
          ephemeral: true,
        });
      }
      return interaction.showModal(buildModal());
    }

    if (id === "flex_role_modal") {
      const u = aura.get(userId);
      if (u.aura < aura.CUSTOM_ROLE_MIN) {
        return interaction.reply({ content: "❌ Bạn chưa đủ 15M aura.", ephemeral: true });
      }
      const raw = (interaction.fields.getTextInputValue("ten") || "").trim();
      const name = raw.replace(/[`*_~|\\@]/g, "").replace(/\s+/g, " ").slice(0, 32).trim();
      if (!name) {
        return interaction.reply({ content: "❌ Tên rỗng hoặc toàn ký tự không hợp lệ.", ephemeral: true });
      }

      aura.setAuraRoleName(userId, name);
      await game.syncTierRole(interaction.member).catch(() => {});

      const want = `AURA ${name}`;
      const member = interaction.member;
      const held = member?.roles?.cache?.some?.((r) => r.name === want);

      const embed = game.errEmbed("🎨 ĐÃ ĐẶT TÊN ROLE AURA", "")
        .setColor(0x00cec9)
        .setDescription(
          `<@${userId}> → role **${want}** ${held ? "✅ đã gán" : "⚠️ chưa gán được (bot thiếu quyền \`Manage Roles\`?)"}\n` +
            `> Chỉ người **≥ ${aura.CUSTOM_ROLE_MIN}** aura mới giữ được role này\n` +
            `> Đổi tên bất cứ lúc nào qua nút trên \`/flexaura\``,
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
